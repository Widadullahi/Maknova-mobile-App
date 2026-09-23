from flask import Blueprint, request

from ..db import db_cursor
from ..utils.audit import record_audit_log
from ..utils.authz import require_roles
from ..utils.crypto import decrypt_json, encrypt_json
from ..utils.responses import error, success
from ..utils.scope import can_access_estate

maintenance_bp = Blueprint("maintenance", __name__)

STATUSES = {"open", "assigned", "in_progress", "resolved", "closed"}
PRIORITIES = {"low", "medium", "high", "urgent"}


def serialize_provider(row):
    return {
        "id": row["id"],
        "estateId": row.get("estate_id"),
        "name": row["name"],
        "category": row["category"],
        "phone": row.get("phone"),
        "rating": float(row.get("rating") or 0),
        "availability": row["availability"],
    }


def serialize_request(row):
    description = row["description"]
    if row.get("encrypted_payload"):
        try:
            description = decrypt_json(row["encrypted_payload"], f"maintenance-request:{row['id']}").get("description", description)
        except Exception:
            pass

    return {
        "id": row["id"],
        "estateId": row.get("estate_id"),
        "residentUserId": row.get("resident_user_id"),
        "propertyId": row.get("property_id"),
        "providerId": row.get("provider_id"),
        "title": row["title"],
        "category": row["category"],
        "description": description,
        "priority": row["priority"],
        "status": row["status"],
        "preferredTime": row.get("preferred_time"),
        "attachmentUrl": row.get("attachment_url"),
        "createdBy": row.get("created_by"),
        "createdAt": row.get("created_at"),
    }


def serialize_update(row):
    return {
        "id": row["id"],
        "requestId": row["request_id"],
        "authorUserId": row.get("author_user_id"),
        "status": row.get("status"),
        "note": row["note"],
        "createdAt": row.get("created_at"),
    }


@maintenance_bp.get("/providers")
@require_roles("resident", "estate_manager", "admin", "super_admin")
def list_providers(current_user):
    category = request.args.get("category")
    params = []
    where = ""
    if category:
        where = "WHERE category = %s"
        params.append(category)

    with db_cursor() as cursor:
        cursor.execute(
            f"SELECT * FROM service_providers {where} ORDER BY rating DESC, name ASC LIMIT 100",
            tuple(params),
        )
        providers = [serialize_provider(row) for row in cursor.fetchall()]

    return success({"providers": providers})


@maintenance_bp.post("/providers")
@require_roles("estate_manager", "admin", "super_admin")
def create_provider(current_user):
    payload = request.get_json(silent=True) or {}
    name = (payload.get("name") or "").strip()
    category = (payload.get("category") or "").strip()

    if not name or not category:
        return error("VALIDATION_ERROR", "Provider name and category are required.", 422)

    with db_cursor(commit=True) as cursor:
        cursor.execute(
            """
            INSERT INTO service_providers (estate_id, name, category, phone, rating, availability)
            VALUES (%s, %s, %s, %s, %s, %s)
            """,
            (
                payload.get("estateId") or None,
                name,
                category,
                payload.get("phone") or None,
                payload.get("rating") or 0,
                payload.get("availability") or "available",
            ),
        )
        provider_id = cursor.lastrowid
        cursor.execute("SELECT * FROM service_providers WHERE id = %s", (provider_id,))
        provider = cursor.fetchone()

    return success({"provider": serialize_provider(provider)}, "Provider created", 201)


@maintenance_bp.get("/requests")
@require_roles("resident", "estate_manager", "admin", "super_admin")
def list_requests(current_user):
    with db_cursor() as cursor:
        if current_user["role"] == "resident":
            cursor.execute(
                "SELECT * FROM maintenance_requests WHERE created_by = %s ORDER BY created_at DESC LIMIT 100",
                (current_user["id"],),
            )
        elif current_user["role"] == "estate_manager":
            cursor.execute(
                """
                SELECT maintenance_requests.*
                FROM maintenance_requests
                INNER JOIN estates ON estates.id = maintenance_requests.estate_id
                WHERE estates.manager_user_id = %s
                ORDER BY maintenance_requests.created_at DESC
                LIMIT 200
                """,
                (current_user["id"],),
            )
        else:
            cursor.execute("SELECT * FROM maintenance_requests ORDER BY created_at DESC LIMIT 200")
        requests = [serialize_request(row) for row in cursor.fetchall()]

    return success({"requests": requests})


@maintenance_bp.get("/requests/<int:request_id>")
@require_roles("resident", "estate_manager", "admin", "super_admin")
def get_request(current_user, request_id):
    with db_cursor() as cursor:
        cursor.execute("SELECT * FROM maintenance_requests WHERE id = %s", (request_id,))
        maintenance_request = cursor.fetchone()
        if not maintenance_request:
            return error("NOT_FOUND", "Maintenance request was not found.", 404)
        if current_user["role"] == "resident" and maintenance_request.get("created_by") != current_user["id"]:
            return error("FORBIDDEN", "You cannot view this maintenance request.", 403)
        if current_user["role"] == "estate_manager" and maintenance_request.get("estate_id") and not can_access_estate(cursor, current_user, maintenance_request["estate_id"]):
            return error("FORBIDDEN", "You cannot view this maintenance request.", 403)

        cursor.execute(
            "SELECT * FROM maintenance_updates WHERE request_id = %s ORDER BY created_at ASC, id ASC",
            (request_id,),
        )
        updates = [serialize_update(row) for row in cursor.fetchall()]

    return success({"request": serialize_request(maintenance_request), "updates": updates})


