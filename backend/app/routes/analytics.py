import csv
import io
import json

from flask import Blueprint, Response, request

from ..db import db_cursor
from ..utils.authz import require_roles
from ..utils.responses import success
from ..utils.scope import get_user_estate_ids

analytics_bp = Blueprint("analytics", __name__)


def count_table(cursor, table_name, where=""):
    cursor.execute(f"SELECT COUNT(*) AS count FROM {table_name} {where}")
    return cursor.fetchone()["count"]


@analytics_bp.get("/summary")
@require_roles("estate_manager", "admin", "super_admin")
def analytics_summary(current_user):
    with db_cursor() as cursor:
        estate_ids = get_user_estate_ids(cursor, current_user)
        estate_filter = ""
        estate_params = ()
        if estate_ids is not None:
            if not estate_ids:
                return success({"summary": {}})
            placeholders = ", ".join(["%s"] * len(estate_ids))
            estate_filter = f" WHERE estate_id IN ({placeholders})"
            estate_params = tuple(estate_ids)

        summary = {
            "users": count_table(cursor, "users"),
            "estates": len(estate_ids) if estate_ids is not None else count_table(cursor, "estates"),
            "properties": 0,
            "availableProperties": 0,
            "soldProperties": 0,
            "allocatedProperties": 0,
            "residents": count_table(cursor, "residents"),
            "visitorPasses": 0,
            "maintenanceOpen": 0,
            "estateReports": 0,
            "pendingVerifications": 0,
            "suspendedEstates": 0,
            "subscriptionRevenue": 0.0,
        }
        # Pending manager verifications. Scoped to the manager's own application
        # for non-admin accounts; global for admins.
        if estate_ids is None:
            summary["pendingVerifications"] = count_table(cursor, "estate_verification_applications", "WHERE status = 'pending_review'")
        else:
            cursor.execute(
                "SELECT COUNT(*) AS count FROM estate_verification_applications WHERE user_id = %s AND status = 'pending_review'",
                (current_user["id"],),
            )
            summary["pendingVerifications"] = cursor.fetchone()["count"]
        if estate_ids is None:
            summary["suspendedEstates"] = count_table(cursor, "estates", "WHERE status = 'suspended'")
        else:
            cursor.execute(f"SELECT COUNT(*) AS count FROM estates{estate_filter} AND status = 'suspended'", estate_params)
            summary["suspendedEstates"] = cursor.fetchone()["count"]
        if estate_ids is None:
            summary["properties"] = count_table(cursor, "properties")
            summary["availableProperties"] = count_table(cursor, "properties", "WHERE status = 'available'")
            summary["soldProperties"] = count_table(cursor, "properties", "WHERE status = 'sold'")
            summary["allocatedProperties"] = count_table(cursor, "properties", "WHERE status = 'allocated'")
            summary["visitorPasses"] = count_table(cursor, "visitor_passes")
            summary["maintenanceOpen"] = count_table(cursor, "maintenance_requests", "WHERE status IN ('open', 'assigned', 'in_progress')")
            summary["estateReports"] = count_table(cursor, "estate_reports")
        else:
            cursor.execute(f"SELECT COUNT(*) AS count FROM properties{estate_filter}", estate_params)
            summary["properties"] = cursor.fetchone()["count"]
            cursor.execute(f"SELECT COUNT(*) AS count FROM properties{estate_filter} AND status = 'available'", estate_params)
            summary["availableProperties"] = cursor.fetchone()["count"]
            cursor.execute(f"SELECT COUNT(*) AS count FROM properties{estate_filter} AND status = 'sold'", estate_params)
            summary["soldProperties"] = cursor.fetchone()["count"]
            cursor.execute(f"SELECT COUNT(*) AS count FROM properties{estate_filter} AND status = 'allocated'", estate_params)
            summary["allocatedProperties"] = cursor.fetchone()["count"]
            cursor.execute(f"SELECT COUNT(*) AS count FROM visitor_passes{estate_filter}", estate_params)
            summary["visitorPasses"] = cursor.fetchone()["count"]
            cursor.execute(f"SELECT COUNT(*) AS count FROM maintenance_requests{estate_filter} AND status IN ('open', 'assigned', 'in_progress')", estate_params)
            summary["maintenanceOpen"] = cursor.fetchone()["count"]
            cursor.execute(f"SELECT COUNT(*) AS count FROM estate_reports{estate_filter}", estate_params)
            summary["estateReports"] = cursor.fetchone()["count"]

        cursor.execute("SELECT COALESCE(SUM(sale_price), 0) AS total FROM sales WHERE status IN ('active', 'completed')")
        summary["salesVolume"] = float(cursor.fetchone()["total"] or 0)

    return success({"summary": summary})


@analytics_bp.get("/visitor-history")
@require_roles("security", "estate_manager", "admin", "super_admin")
def visitor_history(current_user):
    with db_cursor() as cursor:
        estate_ids = get_user_estate_ids(cursor, current_user)
        estate_filter = ""
        params = ()
        if estate_ids is not None:
            if not estate_ids:
                return success({"statuses": [], "purposes": []})
            placeholders = ", ".join(["%s"] * len(estate_ids))
            estate_filter = f"WHERE estate_id IN ({placeholders})"
            params = tuple(estate_ids)
        cursor.execute(
            f"""
            SELECT status, COUNT(*) AS count
            FROM visitor_passes
            {estate_filter}
            GROUP BY status
            ORDER BY status
            """,
            params,
        )
        statuses = cursor.fetchall()

        cursor.execute(
            f"""
            SELECT purpose, COUNT(*) AS count
            FROM visitor_passes
            {estate_filter}
            GROUP BY purpose
            ORDER BY count DESC
            LIMIT 10
            """,
            params,
        )
        purposes = cursor.fetchall()

    return success({"statuses": statuses, "purposes": purposes})


@analytics_bp.get("/exports/<report_type>")
@require_roles("estate_manager", "admin", "super_admin")
def export_report(current_user, report_type):
    report_map = {
        "maintenance": ("maintenance_requests", ["id", "title", "category", "priority", "status", "created_at"]),
        "visitor-passes": ("visitor_passes", ["id", "code", "visitor_name", "purpose", "status", "created_at"]),
        "estate-reports": ("estate_reports", ["id", "category", "status", "created_at"]),
        "sales": ("sales", ["id", "estate_id", "property_id", "sale_price", "payment_status", "status", "created_at"]),
    }
    table_config = report_map.get(report_type)

    if not table_config:
        return success({"rows": [], "reportType": report_type})

    table_name, columns = table_config
    with db_cursor(commit=True) as cursor:
        cursor.execute(f"SELECT {', '.join(columns)} FROM {table_name} ORDER BY created_at DESC LIMIT 500")
        rows = cursor.fetchall()
        cursor.execute(
            """
            INSERT INTO analytics_exports (requested_by, report_type, format, filters_json)
            VALUES (%s, %s, %s, %s)
            """,
            (current_user["id"], report_type, request.args.get("format") or "json", json.dumps(dict(request.args))),
        )

    if request.args.get("format") == "csv":
        buffer = io.StringIO()
        writer = csv.DictWriter(buffer, fieldnames=columns)
        writer.writeheader()
        writer.writerows(rows)
        return Response(
            buffer.getvalue(),
            mimetype="text/csv",
            headers={"Content-Disposition": f"attachment; filename={report_type}.csv"},
        )

    return success({"reportType": report_type, "rows": rows})
