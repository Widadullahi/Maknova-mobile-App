import json
from datetime import datetime, timedelta
from uuid import uuid4

from flask import Blueprint, current_app, request

from ..db import db_cursor
from ..utils.audit import record_audit_log
from ..utils.authz import require_roles
from ..utils.notify import create_notification, queue_push
from ..utils.paystack import PaystackError, initialize_transaction
from ..utils.responses import error, success
from ..utils.settings import get_buyer_transaction_fee_percent, get_seller_commission_percent
from .sales import ensure_estate_access

installments_bp = Blueprint("installments", __name__)

DEFAULT_INSTALLMENTS = 4
MAX_INSTALLMENTS = 24
DUE_STATUSES = {"pending", "overdue"}


def serialize_installment(row):
    return {
        "id": row["id"],
        "planId": row["plan_id"],
        "dueDate": row["due_date"].isoformat() if row.get("due_date") else None,
        "amount": float(row["amount"] or 0),
        "status": row["status"],
        "paidAt": row.get("paid_at"),
    }


def build_plan_payload(cursor, plan):
    cursor.execute(
        "SELECT * FROM installments WHERE plan_id = %s ORDER BY due_date ASC, id ASC",
        (plan["id"],),
    )
    installments = [serialize_installment(row) for row in cursor.fetchall()]

    paid = [item for item in installments if item["status"] == "paid"]
    due = next((item for item in installments if item["status"] in DUE_STATUSES), None)
    paid_amount = round(sum(item["amount"] for item in paid), 2)

    return {
        "id": plan["id"],
        "saleId": plan["sale_id"],
        "estateId": plan["estate_id"],
        "buyerId": plan["buyer_id"],
        "totalAmount": float(plan["total_amount"] or 0),
        "installmentCount": plan["installment_count"],
        "amountPerInstallment": float(plan["amount_per_installment"] or 0),
        "status": plan["status"],
        "progress": {
            "paidCount": len(paid),
            "totalCount": len(installments),
            "paidAmount": paid_amount,
            "remainingAmount": float(plan["total_amount"] or 0) - paid_amount,
        },
        "nextDueDate": due["dueDate"] if due else None,
        "nextDueAmount": due["amount"] if due else 0,
        "installments": installments,
        "createdAt": plan.get("created_at"),
    }


@installments_bp.post("/plans")
@require_roles("estate_manager", "admin", "super_admin")
def create_installment_plan(current_user):
    payload = request.get_json(silent=True) or {}
    sale_id = payload.get("saleId")
    try:
        installment_count = int(payload.get("installmentCount") or DEFAULT_INSTALLMENTS)
    except (TypeError, ValueError):
        return error("VALIDATION_ERROR", "installmentCount must be a number.", 422)
    if not 2 <= installment_count <= MAX_INSTALLMENTS:
        return error("VALIDATION_ERROR", f"Installment count must be between 2 and {MAX_INSTALLMENTS}.", 422)

    with db_cursor(commit=True) as cursor:
        cursor.execute(
            """
            SELECT s.*, p.plot_number, e.name AS estate_name
            FROM sales s
            LEFT JOIN properties p ON p.id = s.property_id
            LEFT JOIN estates e ON e.id = s.estate_id
            WHERE s.id = %s
            LIMIT 1
            """,
            (sale_id,),
        )
        sale = cursor.fetchone()
        if not sale:
            return error("NOT_FOUND", "Sale was not found.", 404)
        if not can_manage_sale_estate(cursor, current_user, sale["estate_id"]):
            return error("FORBIDDEN", "You cannot manage this sale.", 403)

        total_amount = float(sale["sale_price"] or 0)
        if total_amount <= 0:
            return error("INVALID_AMOUNT", "Sale price must be greater than zero to create an installment plan.", 422)

        cursor.execute(
            "SELECT * FROM installment_plans WHERE sale_id = %s AND status = 'active' LIMIT 1",
            (sale_id,),
        )
        if cursor.fetchone():
            return error("PLAN_EXISTS", "This sale already has an active installment plan.", 409)

        per_installment = round(total_amount / installment_count, 2)
        cursor.execute(
            """
            INSERT INTO installment_plans
              (sale_id, estate_id, buyer_id, total_amount, installment_count, amount_per_installment, created_by)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            """,
            (sale_id, sale["estate_id"], sale["buyer_id"], total_amount, installment_count, per_installment, current_user["id"]),
        )
        plan_id = cursor.lastrowid

        # Monthly due dates starting on the 1st of next month.
        first_due = (datetime.utcnow().replace(day=1) + timedelta(days=32)).replace(day=1)
        for index in range(installment_count):
            is_last = index == installment_count - 1
            amount = round(total_amount - per_installment * (installment_count - 1), 2) if is_last else per_installment
            due_date = (first_due + timedelta(days=31 * index)).replace(day=1)
            cursor.execute(
                "INSERT INTO installments (plan_id, due_date, amount) VALUES (%s, %s, %s)",
                (plan_id, due_date.date(), amount),
            )

        record_audit_log(
            cursor,
            current_user["id"],
            "installment_plan.created",
            entity_type="sale",
            entity_id=sale_id,
            metadata={"planId": plan_id, "installmentCount": installment_count, "amountPerInstallment": per_installment},
        )
        cursor.execute("SELECT * FROM installment_plans WHERE id = %s", (plan_id,))
        plan_payload = build_plan_payload(cursor, cursor.fetchone())

    return success({"plan": plan_payload}, "Installment plan created", 201)