@maintenance_bp.post("/requests")
@require_roles("resident", "estate_manager", "admin", "super_admin")
def create_request(current_user):
    payload = request.get_json(silent=True) or {}
    title = (payload.get("title") or "").strip()
    category = (payload.get("category") or "").strip()
    description = (payload.get("description") or "").strip()
    priority = payload.get("priority") or "medium"

    if priority not in PRIORITIES:
        return error("VALIDATION_ERROR", "Priority is not supported.", 422)
    if not title or not category or not description:
        return error("VALIDATION_ERROR", "Title, category, and description are required.", 422)

    with db_cursor(commit=True) as cursor:
        estate_id = payload.get("estateId") or None
        if estate_id and not can_access_estate(cursor, current_user, estate_id):
            return error("FORBIDDEN", "You cannot create requests for this estate.", 403)
        cursor.execute(
            """
            INSERT INTO maintenance_requests
              (estate_id, resident_user_id, property_id, provider_id, title, category,
               description, priority, status, preferred_time, attachment_url, created_by)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, 'open', %s, %s, %s)
            """,
            (
                estate_id,
                payload.get("residentUserId") or None,
                payload.get("propertyId") or None,
                payload.get("providerId") or None,
                title,
                category,
                "[encrypted]",
                priority,
                payload.get("preferredTime") or None,
                payload.get("attachmentUrl") or None,
                current_user["id"],
            ),
        )
        request_id = cursor.lastrowid
        cursor.execute(
            "UPDATE maintenance_requests SET encrypted_payload = %s WHERE id = %s",
            (encrypt_json({"description": description}, f"maintenance-request:{request_id}"), request_id),
        )
        cursor.execute(
            "INSERT INTO maintenance_updates (request_id, author_user_id, status, note) VALUES (%s, %s, 'open', 'Request opened')",
            (request_id, current_user["id"]),
        )
        cursor.execute("SELECT * FROM maintenance_requests WHERE id = %s", (request_id,))
        maintenance_request = cursor.fetchone()

    return success({"request": serialize_request(maintenance_request)}, "Maintenance request created", 201)


@maintenance_bp.patch("/requests/<int:request_id>")
@require_roles("estate_manager", "admin", "super_admin")
def update_request_status(current_user, request_id):
    payload = request.get_json(silent=True) or {}
    status = payload.get("status")
    note = (payload.get("note") or "").strip() or "Status updated"

    if status not in STATUSES:
        return error("VALIDATION_ERROR", "Maintenance status is not supported.", 422)

    with db_cursor(commit=True) as cursor:
        cursor.execute("SELECT * FROM maintenance_requests WHERE id = %s", (request_id,))
        maintenance_request = cursor.fetchone()
        if not maintenance_request:
            return error("NOT_FOUND", "Maintenance request was not found.", 404)
        if current_user["role"] == "estate_manager" and maintenance_request.get("estate_id") and not can_access_estate(cursor, current_user, maintenance_request["estate_id"]):
            return error("FORBIDDEN", "You cannot update this maintenance request.", 403)

        cursor.execute(
            "UPDATE maintenance_requests SET status = %s, provider_id = COALESCE(%s, provider_id) WHERE id = %s",
            (status, payload.get("providerId") or None, request_id),
        )
        cursor.execute(
            "INSERT INTO maintenance_updates (request_id, author_user_id, status, note) VALUES (%s, %s, %s, %s)",
            (request_id, current_user["id"], status, note),
        )
        record_audit_log(
            cursor,
            current_user["id"],
            "maintenance.status_updated",
            "maintenance_request",
            request_id,
            {"status": status, "providerId": payload.get("providerId")},
        )
        cursor.execute("SELECT * FROM maintenance_requests WHERE id = %s", (request_id,))
        updated = cursor.fetchone()

    return success({"request": serialize_request(updated)}, "Maintenance request updated")


@maintenance_bp.post("/requests/<int:request_id>/updates")
@require_roles("resident", "estate_manager", "admin", "super_admin")
def add_request_update(current_user, request_id):
    payload = request.get_json(silent=True) or {}
    note = (payload.get("note") or "").strip()
    status = payload.get("status")

    if not note:
        return error("VALIDATION_ERROR", "Update note is required.", 422)
    if status and status not in STATUSES:
        return error("VALIDATION_ERROR", "Maintenance status is not supported.", 422)

    with db_cursor(commit=True) as cursor:
        cursor.execute("SELECT * FROM maintenance_requests WHERE id = %s", (request_id,))
        maintenance_request = cursor.fetchone()
        if not maintenance_request:
            return error("NOT_FOUND", "Maintenance request was not found.", 404)
        if current_user["role"] == "resident" and maintenance_request.get("created_by") != current_user["id"]:
            return error("FORBIDDEN", "You cannot update this maintenance request.", 403)
        if current_user["role"] == "estate_manager" and maintenance_request.get("estate_id") and not can_access_estate(cursor, current_user, maintenance_request["estate_id"]):
            return error("FORBIDDEN", "You cannot update this maintenance request.", 403)

        if status:
            cursor.execute("UPDATE maintenance_requests SET status = %s WHERE id = %s", (status, request_id))
        cursor.execute(
            "INSERT INTO maintenance_updates (request_id, author_user_id, status, note) VALUES (%s, %s, %s, %s)",
            (request_id, current_user["id"], status, note),
        )
        record_audit_log(
            cursor,
            current_user["id"],
            "maintenance.update_added",
            "maintenance_request",
            request_id,
            {"status": status},
        )
        update_id = cursor.lastrowid
        cursor.execute("SELECT * FROM maintenance_updates WHERE id = %s", (update_id,))
        update = cursor.fetchone()

    return success({"update": serialize_update(update)}, "Maintenance update added", 201)
