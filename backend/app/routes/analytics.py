import csv
import io
import json
from datetime import date, timedelta

from flask import Blueprint, Response, request

from ..db import db_cursor
from ..utils.authz import require_roles
from ..utils.responses import error, success
from ..utils.scope import get_user_estate_ids

analytics_bp = Blueprint("analytics", __name__)


def count_table(cursor, table_name, where=""):
    cursor.execute(f"SELECT COUNT(*) AS count FROM {table_name} {where}")
    return cursor.fetchone()["count"]


def _parse_date_arg(value, *, end=False):
    """Parses YYYY-MM-DD. `end=True` returns an exclusive upper bound (next day)
    so `to=2026-10-07` includes everything that happens on Oct 7."""
    if not value:
        return None
    try:
        parsed = date.fromisoformat(value)
    except ValueError:
        return None
    return parsed + timedelta(days=1) if end else parsed


@analytics_bp.get("/summary")
@require_roles("estate_manager", "admin", "super_admin")
def analytics_summary(current_user):
    """Dashboard summary. Optional filters:
    - from/to: inclusive YYYY-MM-DD range applied to created_at of each metric.
    - estateId: admins can narrow to one estate; non-admins can only pass one
      of the estates they already have access to.
    """
    from_date = _parse_date_arg(request.args.get("from"))
    to_date = _parse_date_arg(request.args.get("to"), end=True)
    estate_id_param = request.args.get("estateId", type=int)

    with db_cursor() as cursor:
        estate_ids = get_user_estate_ids(cursor, current_user)

        if estate_ids is None:
            # Admin: estateId filter narrows the whole dashboard to one estate.
            if estate_id_param:
                estate_ids = {estate_id_param}
        elif estate_id_param:
            if estate_id_param not in estate_ids:
                return error("FORBIDDEN", "You cannot access analytics for this estate.", 403)
            estate_ids = {estate_id_param}

        if estate_ids is not None and not estate_ids:
            return success({"summary": {}})

        estate_in = ""
        estate_params = []
        if estate_ids is not None:
            placeholders = ", ".join(["%s"] * len(estate_ids))
            estate_in = f"estate_id IN ({placeholders})"
            estate_params = list(estate_ids)

        date_clauses = []
        date_params = []
        if from_date:
            date_clauses.append("created_at >= %s")
            date_params.append(from_date)
        if to_date:
            date_clauses.append("created_at < %s")
            date_params.append(to_date)

        def filtered_where(estate_clause=True, with_dates=True):
            clauses, params = [], []
            if estate_clause and estate_in:
                clauses.append(estate_in)
                params.extend(estate_params)
            if with_dates:
                clauses.extend(date_clauses)
                params.extend(date_params)
            where = f" WHERE {' AND '.join(clauses)}" if clauses else ""
            return where, tuple(params)

        def count_filtered(table, extra="", *, estate_clause=True, with_dates=True):
            where, params = filtered_where(estate_clause=estate_clause, with_dates=with_dates)
            combined = f"{where} AND {extra}" if where and extra else (where or (f" WHERE {extra}" if extra else ""))
            cursor.execute(f"SELECT COUNT(*) AS count FROM {table}{combined}", params)
            return cursor.fetchone()["count"]

        summary = {
            "users": count_filtered("users", estate_clause=False),
            "estates": len(estate_ids) if estate_ids is not None else count_filtered("estates", estate_clause=False),
            "properties": 0,
            "availableProperties": 0,
            "soldProperties": 0,
            "allocatedProperties": 0,
            "residents": count_filtered("residents"),
            "visitorPasses": 0,
            "maintenanceOpen": 0,
            "estateReports": 0,
            "pendingVerifications": 0,
            "suspendedEstates": 0,
            "subscriptionRevenue": 0.0,
        }
        # Pending manager verifications. Scoped to the manager's own application
        # for non-admin accounts; global for admins. Current-state metric: date
        # filters do not apply.
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
            cursor.execute(
                f"SELECT COUNT(*) AS count FROM estates WHERE id IN ({placeholders}) AND status = 'suspended'",
                tuple(estate_params),
            )
            summary["suspendedEstates"] = cursor.fetchone()["count"]

        summary["properties"] = count_filtered("properties")
        summary["availableProperties"] = count_filtered("properties", "status = 'available'")
        summary["soldProperties"] = count_filtered("properties", "status = 'sold'")
        summary["allocatedProperties"] = count_filtered("properties", "status = 'allocated'")
        summary["visitorPasses"] = count_filtered("visitor_passes")
        summary["maintenanceOpen"] = count_filtered("maintenance_requests", "status IN ('open', 'assigned', 'in_progress')")
        summary["estateReports"] = count_filtered("estate_reports")

        where, params = filtered_where()
        sales_extra = "status IN ('active', 'completed')"
        combined = f"{where} AND {sales_extra}" if where else f" WHERE {sales_extra}"
        cursor.execute(f"SELECT COALESCE(SUM(sale_price), 0) AS total FROM sales{combined}", params)
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