def can_manage_sale_estate(cursor, current_user, estate_id):
    _, access_error = ensure_estate_access(cursor, current_user, estate_id)
    return access_error is None


@installments_bp.get("/sales/<int:sale_id>")
@require_roles("estate_manager", "buyer", "resident", "public_user", "admin", "super_admin")
def get_sale_plan(current_user, sale_id):
    with db_cursor() as cursor:
        cursor.execute("SELECT * FROM sales WHERE id = %s LIMIT 1", (sale_id,))
        sale = cursor.fetchone()
        if not sale:
            return error("NOT_FOUND", "Sale was not found.", 404)

        is_staff = current_user["role"] in ("estate_manager", "admin", "super_admin")
        is_buyer = current_user["role"] in ("buyer", "resident", "public_user")
        can_view = False
        if is_staff:
            _, access_error = ensure_estate_access(cursor, current_user, sale["estate_id"])
            can_view = access_error is None
        elif is_buyer:
            cursor.execute(
                """
                SELECT COUNT(*) AS count
                FROM properties
                WHERE (buyer_user_id = %s OR owner_user_id = %s) AND estate_id = %s
                LIMIT 1
                """,
                (current_user["id"], current_user["id"], sale["estate_id"]),
            )
            can_view = bool((cursor.fetchone() or {}).get("count"))
        if not can_view:
            return error("FORBIDDEN", "You do not have access to this sale.", 403)

        cursor.execute("SELECT * FROM installment_plans WHERE sale_id = %s ORDER BY id DESC LIMIT 1", (sale_id,))
        plan = cursor.fetchone()
        if not plan:
            return success({"plan": None}, "No installment plan for this sale.")

        plan_payload = build_plan_payload(cursor, plan)

    return success({"plan": plan_payload})


@installments_bp.get("")
@require_roles("estate_manager", "admin", "super_admin")
def list_installment_plans(current_user):
    from .payments import build_estate_scope

    with db_cursor() as cursor:
        scope_sql, params = build_estate_scope(cursor, current_user)
        cursor.execute(
            f"""
            SELECT
              ip.*,
              b.full_name AS buyer_name,
              e.name AS estate_name
            FROM installment_plans ip
            LEFT JOIN buyers b ON b.id = ip.buyer_id
            LEFT JOIN estates e ON e.id = ip.estate_id
            WHERE 1 = 1 {scope_sql}
            ORDER BY ip.created_at DESC
            LIMIT 200
            """,
            tuple(params),
        )
        rows = cursor.fetchall()

    plans = []
    with db_cursor() as cursor:
        for row in rows:
            payload = build_plan_payload(cursor, row)
            payload["buyerName"] = row.get("buyer_name")
            payload["estateName"] = row.get("estate_name")
            plans.append(payload)

    return success({"plans": plans})


