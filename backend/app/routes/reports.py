from flask import Blueprint, request

from ..db import db_cursor
from ..utils.audit import record_audit_log
from ..utils.authz import require_roles
from ..utils.crypto import decrypt_json, encrypt_json
from ..utils.notify import create_notification, flush_push_queue, queue_push
from ..utils.responses import error, success

reports_bp = Blueprint("reports", __name__)

REPORT_CATEGORIES = {
    "false_estate_information",
    "suspicious_documents",
    "fraud_concern",
    "misrepresentation",
    "other_violation",
}

ADMIN_ACTION_STATUSES = {
    "under_review",
    "additional_info_required",
    "dismissed",
    "escalated",
    "estate_suspended",
    "estate_removed",
}


def serialize_report(row):
    description = row["description"]
    if row.get("encrypted_payload"):
        try:
            description = decrypt_json(row["encrypted_payload"], f"estate-report:{row['id']}").get("description", description)
        except Exception:
            pass

    return {
        "id": row["id"],
        "estateId": row.get("estate_id"),
        "propertyId": row.get("property_id"),
        "reporterUserId": row.get("reporter_user_id"),
        "reporterName": row.get("reporter_name"),
        "reporterContact": row.get("reporter_contact"),
        "category": row["category"],
        "description": description,
        "attachmentUrl": row.get("attachment_url"),
        "status": row["status"],
        "adminNote": row.get("admin_note"),
        "reviewedBy": row.get("reviewed_by"),
        "reviewedAt": row.get("reviewed_at"),
        "createdAt": row.get("created_at"),
    }


@reports_bp.post("")
def create_estate_report():
    payload = request.get_json(silent=True) or {}
    category = payload.get("category")
    description = (payload.get("description") or "").strip()

    if category not in REPORT_CATEGORIES:
        return error("VALIDATION_ERROR", "Report category is not supported.", 422)
    if not description:
        return error("VALIDATION_ERROR", "Report description is required.", 422)

    with db_cursor(commit=True) as cursor:
        cursor.execute(
            """
            INSERT INTO estate_reports
              (estate_id, property_id, reporter_user_id, reporter_name, reporter_contact,
               category, description, attachment_url)
            VALUES (%s, %s, NULL, %s, %s, %s, %s, %s)
            """,
            (
                payload.get("estateId") or None,
                payload.get("propertyId") or None,
                (payload.get("reporterName") or "").strip() or None,
                (payload.get("reporterContact") or "").strip() or None,
                category,
                "[encrypted]",
                payload.get("attachmentUrl") or None,
            ),
        )
        report_id = cursor.lastrowid
        cursor.execute(
            "UPDATE estate_reports SET encrypted_payload = %s WHERE id = %s",
            (encrypt_json({"description": description}, f"estate-report:{report_id}"), report_id),
        )
        cursor.execute("SELECT * FROM estate_reports WHERE id = %s", (report_id,))
        report = cursor.fetchone()

        create_notification(
            cursor,
            role="admin",
            title="New estate report",
            body=f"A {category.replace('_', ' ')} report was submitted and needs review.",
            type="report",
            entity_type="estate_report",
            entity_id=report_id,
        )
        queue_push(
            role="admin",
            title="New estate report",
            body=f"A {category.replace('_', ' ')} report was submitted and needs review.",
            data={"type": "report", "entityType": "estate_report", "entityId": report_id},
        )

    flush_push_queue()
    return success({"report": serialize_report(report)}, "Estate report submitted", 201)


@reports_bp.get("")
@require_roles("admin", "super_admin")
def list_estate_reports(current_user):
    status = request.args.get("status")
    params = []
    where = ""

    if status:
        where = "WHERE status = %s"
        params.append(status)

    with db_cursor() as cursor:
        cursor.execute(
            f"SELECT * FROM estate_reports {where} ORDER BY created_at DESC LIMIT 200",
            tuple(params),
        )
        reports = [serialize_report(row) for row in cursor.fetchall()]

    return success({"reports": reports})


@reports_bp.patch("/<int:report_id>/status")
@require_roles("admin", "super_admin")
def update_estate_report_status(current_user, report_id):
    payload = request.get_json(silent=True) or {}
    status = payload.get("status")
    admin_note = (payload.get("adminNote") or "").strip() or None

    if status not in ADMIN_ACTION_STATUSES:
        return error("VALIDATION_ERROR", "Report action is not supported.", 422)

    with db_cursor(commit=True) as cursor:
        cursor.execute("SELECT * FROM estate_reports WHERE id = %s", (report_id,))
        report = cursor.fetchone()
        if not report:
            return error("NOT_FOUND", "Estate report was not found.", 404)

        cursor.execute(
            """
            UPDATE estate_reports
            SET status = %s, admin_note = %s, reviewed_by = %s, reviewed_at = CURRENT_TIMESTAMP
            WHERE id = %s
            """,
            (status, admin_note, current_user["id"], report_id),
        )

        if report.get("estate_id") and status == "estate_suspended":
            cursor.execute(
                "UPDATE estates SET status = 'suspended', is_published = 0 WHERE id = %s",
                (report["estate_id"],),
            )
        elif report.get("estate_id") and status == "estate_removed":
            cursor.execute(
                "UPDATE estates SET status = 'removed', is_published = 0 WHERE id = %s",
                (report["estate_id"],),
            )

        record_audit_log(
            cursor,
            current_user["id"],
            "estate_report.status_updated",
            "estate_report",
            report_id,
            {"status": status, "estateId": report.get("estate_id")},
        )

        # Close the loop with whoever filed the report (only possible for
        # signed-in reporters; public/anonymous reports have reporter_user_id
        # NULL by design).
        if report.get("reporter_user_id"):
            create_notification(
                cursor,
                user_id=report["reporter_user_id"],
                title="Report update",
                body=f"Your report status changed to '{status.replace('_', ' ')}'."
                + (f" Admin note: {admin_note}" if admin_note else ""),
                type="report",
                entity_type="estate_report",
                entity_id=report_id,
            )
            queue_push(
                [report["reporter_user_id"]],
                title="Report update",
                body=f"Your report status changed to '{status.replace('_', ' ')}'.",
                data={"type": "report", "entityType": "estate_report", "entityId": report_id},
            )

        cursor.execute("SELECT * FROM estate_reports WHERE id = %s", (report_id,))
        updated = cursor.fetchone()

    flush_push_queue()
    return success({"report": serialize_report(updated)}, "Report status updated")
