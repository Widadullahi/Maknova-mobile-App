import json
from uuid import uuid4

from flask import Blueprint, current_app, request

from ..db import db_cursor
from ..routes.estates import can_manage_estate, get_estate
from ..utils.audit import record_audit_log
from ..utils.authz import require_roles
from ..utils.paystack import PaystackError, initialize_transaction, verify_transaction
from ..utils.responses import error, success
from ..utils.settings import get_commission_percent

forms_bp = Blueprint("forms", __name__)

SIGNATURE_METHODS = {"typed", "drawn", "electronic_acceptance"}

# Document generation is included in the successful property transaction fee.
# There is no second document/processing charge.
FEE_GATED_TEMPLATE_CODES = set()


def parse_json(value):
    if isinstance(value, (dict, list)):
        return value
    if value is None:
        return {}
    return json.loads(value)


def serialize_template(row):
    return {
        "id": row["id"],
        "code": row["code"],
        "name": row["name"],
        "version": row["version"],
        "schema": parse_json(row["schema_json"]),
        "isActive": bool(row["is_active"]),
        "feeGated": row["code"] in FEE_GATED_TEMPLATE_CODES,
    }


def serialize_submission(row):
    return {
        "id": row["id"],
        "templateId": row["template_id"],
        "estateId": row.get("estate_id"),
        "propertyId": row.get("property_id"),
        "buyerId": row.get("buyer_id"),
        "residentUserId": row.get("resident_user_id"),
        "submittedBy": row["submitted_by"],
        "status": row["status"],
        "payload": parse_json(row["payload_json"]),
        "submittedAt": row.get("submitted_at"),
    }


def serialize_document_payment(row):
    return {
        "id": row["id"],
        "templateCode": row["template_code"],
        "propertyId": row["property_id"],
        "estateId": row.get("estate_id"),
        "amount": float(row["amount"] or 0),
        "commissionPercent": float(row["commission_percent"] or 0),
        "reference": row["reference"],
        "status": row["status"],
        "submissionId": row.get("submission_id"),
        "createdAt": row.get("created_at"),
        "paidAt": row.get("paid_at"),
    }

def serialize_allocation(row):
    return {
        "id": row["id"],
        "propertyId": row["property_id"],
        "buyerId": row["buyer_id"],
        "saleId": row.get("sale_id"),
        "allocationReference": row["allocation_reference"],
        "allocatedAt": row.get("allocated_at"),
    }


def can_access_estate_or_admin(cursor, user, estate_id):
    if not estate_id:
        return True
    estate = get_estate(cursor, estate_id)
    return bool(estate and can_manage_estate(user, estate))


def find_usable_document_payment(cursor, template_code, property_id):
    cursor.execute(
        """
        SELECT * FROM document_generation_payments
        WHERE template_code = %s AND property_id = %s AND status = 'success' AND submission_id IS NULL
        ORDER BY created_at DESC
        LIMIT 1
        """,
        (template_code, property_id),
    )
    return cursor.fetchone()


@forms_bp.get("/templates")
@require_roles("estate_manager", "admin", "super_admin", "resident", "buyer", "security")
def list_templates(current_user):
    with db_cursor() as cursor:
        cursor.execute(
            "SELECT * FROM digital_form_templates WHERE is_active = 1 ORDER BY name ASC"
        )
        templates = [serialize_template(row) for row in cursor.fetchall()]

    return success({"templates": templates})