@installments_bp.post("/<int:installment_id>/initialize")
@require_roles("estate_manager", "buyer", "resident", "public_user", "admin", "super_admin")
def initialize_installment_payment(current_user, installment_id):
    with db_cursor(commit=True) as cursor:
        cursor.execute(
            """
            SELECT i.*, ip.plan_id, ip.sale_id, ip.estate_id, ip.buyer_id,
                   s.sale_price, b.email AS buyer_email, b.full_name AS buyer_name
            FROM installments i
            JOIN installment_plans ip ON ip.id = i.plan_id
            JOIN sales s ON s.id = ip.sale_id
            JOIN buyers b ON b.id = ip.buyer_id
            WHERE i.id = %s
            LIMIT 1
            """,
            (installment_id,),
        )
        installment = cursor.fetchone()
        if not installment:
            return error("NOT_FOUND", "Installment not found.", 404)
        if installment["status"] == "paid":
            return error("ALREADY_PAID", "This installment has already been paid.", 409)
        if installment["status"] == "cancelled":
            return error("CANCELLED", "This installment has been cancelled.", 409)

        is_staff = current_user["role"] in ("estate_manager", "admin", "super_admin")
        is_buyer = current_user["role"] in ("buyer", "resident", "public_user")
        if is_staff:
            _, access_error = ensure_estate_access(cursor, current_user, installment["estate_id"])
            if access_error:
                return access_error
        # Buyer accounts pay their own installments. All sellers list exactly one
        # property, so the buying user is matched through that property record.
        elif is_buyer:
            cursor.execute(
                """
                SELECT COUNT(*) AS count
                FROM properties
                WHERE (buyer_user_id = %s OR owner_user_id = %s) AND estate_id = %s
                LIMIT 1
                """,
                (current_user["id"], current_user["id"], installment["estate_id"]),
            )
            if not (cursor.fetchone() or {}).get("count"):
                return error("FORBIDDEN", "You cannot pay this installment.", 403)

        base_amount = float(installment["amount"] or 0)
        if base_amount <= 0:
            return error("INVALID_AMOUNT", "Installment amount must be greater than zero.", 422)

        buyer_fee_percent = get_buyer_transaction_fee_percent(cursor)
        buyer_fee_amount = round(base_amount * buyer_fee_percent / 100, 2)
        seller_commission_percent = get_seller_commission_percent(cursor)
        seller_commission_amount = round(base_amount * seller_commission_percent / 100, 2)
        amount = round(base_amount + buyer_fee_amount, 2)

        buyer_email = installment.get("buyer_email") or f"buyer{installment['buyer_id']}@noemail.realestate.local"
        reference = f"INS-{installment_id}-{uuid4().hex[:12]}"
        try:
            paystack_data = initialize_transaction(
                email=buyer_email,
                amount_kobo=int(round(amount * 100)),
                reference=reference,
                subaccount=current_app.config["PAYSTACK_SUBACCOUNT_CODE"] or None,
                split=current_app.config["PAYSTACK_SPLIT_CODE"] or None,
                metadata={
                    "installmentId": installment_id,
                    "planId": installment["plan_id"],
                    "saleId": installment["sale_id"],
                    "buyerId": installment["buyer_id"],
                    "buyerName": installment.get("buyer_name"),
                },
            )
        except PaystackError as exc:
            return error("PAYSTACK_ERROR", str(exc), 502)

        cursor.execute(
            """
            INSERT INTO payment_transactions
              (sale_id, estate_id, buyer_id, reference, amount, base_amount, buyer_fee_amount, buyer_fee_percent,
               seller_commission_amount, seller_commission_percent, commission_amount, commission_percent,
               status, authorization_url, created_by)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, 'initialized', %s, %s)
            """,
            (
                installment["sale_id"],
                installment["estate_id"],
                installment["buyer_id"],
                reference,
                amount,
                base_amount,
                buyer_fee_amount,
                buyer_fee_percent,
                seller_commission_amount,
                seller_commission_percent,
                seller_commission_amount,
                seller_commission_percent,
                paystack_data.get("authorization_url"),
                current_user["id"],
            ),
        )
        transaction_id = cursor.lastrowid
        cursor.execute("UPDATE installments SET payment_transaction_id = %s WHERE id = %s", (transaction_id, installment_id))
        record_audit_log(
            cursor,
            current_user["id"],
            "payment.installment_initialized",
            entity_type="installment",
            entity_id=installment_id,
            metadata={"reference": reference, "amount": amount},
        )

    return success(
        {
            "reference": reference,
            "authorizationUrl": paystack_data.get("authorization_url"),
            "accessCode": paystack_data.get("access_code"),
            "publicKey": current_app.config["PAYSTACK_PUBLIC_KEY"],
        },
        "Installment payment initialized",
        201,
    )


