import random
import hmac
from datetime import datetime, timezone
from hashlib import sha256

from flask import Blueprint, current_app, request

from ..db import db_cursor
from ..utils.audit import record_audit_log
from ..utils.authz import require_roles
from ..utils.responses import error, success
from ..utils.scope import can_access_estate, can_access_gate
from .wallet import deduct_guest_pass_fee, link_guest_pass_fee_transaction

visitor_passes_bp = Blueprint("visitor_passes", __name__)


def serialize_pass(row):
    return {
        "id": row["id"],
        "estateId": row.get("estate_id"),
        "residentUserId": row.get("resident_user_id"),
        "hostName": row.get("host_name"),
        "visitorName": row["visitor_name"],
        "visitorPhone": row.get("visitor_phone"),
        "visitorIdentityType": row.get("visitor_identity_type"),
        "visitorIdentityNumber": row.get("visitor_identity_number"),
        "plateNumber": row.get("plate_number"),
        "purpose": row["purpose"],
        "passType": row["pass_type"],
        "code": row["code"],
        "pin": row["pin"],
        "qrPayload": row["qr_payload"],
        "status": row["status"],
        "expectedDate": row.get("expected_date"),
        "expectedTime": row.get("expected_time"),
        "validFrom": row.get("valid_from"),
        "validUntil": row.get("valid_until"),
        "checkedInAt": row.get("checked_in_at"),
        "checkedOutAt": row.get("checked_out_at"),
        "gateName": row.get("gate_name"),
        "createdBy": row["created_by"],
        "createdAt": row.get("created_at"),
    }


def normalize_status(status):
    if status == "approved":
        return "approved", "Pass is valid. Visitor can be checked in."
    if status == "checked_in":
        return "already_used", "Pass has already been used for check-in."
    if status == "checked_out":
        return "checked_out", "Visitor has already checked out."
    if status == "denied":
        return "denied", "Pass is denied and cannot be used for entry."
    if status == "expired":
        return "expired", "Pass has expired."
    return status, "Pass requires manual review."


def generate_code():
    return f"VP-{random.randint(100000, 999999)}"


def generate_pin():
    return str(random.randint(100000, 999999))


def sign_pass_code(code):
    secret = current_app.config["JWT_SECRET_KEY"].encode("utf-8")
    return hmac.new(secret, code.encode("utf-8"), sha256).hexdigest()


def extract_query(payload):
    qr_payload = (payload.get("qrPayload") or payload.get("code") or "").strip()
    pin = (payload.get("pin") or "").strip()

    if pin:
        return "pin", pin, ""
    if "visitor-pass/" in qr_payload:
        code = qr_payload.split("visitor-pass/", 1)[1].split("?", 1)[0].strip()
        token = ""
        if "token=" in qr_payload:
            token = qr_payload.split("token=", 1)[1].split("&", 1)[0].strip()
        return "qr", code, token
    return "code", qr_payload, ""


def is_expired(visitor_pass):
    valid_until = visitor_pass.get("valid_until")
    if not valid_until:
        return False

    if isinstance(valid_until, str):
        valid_until = datetime.fromisoformat(valid_until)
    if valid_until.tzinfo is None:
        valid_until = valid_until.replace(tzinfo=timezone.utc)

    return datetime.now(timezone.utc) > valid_until.astimezone(timezone.utc)


