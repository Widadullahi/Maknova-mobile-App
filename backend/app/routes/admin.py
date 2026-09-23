import secrets
import string

from flask import Blueprint, request

from ..db import db_cursor
from ..routes.auth import serialize_user
from ..routes.verification import document_path_from_url, serialize_application, get_application_documents
from ..utils.audit import record_audit_log
from ..utils.authz import require_roles
from ..utils.responses import error, success
from ..utils.security import hash_password

admin_bp = Blueprint("admin", __name__)

ALLOWED_REVIEW_STATUSES = {
    "approved",
    "rejected",
    "additional_info_required",
}

PASSWORD_ALPHABET = string.ascii_letters + string.digits


def generate_temp_password():
    return "".join(secrets.choice(PASSWORD_ALPHABET) for _ in range(12))


@admin_bp.get("/verification/applications")
@require_roles("admin", "super_admin")
def list_verification_applications(current_user):
    status = request.args.get("status")
    params = []
    where = ""

    if status:
        where = "WHERE status = %s"
        params.append(status)

    with db_cursor() as cursor:
        cursor.execute(
            f"""
            SELECT * FROM estate_verification_applications
            {where}
            ORDER BY created_at DESC
            LIMIT 100
            """,
            tuple(params),
        )
        applications = []
        for row in cursor.fetchall():
            documents = get_application_documents(cursor, row["id"])
            applications.append(serialize_application(row, documents))

    return success({"applications": applications})


@admin_bp.get("/verification/applications/<int:application_id>")
@require_roles("admin", "super_admin")
def get_verification_application(current_user, application_id):
    with db_cursor() as cursor:
        cursor.execute("SELECT * FROM estate_verification_applications WHERE id = %s", (application_id,))
        application = cursor.fetchone()

        if not application:
            return error("NOT_FOUND", "Verification application was not found.", 404)

        documents = get_application_documents(cursor, application_id)

    return success({"application": serialize_application(application, documents)})


@admin_bp.patch("/verification/applications/<int:application_id>/status")
@require_roles("admin", "super_admin")
def update_verification_status(current_user, application_id):
    payload = request.get_json(silent=True) or {}
    status = payload.get("status")
    admin_note = (payload.get("adminNote") or "").strip() or None

    if status not in ALLOWED_REVIEW_STATUSES:
        return error("VALIDATION_ERROR", "Review status is not supported.", 422)

    with db_cursor(commit=True) as cursor:
        cursor.execute("SELECT * FROM estate_verification_applications WHERE id = %s", (application_id,))
        application = cursor.fetchone()

        if not application:
            return error("NOT_FOUND", "Verification application was not found.", 404)

        cursor.execute(
            """
            UPDATE estate_verification_applications
            SET status = %s,
                admin_note = %s,
                reviewed_by = %s,
                reviewed_at = CURRENT_TIMESTAMP
            WHERE id = %s
            """,
            (status, admin_note, current_user["id"], application_id),
        )

        if status == "approved":
            # Approval is also the point at which an estate manager account
            # becomes active. Without this update the profile can continue to
            # display "pending" even though the application and estate are
            # already approved.
            cursor.execute(
                "UPDATE users SET account_status = 'active' WHERE id = %s AND account_status = 'pending'",
                (application["user_id"],),
            )
            cursor.execute(
                """
                INSERT INTO estates
                  (manager_user_id, verification_application_id, name, location, status, is_published)
                VALUES (%s, %s, %s, %s, 'approved', 0)
                ON DUPLICATE KEY UPDATE updated_at = CURRENT_TIMESTAMP
                """,
                (
                    application["user_id"],
                    application_id,
                    application["estate_name"],
                    application["estate_location"],
                ),
            )

        cursor.execute(
            """
            INSERT INTO audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
            VALUES (%s, %s, %s, %s, JSON_OBJECT('status', %s, 'adminNote', %s))
            """,
            (current_user["id"], "verification.status_updated", "estate_verification_application", application_id, status, admin_note),
        )
        cursor.execute("SELECT * FROM estate_verification_applications WHERE id = %s", (application_id,))
        updated = cursor.fetchone()
        documents = get_application_documents(cursor, application_id)

    return success({"application": serialize_application(updated, documents)}, "Verification status updated")


@admin_bp.delete("/verification/applications/<int:application_id>")
@require_roles("admin", "super_admin")
def delete_verification_application(current_user, application_id):
    """
    Deletes a verification application that was never approved — drafts, pending
    reviews, rejected, or additional-info-required submissions. Once approved, an
    application has a real estate record built from it (see
    update_verification_status above), so deleting it here is blocked; use estate
    hard-delete for an approved estate instead. Removes the uploaded vault files
    for this application's documents too, not just the database rows.
    """
    payload = request.get_json(silent=True) or {}
    if payload.get("confirm") is not True:
        return error(
            "CONFIRMATION_REQUIRED",
            "Deleting a verification application is permanent. Resend the request with confirm: true.",
            422,
        )

    with db_cursor(commit=True) as cursor:
        cursor.execute("SELECT * FROM estate_verification_applications WHERE id = %s LIMIT 1", (application_id,))
        application = cursor.fetchone()
        if not application:
            return error("NOT_FOUND", "Verification application was not found.", 404)
        if application["status"] == "approved":
            return error(
                "FORBIDDEN",
                "This application has already been approved and has a live estate. Delete the estate instead if you want to remove it.",
                403,
            )

        cursor.execute("SELECT * FROM verification_documents WHERE application_id = %s", (application_id,))
        documents = cursor.fetchall()

        cursor.execute("DELETE FROM estate_verification_applications WHERE id = %s", (application_id,))

        record_audit_log(
            cursor,
            current_user["id"],
            "verification.application_deleted",
            entity_type="estate_verification_application",
            entity_id=application_id,
            metadata={
                "estateName": application["estate_name"],
                "status": application["status"],
                "documentCount": len(documents),
            },
        )

    for document in documents:
        document_path = document_path_from_url(document["file_url"])
        if document_path:
            try:
                document_path.unlink(missing_ok=True)
            except OSError:
                pass

    return success({}, "Verification application deleted")