def apply_successful_installment_payment(cursor, transaction, paystack_data):
    """Marks the installment referenced by an INS- transaction as paid and rolls
    the plan toward completed. Idempotent via the payment_events unique key."""
    try:
        cursor.execute(
            "INSERT INTO payment_events (transaction_reference, event_type, payload) VALUES (%s, %s, %s)",
            (transaction["reference"], "charge.success", json.dumps(paystack_data)[:60000]),
        )
    except Exception:
        return False

    cursor.execute(
        "UPDATE payment_transactions SET status = 'success', channel = %s, gateway_response = %s WHERE reference = %s",
        (paystack_data.get("channel"), paystack_data.get("gateway_response"), transaction["reference"]),
    )

    reference = transaction["reference"]
    try:
        installment_id = int(reference.split("-")[1])
    except (IndexError, ValueError):
        return False

    cursor.execute("SELECT * FROM installments WHERE id = %s LIMIT 1", (installment_id,))
    installment = cursor.fetchone()
    if not installment or installment["status"] == "paid":
        return False

    cursor.execute(
        "UPDATE installments SET status = 'paid', paid_at = %s WHERE id = %s",
        (datetime.utcnow(), installment_id),
    )

    cursor.execute(
        """
        SELECT
          COUNT(*) AS total,
          COALESCE(SUM(status = 'paid'), 0) AS paid_count
        FROM installments
        WHERE plan_id = %s
        """,
        (installment["plan_id"],),
    )
    progress = cursor.fetchone()
    if int(progress["total"]) == int(progress["paid_count"]):
        cursor.execute("UPDATE installment_plans SET status = 'completed' WHERE id = %s", (installment["plan_id"],))

    record_audit_log(
        cursor,
        None,
        "payment.installment_paid",
        entity_type="installment",
        entity_id=installment_id,
        metadata={"reference": reference, "amount": transaction["amount"]},
    )

    cursor.execute(
        """
        SELECT e.manager_user_id
        FROM installment_plans ip
        JOIN estates e ON e.id = ip.estate_id
        WHERE ip.id = %s
        LIMIT 1
        """,
        (installment["plan_id"],),
    )
    plan_owner = cursor.fetchone()
    if plan_owner and plan_owner.get("manager_user_id"):
        amount_naira = float(transaction["amount"] or 0)
        plan_completed = int(progress["total"]) == int(progress["paid_count"])
        create_notification(
            cursor,
            user_id=plan_owner["manager_user_id"],
            title="Installment payment received",
            body=(
                f"Installment payment of ₦{amount_naira:,.0f} confirmed."
                + (" The installment plan is now fully paid." if plan_completed else "")
            ),
            type="payment",
            entity_type="installment",
            entity_id=installment_id,
        )
        queue_push(
            [plan_owner["manager_user_id"]],
            title="Installment payment received",
            body=f"Installment payment of ₦{amount_naira:,.0f} confirmed.",
            data={"type": "payment", "entityType": "installment", "entityId": installment_id},
        )
    return True