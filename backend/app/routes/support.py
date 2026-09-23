from flask import Blueprint, request

from ..db import db_cursor
from ..utils.audit import record_audit_log
from ..utils.authz import require_roles
from ..utils.responses import error, success
from ..utils.scope import can_access_estate, get_user_estate_ids

support_bp = Blueprint("support", __name__)


def serialize_ticket(row):
    return {
        "id": row["id"],
        "estateId": row.get("estate_id"),
        "estateName": row.get("estate_name"),
        "reporterUserId": row.get("reporter_user_id"),
        "reporterName": row.get("reporter_name"),
        "assignedTo": row.get("assigned_to"),
        "assignedName": row.get("assigned_name"),
        "subject": row["subject"],
        "category": row["category"],
        "priority": row["priority"],
        "status": row["status"],
        "description": row["description"],
        "adminNote": row.get("admin_note"),
        "createdAt": row.get("created_at"),
        "updatedAt": row.get("updated_at"),
    }


def scoped_where(cursor, current_user):
    estate_ids = get_user_estate_ids(cursor, current_user)
    if estate_ids is None:
        return "", []
    if current_user["role"] in ("resident", "buyer", "public_user"):
        return "WHERE t.reporter_user_id = %s", [current_user["id"]]
    if not estate_ids:
        return "WHERE 1 = 0", []
    placeholders = ", ".join(["%s"] * len(estate_ids))
    return f"WHERE t.estate_id IN ({placeholders})", list(estate_ids)


@support_bp.get("/tickets")
@require_roles("estate_manager", "admin", "super_admin", "resident", "buyer", "security", "public_user")
def list_tickets(current_user):
    status = request.args.get("status")
    search = (request.args.get("search") or "").strip()

    with db_cursor() as cursor:
        where_sql, params = scoped_where(cursor, current_user)
        clauses = []
        if where_sql:
            clauses.append(where_sql.replace("WHERE ", "", 1))
        if status:
            clauses.append("t.status = %s")
            params.append(status)
        if search:
            clauses.append("(t.subject LIKE %s OR t.category LIKE %s OR e.name LIKE %s)")
            needle = f"%{search}%"
            params.extend([needle, needle, needle])
        final_where = f"WHERE {' AND '.join(clauses)}" if clauses else ""

        cursor.execute(
            f"""
            SELECT
              t.*,
              e.name AS estate_name,
              reporter.full_name AS reporter_name,
              assignee.full_name AS assigned_name
            FROM support_tickets t
            LEFT JOIN estates e ON e.id = t.estate_id
            LEFT JOIN users reporter ON reporter.id = t.reporter_user_id
            LEFT JOIN users assignee ON assignee.id = t.assigned_to
            {final_where}
            ORDER BY t.created_at DESC
            LIMIT 500
            """,
            tuple(params),
        )
        tickets = [serialize_ticket(row) for row in cursor.fetchall()]

    return success({"tickets": tickets})


@support_bp.post("/tickets")
@require_roles("estate_manager", "admin", "super_admin", "resident", "buyer", "security", "public_user")
def create_ticket(current_user):
    payload = request.get_json(silent=True) or {}
    subject = (payload.get("subject") or "").strip()
    description = (payload.get("description") or "").strip()
    estate_id = payload.get("estateId")
    priority = payload.get("priority") or "medium"

    if not subject or not description:
        return error("VALIDATION_ERROR", "Subject and description are required.", 422)
    if priority not in ("low", "medium", "high", "urgent"):
        return error("VALIDATION_ERROR", "Priority is not supported.", 422)

    with db_cursor(commit=True) as cursor:
        if estate_id and not can_access_estate(cursor, current_user, estate_id):
            return error("FORBIDDEN", "You cannot create support tickets for this estate.", 403)

        cursor.execute(
            """
            INSERT INTO support_tickets
              (estate_id, reporter_user_id, subject, category, priority, description)
            VALUES (%s, %s, %s, %s, %s, %s)
            """,
            (
                estate_id or None,
                current_user["id"],
                subject,
                (payload.get("category") or "general").strip(),
                priority,
                description,
            ),
        )
        ticket_id = cursor.lastrowid
        record_audit_log(cursor, current_user["id"], "support.ticket_created", "support_ticket", ticket_id, {"estateId": estate_id})
        cursor.execute(
            """
            SELECT t.*, e.name AS estate_name, reporter.full_name AS reporter_name, assignee.full_name AS assigned_name
            FROM support_tickets t
            LEFT JOIN estates e ON e.id = t.estate_id
            LEFT JOIN users reporter ON reporter.id = t.reporter_user_id
            LEFT JOIN users assignee ON assignee.id = t.assigned_to
            WHERE t.id = %s
            """,
            (ticket_id,),
        )
        ticket = cursor.fetchone()

    return success({"ticket": serialize_ticket(ticket)}, "Support ticket created", 201)


@support_bp.patch("/tickets/<int:ticket_id>/status")
@require_roles("estate_manager", "admin", "super_admin")
def update_ticket_status(current_user, ticket_id):
    payload = request.get_json(silent=True) or {}
    status = payload.get("status")
    if status not in ("open", "assigned", "in_progress", "resolved", "closed"):
        return error("VALIDATION_ERROR", "Support ticket status is not supported.", 422)

    with db_cursor(commit=True) as cursor:
        cursor.execute("SELECT * FROM support_tickets WHERE id = %s LIMIT 1", (ticket_id,))
        ticket = cursor.fetchone()
        if not ticket:
            return error("NOT_FOUND", "Support ticket was not found.", 404)
        if ticket.get("estate_id") and not can_access_estate(cursor, current_user, ticket["estate_id"]):
            return error("FORBIDDEN", "You cannot manage this support ticket.", 403)

        cursor.execute(
            """
            UPDATE support_tickets
            SET status = %s, assigned_to = COALESCE(%s, assigned_to), admin_note = COALESCE(%s, admin_note)
            WHERE id = %s
            """,
            (status, payload.get("assignedTo"), (payload.get("adminNote") or "").strip() or None, ticket_id),
        )
        record_audit_log(
            cursor,
            current_user["id"],
            "support.ticket_status_updated",
            "support_ticket",
            ticket_id,
            {"previousStatus": ticket["status"], "nextStatus": status},
        )
        cursor.execute(
            """
            SELECT t.*, e.name AS estate_name, reporter.full_name AS reporter_name, assignee.full_name AS assigned_name
            FROM support_tickets t
            LEFT JOIN estates e ON e.id = t.estate_id
            LEFT JOIN users reporter ON reporter.id = t.reporter_user_id
            LEFT JOIN users assignee ON assignee.id = t.assigned_to
            WHERE t.id = %s
            """,
            (ticket_id,),
        )
        updated_ticket = cursor.fetchone()

    return success({"ticket": serialize_ticket(updated_ticket)})