# --- Staff (reviewer/admin) account management. Master Owner (super_admin) only. ---


@admin_bp.get("/staff")
@require_roles("super_admin")
def list_staff(current_user):
    with db_cursor() as cursor:
        cursor.execute(
            """
            SELECT id, full_name, email, phone, role, account_status, created_at, updated_at
            FROM users
            WHERE role IN ('admin', 'super_admin')
            ORDER BY created_at DESC
            """
        )
        staff = [serialize_user(row) for row in cursor.fetchall()]

    return success({"staff": staff})


@admin_bp.post("/staff")
@require_roles("super_admin")
def create_staff(current_user):
    payload = request.get_json(silent=True) or {}
    full_name = (payload.get("fullName") or "").strip()
    email = (payload.get("email") or "").strip().lower()
    password = (payload.get("password") or "").strip()

    if not full_name or not email:
        return error("VALIDATION_ERROR", "Full name and email are required.", 422)

    generated_password = None
    if not password:
        generated_password = generate_temp_password()
        password = generated_password
    elif len(password) < 8:
        return error("VALIDATION_ERROR", "Password must be at least 8 characters.", 422)

    with db_cursor(commit=True) as cursor:
        cursor.execute("SELECT id FROM users WHERE email = %s LIMIT 1", (email,))
        if cursor.fetchone():
            return error("EMAIL_EXISTS", "An account with this email already exists.", 409)

        cursor.execute(
            """
            INSERT INTO users (full_name, email, password_hash, role, account_status)
            VALUES (%s, %s, %s, 'admin', 'active')
            """,
            (full_name, email, hash_password(password)),
        )
        staff_id = cursor.lastrowid

        record_audit_log(
            cursor,
            current_user["id"],
            "staff.created",
            entity_type="user",
            entity_id=staff_id,
            metadata={"email": email},
        )

        cursor.execute("SELECT * FROM users WHERE id = %s", (staff_id,))
        staff_user = cursor.fetchone()

    response = {"user": serialize_user(staff_user)}
    if generated_password:
        response["generatedPassword"] = generated_password

    return success(response, "Staff account created", 201)


@admin_bp.delete("/staff/<int:staff_id>")
@require_roles("super_admin")
def delete_staff(current_user, staff_id):
    if staff_id == current_user["id"]:
        return error("FORBIDDEN", "You cannot delete your own account.", 403)

    with db_cursor(commit=True) as cursor:
        cursor.execute("SELECT * FROM users WHERE id = %s LIMIT 1", (staff_id,))
        staff_user = cursor.fetchone()
        if not staff_user:
            return error("NOT_FOUND", "Staff account was not found.", 404)
        if staff_user["role"] == "super_admin":
            return error("FORBIDDEN", "Master Owner accounts cannot be deleted from this panel.", 403)
        if staff_user["role"] != "admin":
            return error("VALIDATION_ERROR", "Only staff admin accounts can be removed here.", 422)

        cursor.execute("DELETE FROM users WHERE id = %s", (staff_id,))
        record_audit_log(
            cursor,
            current_user["id"],
            "staff.deleted",
            entity_type="user",
            entity_id=staff_id,
            metadata={"email": staff_user["email"]},
        )

    return success({}, "Staff account removed")


# --- Audit log visibility (Master Owner and staff reviewers). ---


@admin_bp.get("/audit-logs")
@require_roles("admin", "super_admin")
def list_audit_logs(current_user):
    action_prefix = request.args.get("action")
    limit = min(int(request.args.get("limit", 200) or 200), 500)

    where = []
    params = []
    if action_prefix:
        where.append("al.action LIKE %s")
        params.append(f"{action_prefix}%")

    where_sql = f"WHERE {' AND '.join(where)}" if where else ""

    with db_cursor() as cursor:
        cursor.execute(
            f"""
            SELECT al.*, u.full_name AS actor_name, u.email AS actor_email
            FROM audit_logs al
            LEFT JOIN users u ON u.id = al.actor_user_id
            {where_sql}
            ORDER BY al.created_at DESC
            LIMIT %s
            """,
            tuple(params) + (limit,),
        )
        rows = cursor.fetchall()

    logs = [
        {
            "id": row["id"],
            "actorUserId": row["actor_user_id"],
            "actorName": row.get("actor_name"),
            "actorEmail": row.get("actor_email"),
            "action": row["action"],
            "entityType": row.get("entity_type"),
            "entityId": row.get("entity_id"),
            "metadata": row.get("metadata"),
            "createdAt": row.get("created_at"),
        }
        for row in rows
    ]

    return success({"auditLogs": logs})
