from flask import Blueprint, request

from ..db import db_cursor
from ..routes.estates import can_manage_estate, get_estate
from ..utils.audit import record_audit_log
from ..utils.authz import require_roles
from ..utils.responses import error, success

residents_bp = Blueprint("residents", __name__)

RESIDENT_STATUSES = {"pending", "verified", "active", "suspended", "moved_out"}


def serialize_resident(row):
    return {
        "id": row["id"],
        "estateId": row["estate_id"],
        "propertyId": row.get("property_id"),
        "fullName": row["full_name"],
        "phone": row.get("phone"),
        "email": row.get("email"),
        "identityType": row.get("identity_type"),
        "identityNumber": row.get("identity_number"),
        "status": row["status"],
        "note": row.get("note"),
        "createdAt": row.get("created_at"),
    }


@residents_bp.get("/estates/<int:estate_id>/residents")
@require_roles("estate_manager", "admin", "super_admin")
def list_residents(current_user, estate_id):
    with db_cursor() as cursor:
        estate = get_estate(cursor, estate_id)
        if not estate:
            return error("NOT_FOUND", "Estate was not found.", 404)
        if not can_manage_estate(current_user, estate):
            return error("FORBIDDEN", "You cannot access residents for this estate.", 403)

        cursor.execute(
            "SELECT * FROM residents WHERE estate_id = %s ORDER BY created_at DESC LIMIT 200",
            (estate_id,),
        )
        residents = [serialize_resident(row) for row in cursor.fetchall()]

    return success({"residents": residents})


@residents_bp.post("/estates/<int:estate_id>/residents")
@require_roles("estate_manager", "admin", "super_admin")
def create_resident(current_user, estate_id):
    payload = request.get_json(silent=True) or {}
    full_name = (payload.get("fullName") or "").strip()

    if not full_name:
        return error("VALIDATION_ERROR", "Resident full name is required.", 422)

    with db_cursor(commit=True) as cursor:
        estate = get_estate(cursor, estate_id)
        if not estate:
            return error("NOT_FOUND", "Estate was not found.", 404)
        if not can_manage_estate(current_user, estate):
            return error("FORBIDDEN", "You cannot add residents to this estate.", 403)

        cursor.execute(
            """
            INSERT INTO residents
              (estate_id, property_id, full_name, phone, email, identity_type, identity_number, status, created_by)
            VALUES (%s, %s, %s, %s, %s, %s, %s, 'pending', %s)
            """,
            (
                estate_id,
                payload.get("propertyId") or None,
                full_name,
                (payload.get("phone") or "").strip() or None,
                (payload.get("email") or "").strip() or None,
                (payload.get("identityType") or "").strip() or None,
                (payload.get("identityNumber") or "").strip() or None,
                current_user["id"],
            ),
        )
        resident_id = cursor.lastrowid
        cursor.execute("SELECT * FROM residents WHERE id = %s", (resident_id,))
        resident = cursor.fetchone()

        record_audit_log(cursor, current_user["id"], "resident.created", "resident", resident_id, {"estateId": estate_id})

    return success({"resident": serialize_resident(resident)}, "Resident added", 201)


@residents_bp.patch("/estates/<int:estate_id>/residents/<int:resident_id>/status")
@require_roles("estate_manager", "admin", "super_admin")
def update_resident_status(current_user, estate_id, resident_id):
    payload = request.get_json(silent=True) or {}
    next_status = payload.get("status")
    note = (payload.get("note") or "").strip() or None

    if next_status not in RESIDENT_STATUSES:
        return error("VALIDATION_ERROR", "Resident status is not supported.", 422)

    with db_cursor(commit=True) as cursor:
        estate = get_estate(cursor, estate_id)
        if not estate:
            return error("NOT_FOUND", "Estate was not found.", 404)
        if not can_manage_estate(current_user, estate):
            return error("FORBIDDEN", "You cannot update residents for this estate.", 403)

        cursor.execute(
            "SELECT * FROM residents WHERE id = %s AND estate_id = %s LIMIT 1",
            (resident_id, estate_id),
        )
        resident = cursor.fetchone()
        if not resident:
            return error("NOT_FOUND", "Resident was not found.", 404)

        cursor.execute(
            "UPDATE residents SET status = %s, note = %s WHERE id = %s",
            (next_status, note, resident_id),
        )
        cursor.execute("SELECT * FROM residents WHERE id = %s", (resident_id,))
        updated = cursor.fetchone()

        record_audit_log(
            cursor,
            current_user["id"],
            "resident.status_updated",
            "resident",
            resident_id,
            {"status": next_status, "note": note},
        )

    return success({"resident": serialize_resident(updated)}, "Resident status updated")