@visitor_passes_bp.get("")
@require_roles("resident", "estate_manager", "security", "admin", "super_admin")
def list_visitor_passes(current_user):
    with db_cursor() as cursor:
        if current_user["role"] == "resident":
            cursor.execute(
                "SELECT * FROM visitor_passes WHERE created_by = %s ORDER BY created_at DESC LIMIT 100",
                (current_user["id"],),
            )
        elif current_user["role"] in ("admin", "super_admin"):
            cursor.execute("SELECT * FROM visitor_passes ORDER BY created_at DESC LIMIT 100")
        else:
            cursor.execute(
                """
                SELECT visitor_passes.*
                FROM visitor_passes
                LEFT JOIN security_assignments
                  ON security_assignments.estate_id = visitor_passes.estate_id
                 AND security_assignments.user_id = %s
                 AND security_assignments.status = 'active'
                LEFT JOIN estates ON estates.id = visitor_passes.estate_id
                WHERE security_assignments.id IS NOT NULL OR estates.manager_user_id = %s
                ORDER BY visitor_passes.created_at DESC
                LIMIT 100
                """,
                (current_user["id"], current_user["id"]),
            )

        passes = [serialize_pass(row) for row in cursor.fetchall()]

    return success({"passes": passes})


@visitor_passes_bp.post("")
@require_roles("resident", "estate_manager", "admin", "super_admin")
def create_visitor_pass(current_user):
    payload = request.get_json(silent=True) or {}
    visitor_name = (payload.get("visitorName") or "").strip()
    visitor_phone = (payload.get("visitorPhone") or "").strip() or None
    purpose = (payload.get("purpose") or "").strip()

    if not visitor_name or not purpose:
        return error("VALIDATION_ERROR", "Visitor name and purpose are required.", 422)

    code = generate_code()
    pin = generate_pin()
    token = sign_pass_code(code)
    qr_payload = f"estateflow://visitor-pass/{code}?token={token}"

    with db_cursor(commit=True) as cursor:
        estate_id = payload.get("estateId") or None
        if estate_id and not can_access_estate(cursor, current_user, estate_id):
            return error("FORBIDDEN", "You cannot create passes for this estate.", 403)

        wallet_transaction_id = None
        if current_user["role"] == "resident":
            ok, fee, wallet_transaction_id = deduct_guest_pass_fee(cursor, current_user)
            if not ok:
                return error(
                    "TOPUP_REQUIRED",
                    f"Your wallet balance is too low to generate a guest pass (₦{fee:,.2f} fee). Top up your wallet to continue.",
                    402,
                    {"requiredFee": fee},
                )

        cursor.execute(
            """
            INSERT INTO visitor_passes
              (estate_id, resident_user_id, host_name, visitor_name, visitor_phone,
               visitor_identity_type, visitor_identity_number, plate_number, purpose,
               pass_type, code, pin, qr_payload, qr_token_hash, status, expected_date, expected_time,
               valid_from, valid_until, created_by)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, 'approved', %s, %s, %s, %s, %s)
            """,
            (
                estate_id,
                current_user["id"] if current_user["role"] == "resident" else payload.get("residentUserId") or None,
                payload.get("hostName") or current_user.get("full_name"),
                visitor_name,
                visitor_phone,
                payload.get("visitorIdentityType") or None,
                payload.get("visitorIdentityNumber") or None,
                payload.get("plateNumber") or None,
                purpose,
                payload.get("passType") or "single_entry",
                code,
                pin,
                qr_payload,
                token,
                payload.get("expectedDate") or None,
                payload.get("expectedTime") or None,
                payload.get("validFrom") or None,
                payload.get("validUntil") or None,
                current_user["id"],
            ),
        )
        pass_id = cursor.lastrowid
        if wallet_transaction_id:
            link_guest_pass_fee_transaction(cursor, wallet_transaction_id, pass_id)
        cursor.execute("SELECT * FROM visitor_passes WHERE id = %s", (pass_id,))
        visitor_pass = cursor.fetchone()

    return success({"pass": serialize_pass(visitor_pass)}, "Visitor pass created", 201)


