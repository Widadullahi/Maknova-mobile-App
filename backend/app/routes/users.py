import pymysql

from flask import Blueprint, request
from flask_jwt_extended import get_jwt_identity, jwt_required

from ..db import db_cursor
from ..routes.auth import serialize_user
from ..utils.audit import record_audit_log
from ..utils.authz import require_roles
from ..utils.responses import error, success

users_bp = Blueprint("users", __name__)

DELETION_OPEN_STATUSES = ("pending", "in_review", "approved")


def serialize_deletion_request(row):
    return {
        "id": row["id"],
        "userId": row.get("user_id"),
        "email": row.get("email"),
        "fullName": row.get("full_name"),
        "reason": row.get("reason"),
        "status": row.get("status"),
        "requestedAt": row.get("requested_at"),
        "reviewedAt": row.get("reviewed_at"),
        "completedAt": row.get("completed_at"),
        "reviewNote": row.get("review_note"),
    }


@users_bp.get("/me")
@jwt_required()
def get_profile():
    user_id = get_jwt_identity()

    with db_cursor() as cursor:
        cursor.execute("SELECT * FROM users WHERE id = %s LIMIT 1", (user_id,))
        user = cursor.fetchone()

    if not user:
        return error("NOT_FOUND", "User account was not found.", 404)

    return success({"user": serialize_user(user)})


@users_bp.post("/account-deletion-requests")
@jwt_required()
def create_account_deletion_request():
    """Queue a user-requested deletion for identity and records review.

    Business, payment, signature, and audit records may be subject to legal or
    accounting retention. The request is therefore reviewable rather than an
    unconditional destructive delete.
    """
    user_id = get_jwt_identity()

    with db_cursor(commit=True) as cursor:
        cursor.execute("SELECT * FROM users WHERE id = %s LIMIT 1", (user_id,))
        user = cursor.fetchone()
        if not user:
            return error("NOT_FOUND", "User account was not found.", 404)

        cursor.execute(
            """
            SELECT * FROM account_deletion_requests
            WHERE user_id = %s AND status IN ('pending', 'in_review', 'approved')
            ORDER BY id DESC LIMIT 1
            """,
            (user_id,),
        )
        existing = cursor.fetchone()
        if existing:
            return success(
                {"request": serialize_deletion_request(existing)},
                "An account deletion request is already being reviewed.",
            )

        payload = request.get_json(silent=True) or {}
        reason = (payload.get("reason") or "").strip()[:1000] or None
        cursor.execute(
            """
            INSERT INTO account_deletion_requests
              (user_id, email, full_name, reason, requester_ip)
            VALUES (%s, %s, %s, %s, %s)
            """,
            (user["id"], user["email"], user["full_name"], reason, request.remote_addr),
        )
        request_id = cursor.lastrowid
        record_audit_log(
            cursor,
            user["id"],
            "account_deletion.requested",
            "user",
            user["id"],
            {"requestId": request_id},
        )
        cursor.execute("SELECT * FROM account_deletion_requests WHERE id = %s", (request_id,))
        deletion_request = cursor.fetchone()

    return success(
        {"request": serialize_deletion_request(deletion_request)},
        "Your account deletion request has been received for review.",
        201,
    )


@users_bp.get("/account-deletion-requests/me")
@jwt_required()
def get_my_account_deletion_request():
    user_id = get_jwt_identity()

    with db_cursor() as cursor:
        cursor.execute(
            "SELECT * FROM account_deletion_requests WHERE user_id = %s ORDER BY id DESC LIMIT 1",
            (user_id,),
        )
        deletion_request = cursor.fetchone()

    return success({"request": serialize_deletion_request(deletion_request) if deletion_request else None})


@users_bp.get("/account-deletion-requests")
@require_roles("admin", "super_admin")
def list_account_deletion_requests(current_user):
    status = request.args.get("status")
    params = []
    where_sql = ""
    if status:
        where_sql = "WHERE status = %s"
        params.append(status)

    with db_cursor() as cursor:
        cursor.execute(
            f"""
            SELECT * FROM account_deletion_requests
            {where_sql}
            ORDER BY requested_at DESC, id DESC
            LIMIT 500
            """,
            tuple(params),
        )
        requests_list = [serialize_deletion_request(row) for row in cursor.fetchall()]

    return success({"requests": requests_list})


@users_bp.patch("/account-deletion-requests/<int:request_id>")
@require_roles("admin", "super_admin")
def review_account_deletion_request(current_user, request_id):
    payload = request.get_json(silent=True) or {}
    status = payload.get("status")
    note = (payload.get("reviewNote") or "").strip()[:1000] or None
    if status not in ("in_review", "approved", "rejected"):
        return error("VALIDATION_ERROR", "Use in_review, approved, or rejected for a deletion review.", 422)

    with db_cursor(commit=True) as cursor:
        cursor.execute("SELECT * FROM account_deletion_requests WHERE id = %s LIMIT 1", (request_id,))
        deletion_request = cursor.fetchone()
        if not deletion_request:
            return error("NOT_FOUND", "Deletion request was not found.", 404)

        cursor.execute(
            """
            UPDATE account_deletion_requests
            SET status = %s, reviewed_at = CURRENT_TIMESTAMP, reviewed_by = %s, review_note = %s
            WHERE id = %s
            """,
            (status, current_user["id"], note, request_id),
        )
        record_audit_log(
            cursor,
            current_user["id"],
            "account_deletion.reviewed",
            "account_deletion_request",
            request_id,
            {"status": status},
        )
        cursor.execute("SELECT * FROM account_deletion_requests WHERE id = %s", (request_id,))
        updated_request = cursor.fetchone()

    return success({"request": serialize_deletion_request(updated_request)}, "Deletion request review updated.")