@forms_bp.get("/submissions")
@require_roles("estate_manager", "admin", "super_admin", "resident", "buyer", "security")
def list_submissions(current_user):
    estate_id = request.args.get("estateId")
    params = []
    filters = []

    if current_user["role"] not in ("admin", "super_admin"):
        if estate_id:
            filters.append("estate_id = %s")
            params.append(estate_id)
        else:
            filters.append("submitted_by = %s")
            params.append(current_user["id"])
    elif estate_id:
        filters.append("estate_id = %s")
        params.append(estate_id)

    where = f"WHERE {' AND '.join(filters)}" if filters else ""

    with db_cursor() as cursor:
        if estate_id and not can_access_estate_or_admin(cursor, current_user, estate_id):
            return error("FORBIDDEN", "You cannot access form submissions for this estate.", 403)

        cursor.execute(
            f"""
            SELECT * FROM form_submissions
            {where}
            ORDER BY created_at DESC
            LIMIT 200
            """,
            tuple(params),
        )
        submissions = [serialize_submission(row) for row in cursor.fetchall()]

    return success({"submissions": submissions})


@forms_bp.post("/submissions")
@require_roles("estate_manager", "admin", "super_admin", "resident", "buyer", "security")
def create_submission(current_user):
    payload = request.get_json(silent=True) or {}
    template_id = payload.get("templateId")
    form_payload = payload.get("payload") or {}
    signature = payload.get("signature") or {}
    signature_method = signature.get("method") or "typed"
    signature_text = (signature.get("text") or "").strip() or None
    property_id = payload.get("propertyId") or None

    if not template_id:
        return error("VALIDATION_ERROR", "Form template is required.", 422)
    if signature_method not in SIGNATURE_METHODS:
        return error("VALIDATION_ERROR", "Signature method is not supported.", 422)
    if not signature_text and signature_method in ("typed", "electronic_acceptance"):
        return error("VALIDATION_ERROR", "Signature text is required.", 422)

    with db_cursor(commit=True) as cursor:
        cursor.execute("SELECT * FROM digital_form_templates WHERE id = %s AND is_active = 1", (template_id,))
        template = cursor.fetchone()
        if not template:
            return error("NOT_FOUND", "Form template was not found.", 404)

        estate_id = payload.get("estateId") or None
        if estate_id and not can_access_estate_or_admin(cursor, current_user, estate_id):
            return error("FORBIDDEN", "You cannot submit forms for this estate.", 403)

        document_payment = None
        if template["code"] == "plot_allocation_form":
            if not property_id:
                return error("VALIDATION_ERROR", "A property is required to generate this document.", 422)
            cursor.execute(
                """
                SELECT p.estate_id
                FROM properties p
                WHERE p.id = %s
                LIMIT 1
                """,
                (property_id,),
            )
            property_row = cursor.fetchone()
            if not property_row:
                return error("NOT_FOUND", "Property not found.", 404)
            estate_id = property_row["estate_id"]
            if not can_access_estate_or_admin(cursor, current_user, estate_id):
                return error("FORBIDDEN", "You cannot generate documents for this property.", 403)
            cursor.execute(
                """
                SELECT id, estate_id, buyer_id
                FROM sales
                WHERE property_id = %s AND payment_status = 'paid' AND status IN ('active', 'completed')
                ORDER BY created_at DESC
                LIMIT 1
                """,
                (property_id,),
            )
            if not cursor.fetchone():
                return error("SALE_PAYMENT_REQUIRED", "The successful property payment is required before the allocation form can be completed.", 422)

        cursor.execute(
            """
            INSERT INTO form_submissions
              (template_id, estate_id, property_id, buyer_id, resident_user_id, submitted_by, status, payload_json)
            VALUES (%s, %s, %s, %s, %s, %s, 'submitted', %s)
            """,
            (
                template_id,
                estate_id,
                property_id,
                payload.get("buyerId") or None,
                payload.get("residentUserId") or None,
                current_user["id"],
                json.dumps(form_payload),
            ),
        )
        submission_id = cursor.lastrowid
        cursor.execute(
            """
            INSERT INTO signature_records
              (form_submission_id, signer_user_id, signature_method, signature_text, terms_version, device_metadata)
            VALUES (%s, %s, %s, %s, %s, %s)
            """,
            (
                submission_id,
                current_user["id"],
                signature_method,
                signature_text,
                signature.get("termsVersion") or template["version"],
                json.dumps(signature.get("deviceMetadata") or {}),
            ),
        )

        if document_payment:
            cursor.execute(
                "UPDATE document_generation_payments SET submission_id = %s WHERE id = %s",
                (submission_id, document_payment["id"]),
            )

        allocation = None
        # A paid Plot Allocation Form is the final allocation approval step
        # for the current workflow. Resolve the paid sale server-side so the
        # client cannot allocate an unpaid or unrelated plot. The existing
        # property check makes this idempotent for retries/reopens.
        if template["code"] == "plot_allocation_form" and current_user["role"] in ("estate_manager", "admin", "super_admin"):
            cursor.execute(
                """
                SELECT s.id AS sale_id, s.estate_id, s.buyer_id
                FROM sales s
                WHERE s.property_id = %s AND s.payment_status = 'paid' AND s.status IN ('active', 'completed')
                ORDER BY s.created_at DESC
                LIMIT 1
                """,
                (property_id,),
            )
            paid_sale = cursor.fetchone()
            if paid_sale:
                cursor.execute("SELECT * FROM allocations WHERE property_id = %s LIMIT 1", (property_id,))
                allocation = cursor.fetchone()
                if not allocation:
                    allocation_reference = f"ALLOC-{property_id}-{submission_id}"
                    cursor.execute(
                        """
                        INSERT INTO allocations
                          (estate_id, property_id, buyer_id, sale_id, allocation_reference, allocated_at, note, created_by)
                        VALUES (%s, %s, %s, %s, %s, CURRENT_DATE, %s, %s)
                        """,
                        (paid_sale["estate_id"], property_id, paid_sale["buyer_id"], paid_sale["sale_id"], allocation_reference, "Automatically allocated after signed paid form", current_user["id"]),
                    )
                    allocation_id = cursor.lastrowid
                    cursor.execute("UPDATE properties SET status = 'allocated' WHERE id = %s", (property_id,))
                    cursor.execute("SELECT * FROM allocations WHERE id = %s", (allocation_id,))
                    allocation = cursor.fetchone()
                    record_audit_log(cursor, current_user["id"], "allocation.auto_created", "property", property_id, {"submissionId": submission_id, "allocationId": allocation_id})
                cursor.execute("UPDATE form_submissions SET status = 'approved' WHERE id = %s", (submission_id,))

        cursor.execute("SELECT * FROM form_submissions WHERE id = %s", (submission_id,))
        submission = cursor.fetchone()

    return success({"submission": serialize_submission(submission), "allocation": serialize_allocation(allocation) if allocation else None}, "Form submitted", 201)