@visitor_passes_bp.post("/verify")
@require_roles("security", "estate_manager", "admin", "super_admin")
def verify_visitor_pass(current_user):
    payload = request.get_json(silent=True) or {}
    method, query, token = extract_query(payload)
    action = payload.get("action") or "check_in"

    if not query:
        return error("VALIDATION_ERROR", "QR payload, pass code, or PIN is required.", 422)

    with db_cursor(commit=True) as cursor:
        if method == "pin":
            cursor.execute("SELECT * FROM visitor_passes WHERE pin = %s LIMIT 1", (query,))
        else:
            cursor.execute("SELECT * FROM visitor_passes WHERE code = %s LIMIT 1", (query,))

        visitor_pass = cursor.fetchone()

        if not visitor_pass:
            cursor.execute(
                """
                INSERT INTO visitor_pass_verifications
                  (visitor_pass_id, verified_by, verification_method, scanned_value, result, message, gate_name)
                VALUES (NULL, %s, %s, %s, 'not_found', 'Visitor pass was not found.', %s)
                """,
                (current_user["id"], method, query, payload.get("gateName") or None),
            )
            return success({"verification": {"status": "not_found", "message": "Visitor pass was not found.", "pass": None}})

        if visitor_pass.get("estate_id") and not can_access_gate(cursor, current_user, visitor_pass["estate_id"], payload.get("gateName") or None):
            cursor.execute(
                """
                INSERT INTO visitor_pass_verifications
                  (visitor_pass_id, verified_by, verification_method, scanned_value, result, message, gate_name)
                VALUES (%s, %s, %s, %s, 'denied', 'Security user is not assigned to this estate or gate.', %s)
                """,
                (visitor_pass["id"], current_user["id"], method, query, payload.get("gateName") or None),
            )
            return error("FORBIDDEN", "You cannot verify passes for this estate or gate.", 403)

        if method == "qr" and visitor_pass.get("qr_token_hash") and not hmac.compare_digest(visitor_pass["qr_token_hash"], token):
            result, message = "denied", "QR token signature is invalid."
        elif is_expired(visitor_pass):
            result, message = "expired", "Pass has expired."
            cursor.execute("UPDATE visitor_passes SET status = 'expired' WHERE id = %s", (visitor_pass["id"],))
            cursor.execute("SELECT * FROM visitor_passes WHERE id = %s", (visitor_pass["id"],))
            visitor_pass = cursor.fetchone()
        elif action == "check_out" and visitor_pass["status"] == "checked_in":
            cursor.execute(
                """
                UPDATE visitor_passes
                SET status = 'checked_out',
                    checked_out_at = CURRENT_TIMESTAMP,
                    checked_out_by = %s,
                    gate_name = COALESCE(%s, gate_name)
                WHERE id = %s
                """,
                (current_user["id"], payload.get("gateName") or None, visitor_pass["id"]),
            )
            result, message = "checked_out", "Visitor checked out."
            cursor.execute("SELECT * FROM visitor_passes WHERE id = %s", (visitor_pass["id"],))
            visitor_pass = cursor.fetchone()
        else:
            result, message = normalize_status(visitor_pass["status"])

        if result == "approved":
            cursor.execute(
                """
                UPDATE visitor_passes
                SET status = 'checked_in',
                    checked_in_at = CURRENT_TIMESTAMP,
                    checked_in_by = %s,
                    gate_name = %s
                WHERE id = %s
                """,
                (current_user["id"], payload.get("gateName") or None, visitor_pass["id"]),
            )
            result = "approved"
            message = "Pass verified and visitor checked in."
            cursor.execute("SELECT * FROM visitor_passes WHERE id = %s", (visitor_pass["id"],))
            visitor_pass = cursor.fetchone()

        cursor.execute(
            """
            INSERT INTO visitor_pass_verifications
              (visitor_pass_id, verified_by, verification_method, scanned_value, result, message, gate_name)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            """,
            (
                visitor_pass["id"],
                current_user["id"],
                method,
                query,
                result,
                message,
                payload.get("gateName") or None,
            ),
        )
        record_audit_log(
            cursor,
            current_user["id"],
            "visitor_pass.verified",
            "visitor_pass",
            visitor_pass["id"],
            {"result": result, "method": method, "action": action, "gateName": payload.get("gateName")},
        )

    return success({"verification": {"status": result, "message": message, "pass": serialize_pass(visitor_pass)}})