@users_bp.get("")
@require_roles("admin", "super_admin")
def list_users(current_user):
    role = request.args.get("role")
    status = request.args.get("status")
    search = (request.args.get("search") or "").strip()

    where = []
    params = []
    if role:
        where.append("role = %s")
        params.append(role)
    if status:
        where.append("account_status = %s")
        params.append(status)
    if search:
        where.append("(full_name LIKE %s OR email LIKE %s OR phone LIKE %s)")
        needle = f"%{search}%"
        params.extend([needle, needle, needle])

    where_sql = f"WHERE {' AND '.join(where)}" if where else ""

    with db_cursor() as cursor:
        cursor.execute(
            f"""
            SELECT id, full_name, email, phone, role, account_status, created_at, updated_at
            FROM users
            {where_sql}
            ORDER BY created_at DESC
            LIMIT 500
            """,
            tuple(params),
        )
        users = [serialize_user(row) for row in cursor.fetchall()]

    return success({"users": users})


@users_bp.patch("/<int:user_id>/status")
@require_roles("admin", "super_admin")
def update_user_status(current_user, user_id):
    payload = request.get_json(silent=True) or {}
    status = payload.get("status")

    if status not in ("active", "pending", "suspended", "rejected"):
        return error("VALIDATION_ERROR", "Account status is not supported.", 422)

    if current_user["role"] != "super_admin":
        with db_cursor() as cursor:
            cursor.execute("SELECT role FROM users WHERE id = %s LIMIT 1", (user_id,))
            target = cursor.fetchone()
        if target and target["role"] in ("admin", "super_admin"):
            return error("FORBIDDEN", "Only a super admin can restrict admin accounts.", 403)

    with db_cursor(commit=True) as cursor:
        cursor.execute("SELECT * FROM users WHERE id = %s LIMIT 1", (user_id,))
        user = cursor.fetchone()
        if not user:
            return error("NOT_FOUND", "User account was not found.", 404)

        cursor.execute("UPDATE users SET account_status = %s WHERE id = %s", (status, user_id))
        record_audit_log(
            cursor,
            current_user["id"],
            "user.status_updated",
            "user",
            user_id,
            {"previousStatus": user["account_status"], "nextStatus": status},
        )
        cursor.execute("SELECT * FROM users WHERE id = %s LIMIT 1", (user_id,))
        updated_user = cursor.fetchone()

    return success({"user": serialize_user(updated_user)})


@users_bp.delete("/<int:user_id>")
@require_roles("super_admin")
def delete_user(current_user, user_id):
    """
    Permanent account deletion — Master Owner (super_admin) only. Distinct from
    suspend/reject (reversible status flags any admin can set) and from estate
    hard-delete (a separate, estate-scoped action). Requires confirm: true.

    A user with real operational history (an estate they manage, sales, resident
    records, etc.) usually can't be hard-deleted at all: most tables reference
    users with a RESTRICT-by-default foreign key, so MySQL itself refuses the
    delete rather than silently orphaning or cascading through unrelated
    business records. That's treated as an expected outcome, not a bug — the
    correct action for an account with history is to suspend it, not erase it.
    """
    if user_id == current_user["id"]:
        return error("FORBIDDEN", "You cannot delete your own account.", 403)

    payload = request.get_json(silent=True) or {}
    if payload.get("confirm") is not True:
        return error("CONFIRMATION_REQUIRED", "Deleting a user is permanent. Resend the request with confirm: true.", 422)

    with db_cursor(commit=True) as cursor:
        cursor.execute("SELECT * FROM users WHERE id = %s LIMIT 1", (user_id,))
        user = cursor.fetchone()
        if not user:
            return error("NOT_FOUND", "User account was not found.", 404)
        if user["role"] == "super_admin":
            return error("FORBIDDEN", "Master Owner accounts cannot be deleted.", 403)

        try:
            cursor.execute("DELETE FROM users WHERE id = %s", (user_id,))
        except pymysql.err.IntegrityError:
            return error(
                "HAS_RELATED_RECORDS",
                "This account has associated records (an estate, sales, residents, etc.) and cannot be permanently "
                "deleted. Suspend the account instead to block access while keeping the historical records intact.",
                409,
            )

        record_audit_log(
            cursor,
            current_user["id"],
            "user.deleted",
            entity_type="user",
            entity_id=user_id,
            metadata={"email": user["email"], "role": user["role"]},
        )

    return success({}, "User account permanently deleted")