# --- Legacy document-payment endpoints ---
# Kept temporarily for old clients, but they must never initialize a second
# charge now that document generation is included in the property transaction.


@forms_bp.post("/document-payments/initialize")
@require_roles("estate_manager", "admin", "super_admin")
def initialize_document_payment(current_user):
    return error("DOCUMENT_FEE_REMOVED", "Document generation is included in the successful property transaction. No separate payment is required.", 410)


def apply_successful_document_payment(cursor, document_payment):
    """Marks the fee as paid. Called from the Paystack webhook; the manual verify
    endpoint below re-checks status before calling this too, same idempotency
    pattern as the sale-payment and wallet-topup flows."""
    cursor.execute(
        "UPDATE document_generation_payments SET status = 'success', paid_at = CURRENT_TIMESTAMP WHERE id = %s",
        (document_payment["id"],),
    )
    record_audit_log(
        cursor,
        None,
        "document_payment.success",
        entity_type="document_generation_payment",
        entity_id=document_payment["id"],
        metadata={"reference": document_payment["reference"], "amount": float(document_payment["amount"])},
    )


@forms_bp.get("/document-payments/verify/<reference>")
@require_roles("estate_manager", "admin", "super_admin")
def verify_document_payment(current_user, reference):
    return error("DOCUMENT_FEE_REMOVED", "Document generation is included in the successful property transaction. No separate payment is required.", 410)
