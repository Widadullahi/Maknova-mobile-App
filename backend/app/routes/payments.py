import hashlib
import hmac
import json
import math
from datetime import datetime, timedelta
from uuid import uuid4

from flask import Blueprint, current_app, request

from ..db import db_cursor
from ..utils.audit import record_audit_log
from ..utils.authz import require_roles
from ..utils.notify import create_notification, flush_push_queue, queue_push
from ..utils.paystack import PaystackError, initialize_transaction, verify_transaction
from ..utils.responses import error, success
from ..utils.scope import get_user_estate_ids, can_access_estate
from ..utils.settings import get_buyer_transaction_fee_percent, get_commission_percent, get_seller_commission_percent, set_setting

payments_bp = Blueprint("payments", __name__)


def build_estate_scope(cursor, current_user, alias="s"):
    estate_ids = get_user_estate_ids(cursor, current_user)
    if estate_ids is None:
        return "", []
    if not estate_ids:
        return " AND 1 = 0", []
    placeholders = ", ".join(["%s"] * len(estate_ids))
    return f" AND {alias}.estate_id IN ({placeholders})", list(estate_ids)


def serialize_payment(row):
    return {
        "id": row["id"],
        "estateId": row["estate_id"],
        "estateName": row.get("estate_name"),
        "propertyId": row["property_id"],
        "propertyIdentifier": row.get("property_identifier"),
        "buyerId": row["buyer_id"],
        "buyerName": row.get("buyer_name"),
        "amount": float(row["sale_price"] or 0),
        "paymentStatus": row["payment_status"],
        "status": row["status"],
        "createdAt": row.get("created_at"),
        "updatedAt": row.get("updated_at"),
    }


@payments_bp.get("")
@require_roles("estate_manager", "admin", "super_admin")
def list_payments(current_user):
    status = request.args.get("status")
    search = (request.args.get("search") or "").strip()

    with db_cursor() as cursor:
        scope_sql, params = build_estate_scope(cursor, current_user)
        where = ["1 = 1"]
        if scope_sql:
            where.append(scope_sql.replace(" AND ", "", 1))
        if status:
            where.append("s.payment_status = %s")
            params.append(status)
        if search:
            where.append("(b.full_name LIKE %s OR e.name LIKE %s OR p.plot_number LIKE %s)")
            needle = f"%{search}%"
            params.extend([needle, needle, needle])

        cursor.execute(
            f"""
            SELECT
              s.*,
              e.name AS estate_name,
              p.plot_number AS property_identifier,
              b.full_name AS buyer_name
            FROM sales s
            LEFT JOIN estates e ON e.id = s.estate_id
            LEFT JOIN properties p ON p.id = s.property_id
            LEFT JOIN buyers b ON b.id = s.buyer_id
            WHERE {' AND '.join(where)}
            ORDER BY s.created_at DESC
            LIMIT 500
            """,
            tuple(params),
        )
        payments = [serialize_payment(row) for row in cursor.fetchall()]

    return success({"payments": payments})


@payments_bp.get("/summary")
@require_roles("estate_manager", "admin", "super_admin")
def payment_summary(current_user):
    """Payment dashboard feed: status counts, a 6-month paid-sales trend, and a
    per-estate distribution. All scoped to the caller's estate access."""
    TREND_MONTHS = 6

    with db_cursor() as cursor:
        scope_sql, params = build_estate_scope(cursor, current_user)
        cursor.execute(
            f"""
            SELECT
              payment_status,
              COUNT(*) AS count,
              COALESCE(SUM(sale_price), 0) AS amount
            FROM sales s
            WHERE 1 = 1 {scope_sql}
            GROUP BY payment_status
            ORDER BY payment_status
            """,
            tuple(params),
        )
        rows = cursor.fetchall()

        cursor.execute(
            f"""
            SELECT
              DATE_FORMAT(s.created_at, '%Y-%m') AS month,
              COUNT(*) AS count,
              COALESCE(SUM(s.sale_price), 0) AS amount
            FROM sales s
            WHERE s.payment_status = 'paid'
              AND s.created_at >= DATE_SUB(CURDATE(), INTERVAL %s MONTH)
              {scope_sql}
            GROUP BY month
            ORDER BY month
            """,
            tuple([TREND_MONTHS, *params]),
        )
        trend_rows = {row["month"]: row for row in cursor.fetchall()}

        cursor.execute(
            f"""
            SELECT
              e.id AS estate_id,
              e.name AS estate_name,
              COUNT(*) AS count,
              COALESCE(SUM(s.sale_price), 0) AS amount
            FROM sales s
            JOIN estates e ON e.id = s.estate_id
            WHERE s.payment_status = 'paid'
              {scope_sql}
            GROUP BY e.id, e.name
            ORDER BY amount DESC
            LIMIT 10
            """,
            tuple(params),
        )
        by_estate = cursor.fetchall()

    # Fill missing months so charts get a stable, gap-free series.
    trend = []
    month_cursor = datetime.utcnow().replace(day=1)
    for _ in range(TREND_MONTHS):
        key = month_cursor.strftime("%Y-%m")
        row = trend_rows.get(key)
        trend.append(
            {
                "month": key,
                "count": int(row["count"]) if row else 0,
                "amount": float(row["amount"] or 0) if row else 0.0,
            }
        )
        month_cursor = (month_cursor - timedelta(days=1)).replace(day=1)
    trend.reverse()

    return success(
        {
            "summary": {
                "totalCount": sum(row["count"] for row in rows),
                "totalAmount": float(sum(row["amount"] or 0 for row in rows)),
                "byStatus": [
                    {
                        "status": row["payment_status"],
                        "count": row["count"],
                        "amount": float(row["amount"] or 0),
                    }
                    for row in rows
                ],
                "monthly": trend,
                "byEstate": [
                    {
                        "estateId": row["estate_id"],
                        "estateName": row["estate_name"],
                        "count": row["count"],
                        "amount": float(row["amount"] or 0),
                    }
                    for row in by_estate
                ],
            }
        }
    )


def serialize_transaction(row):
    return {
        "id": row["id"],
        "saleId": row["sale_id"],
        "estateId": row["estate_id"],
        "buyerId": row["buyer_id"],
        "reference": row["reference"],
        "amount": float(row["amount"] or 0),
        "commissionAmount": float(row["commission_amount"] or 0),
        "commissionPercent": float(row["commission_percent"] or 0),
        "baseAmount": float(row.get("base_amount") or row.get("sale_price") or 0),
        "buyerFeeAmount": float(row.get("buyer_fee_amount") or 0),
        "buyerFeePercent": float(row.get("buyer_fee_percent") or 0),
        "sellerCommissionAmount": float(row.get("seller_commission_amount") or row.get("commission_amount") or 0),
        "sellerCommissionPercent": float(row.get("seller_commission_percent") or row.get("commission_percent") or 0),
        "status": row["status"],
        "authorizationUrl": row.get("authorization_url"),
        "createdAt": row.get("created_at"),
        "updatedAt": row.get("updated_at"),
    }


@payments_bp.post("/sales/<int:sale_id>/initialize")
@require_roles("estate_manager", "admin", "super_admin")
def initialize_sale_payment(current_user, sale_id):
    with db_cursor(commit=True) as cursor:
        cursor.execute(
            """
            SELECT s.*, b.email AS buyer_email, b.phone AS buyer_phone, b.full_name AS buyer_name
            FROM sales s
            JOIN buyers b ON b.id = s.buyer_id
            WHERE s.id = %s
            LIMIT 1
            """,
            (sale_id,),
        )
        sale = cursor.fetchone()
        if not sale:
            return error("NOT_FOUND", "Sale not found.", 404)
        if not can_access_estate(cursor, current_user, sale["estate_id"]):
            return error("FORBIDDEN", "You do not have access to this estate.", 403)

        base_amount = float(sale["sale_price"] or 0)
        if base_amount <= 0:
            return error("INVALID_AMOUNT", "Sale price must be greater than zero to collect payment.", 422)

        buyer_fee_percent = get_buyer_transaction_fee_percent(cursor)
        seller_commission_percent = get_seller_commission_percent(cursor)
        buyer_fee_amount = round(base_amount * buyer_fee_percent / 100, 2)
        amount = round(base_amount + buyer_fee_amount, 2)
        seller_commission_amount = round(base_amount * seller_commission_percent / 100, 2)
        # A successful/retry-safe sale has one active Paystack transaction.
        cursor.execute(
            "SELECT * FROM payment_transactions WHERE sale_id = %s AND status IN ('initialized', 'success') ORDER BY id DESC LIMIT 1",
            (sale_id,),
        )
        existing = cursor.fetchone()
        if existing:
            return success({"reference": existing["reference"], "authorizationUrl": existing.get("authorization_url"), "amount": float(existing["amount"]), "alreadyInitialized": True}, "Payment already initialized")
        buyer_email = sale.get("buyer_email") or f"buyer{sale['buyer_id']}@noemail.realestate.local"
        reference = f"RE-{sale_id}-{uuid4().hex[:12]}"

        try:
            paystack_data = initialize_transaction(
                email=buyer_email,
                amount_kobo=int(round(amount * 100)),
                reference=reference,
                subaccount=current_app.config["PAYSTACK_SUBACCOUNT_CODE"] or None,
                split=current_app.config["PAYSTACK_SPLIT_CODE"] or None,
                metadata={
                    "saleId": sale_id,
                    "estateId": sale["estate_id"],
                    "buyerId": sale["buyer_id"],
                    "buyerName": sale.get("buyer_name"),
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
                sale_id,
                sale["estate_id"],
                sale["buyer_id"],
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
        record_audit_log(
            cursor,
            current_user["id"],
            "payment.initialized",
            entity_type="sale",
            entity_id=sale_id,
            metadata={"reference": reference, "amount": amount},
        )

    return success(
        {
            "reference": reference,
            "authorizationUrl": paystack_data.get("authorization_url"),
            "accessCode": paystack_data.get("access_code"),
            "publicKey": current_app.config["PAYSTACK_PUBLIC_KEY"],
        },
        "Payment initialized",
        201,
    )


def apply_successful_payment(cursor, transaction, paystack_data):
    """Marks a transaction + its sale as paid. Idempotent via payment_events unique key."""
    try:
        cursor.execute(
            "INSERT INTO payment_events (transaction_reference, event_type, payload) VALUES (%s, %s, %s)",
            (transaction["reference"], "charge.success", json.dumps(paystack_data)[:60000]),
        )
    except Exception:
        # Duplicate event for this reference — already processed.
        return False

    cursor.execute(
        "UPDATE payment_transactions SET status = 'success', channel = %s, gateway_response = %s WHERE reference = %s",
        (paystack_data.get("channel"), paystack_data.get("gateway_response"), transaction["reference"]),
    )
    cursor.execute(
        "UPDATE sales SET payment_status = 'paid' WHERE id = %s",
        (transaction["sale_id"],),
    )
    from .sales import update_property_status

    cursor.execute(
        """
        SELECT s.property_id, e.manager_user_id
        FROM sales s
        JOIN estates e ON e.id = s.estate_id
        WHERE s.id = %s
        LIMIT 1
        """,
        (transaction["sale_id"],),
    )
    sale = cursor.fetchone()
    if sale:
        update_property_status(cursor, sale["property_id"], sale["manager_user_id"], "sold", "Full sale payment verified automatically")
        amount_naira = float(transaction["amount"] or 0)
        # Notify the estate manager that money actually landed. This is the
        # server-side notification the whole workflow previously lacked.
        create_notification(
            cursor,
            user_id=sale["manager_user_id"],
            title="Payment received",
            body=f"Payment of ₦{amount_naira:,.0f} confirmed for a plot sale. The plot is now marked sold.",
            type="payment",
            entity_type="sale",
            entity_id=transaction["sale_id"],
        )
        queue_push(
            [sale["manager_user_id"]],
            title="Payment received",
            body=f"₦{amount_naira:,.0f} payment confirmed for a plot sale.",
            data={"type": "payment", "entityType": "sale", "entityId": transaction["sale_id"]},
        )
    record_audit_log(
        cursor,
        None,
        "payment.success",
        entity_type="sale",
        entity_id=transaction["sale_id"],
        metadata={"reference": transaction["reference"], "amount": transaction["amount"]},
    )
    return True


@payments_bp.get("/verify/<reference>")
@require_roles("estate_manager", "admin", "super_admin")
def verify_sale_payment(current_user, reference):
    with db_cursor(commit=True) as cursor:
        cursor.execute("SELECT * FROM payment_transactions WHERE reference = %s LIMIT 1", (reference,))
        transaction = cursor.fetchone()
        if not transaction:
            return error("NOT_FOUND", "Transaction not found.", 404)
        if not can_access_estate(cursor, current_user, transaction["estate_id"]):
            return error("FORBIDDEN", "You do not have access to this estate.", 403)

        try:
            paystack_data = verify_transaction(reference)
        except PaystackError as exc:
            return error("PAYSTACK_ERROR", str(exc), 502)

        if paystack_data.get("status") == "success" and transaction["status"] != "success":
            apply_successful_payment(cursor, transaction, paystack_data)
        elif paystack_data.get("status") != "success":
            cursor.execute(
                "UPDATE payment_transactions SET status = 'failed', gateway_response = %s WHERE reference = %s",
                (paystack_data.get("gateway_response"), reference),
            )

        cursor.execute("SELECT * FROM payment_transactions WHERE reference = %s LIMIT 1", (reference,))
        transaction = cursor.fetchone()

    flush_push_queue()
    return success({"transaction": serialize_transaction(transaction)})


@payments_bp.post("/webhook")
def paystack_webhook():
    raw_body = request.get_data()
    signature = request.headers.get("x-paystack-signature", "")
    expected = hmac.new(
        current_app.config["PAYSTACK_SECRET_KEY"].encode("utf-8"),
        raw_body,
        hashlib.sha512,
    ).hexdigest()

    if not hmac.compare_digest(expected, signature or ""):
        return error("INVALID_SIGNATURE", "Webhook signature verification failed.", 401)

    event = request.get_json(silent=True) or {}
    if event.get("event") == "charge.success":
        data = event.get("data", {})
        reference = data.get("reference") or ""
        if reference and data.get("status") == "success":
            with db_cursor(commit=True) as cursor:
                # Three payment types share this one webhook, disambiguated by
                # reference prefix (RE- sale, WAL- wallet topup, DOC- document
                # generation fee). Each apply_* helper is independently
                # idempotent via its own unique-constraint insert/status check.
                if reference.startswith("WAL-"):
                    from .wallet import apply_successful_topup

                    cursor.execute("SELECT * FROM wallet_transactions WHERE reference = %s LIMIT 1", (reference,))
                    wallet_transaction = cursor.fetchone()
                    if wallet_transaction and wallet_transaction["status"] != "success":
                        apply_successful_topup(cursor, wallet_transaction, data)
                elif reference.startswith("DOC-"):
                    from .forms import apply_successful_document_payment

                    cursor.execute("SELECT * FROM document_generation_payments WHERE reference = %s LIMIT 1", (reference,))
                    document_payment = cursor.fetchone()
                    if document_payment and document_payment["status"] != "success":
                        apply_successful_document_payment(cursor, document_payment)
                elif reference.startswith("INS-"):
                    from .installments import apply_successful_installment_payment

                    cursor.execute("SELECT * FROM payment_transactions WHERE reference = %s LIMIT 1", (reference,))
                    transaction = cursor.fetchone()
                    if transaction and transaction["status"] != "success":
                        apply_successful_installment_payment(cursor, transaction, data)
                else:
                    cursor.execute("SELECT * FROM payment_transactions WHERE reference = %s LIMIT 1", (reference,))
                    transaction = cursor.fetchone()
                    if transaction and transaction["status"] != "success":
                        apply_successful_payment(cursor, transaction, data)

    flush_push_queue()
    return success({}, "Webhook received")


@payments_bp.get("/transactions")
@require_roles("super_admin")
def list_transactions(current_user):
    """
    Raw Paystack transaction ledger — reference, gross amount, commission earned,
    settlement status. This is "raw financial payout information" per the
    platform's role rules, so it's Master Owner (super_admin) only: staff admins
    can see sale/payment status via GET /payments, but not the transaction-level
    commission breakdown.
    """
    status = request.args.get("status")
    params = []
    where = ["1 = 1"]
    if status:
        where.append("pt.status = %s")
        params.append(status)

    with db_cursor() as cursor:
        cursor.execute(
            f"""
            SELECT
              pt.*,
              e.name AS estate_name,
              b.full_name AS buyer_name
            FROM payment_transactions pt
            LEFT JOIN estates e ON e.id = pt.estate_id
            LEFT JOIN buyers b ON b.id = pt.buyer_id
            WHERE {' AND '.join(where)}
            ORDER BY pt.created_at DESC
            LIMIT 500
            """,
            tuple(params),
        )
        rows = cursor.fetchall()

    transactions = [
        {
            **serialize_transaction(row),
            "estateName": row.get("estate_name"),
            "buyerName": row.get("buyer_name"),
            "channel": row.get("channel"),
        }
        for row in rows
    ]

    return success({"transactions": transactions})


@payments_bp.get("/commission-summary")
@require_roles("super_admin")
def commission_summary(current_user):
    with db_cursor() as cursor:
        cursor.execute(
            """
            SELECT
              status,
              COUNT(*) AS count,
              COALESCE(SUM(amount), 0) AS gross_amount,
              COALESCE(SUM(commission_amount), 0) AS commission_amount
            FROM payment_transactions
            GROUP BY status
            """
        )
        rows = cursor.fetchall()
        cursor.execute("SELECT COALESCE(SUM(buyer_fee_amount), 0) AS buyer_fee, COALESCE(SUM(seller_commission_amount), 0) AS seller_commission FROM payment_transactions WHERE status = 'success'")
        fee_totals = cursor.fetchone()

    by_status = {
        row["status"]: {
            "count": row["count"],
            "grossAmount": float(row["gross_amount"] or 0),
            "commissionAmount": float(row["commission_amount"] or 0),
        }
        for row in rows
    }
    successful = by_status.get("success", {"count": 0, "grossAmount": 0, "commissionAmount": 0})

    return success(
        {
            "summary": {
                "commissionPercent": get_seller_commission_percent(cursor),
                "successfulTransactionCount": successful["count"],
                "totalGrossCollected": successful["grossAmount"],
                "totalCommissionEarned": successful["commissionAmount"],
                "totalBuyerFeeRevenue": float(fee_totals["buyer_fee"] or 0),
                "totalSellerCommission": float(fee_totals["seller_commission"] or 0),
                "byStatus": [{"status": status, **values} for status, values in by_status.items()],
            }
        }
    )


@payments_bp.get("/settings/commission")
@require_roles("super_admin")
def get_commission_setting(current_user):
    with db_cursor() as cursor:
        percent = get_commission_percent(cursor)
    return success({"commissionPercent": percent})

@payments_bp.get("/settings/fees")
@require_roles("super_admin")
def get_fee_settings(current_user):
    with db_cursor() as cursor:
        return success({
            "buyerTransactionFeePercent": get_buyer_transaction_fee_percent(cursor),
            "sellerCommissionPercent": get_seller_commission_percent(cursor),
        })

@payments_bp.patch("/settings/fees")
@require_roles("super_admin")
def update_fee_settings(current_user):
    payload = request.get_json(silent=True) or {}
    try:
        buyer = float(payload.get("buyerTransactionFeePercent"))
        seller = float(payload.get("sellerCommissionPercent"))
    except (TypeError, ValueError):
        return error("VALIDATION_ERROR", "Both fee percentages must be numbers.", 422)
    if buyer < 0 or buyer > 100 or seller < 0 or seller > 100:
        return error("VALIDATION_ERROR", "Fee percentages must be between 0 and 100.", 422)
    with db_cursor(commit=True) as cursor:
        set_setting(cursor, "buyer_transaction_fee_percent", buyer, current_user["id"])
        set_setting(cursor, "seller_commission_percent", seller, current_user["id"])
    return success({"buyerTransactionFeePercent": buyer, "sellerCommissionPercent": seller}, "Fee settings updated")


@payments_bp.patch("/settings/commission")
@require_roles("super_admin")
def update_commission_setting(current_user):
    payload = request.get_json(silent=True) or {}
    percent = payload.get("commissionPercent")
    try:
        percent = float(percent)
    except (TypeError, ValueError):
        return error("VALIDATION_ERROR", "commissionPercent must be a number.", 422)
    if percent < 0 or percent > 100:
        return error("VALIDATION_ERROR", "commissionPercent must be between 0 and 100.", 422)

    with db_cursor(commit=True) as cursor:
        set_setting(cursor, "commission_percent", percent, current_user["id"])
        record_audit_log(
            cursor,
            current_user["id"],
            "settings.commission_updated",
            entity_type="platform_settings",
            entity_id=None,
            metadata={"commissionPercent": percent},
        )

    return success({"commissionPercent": percent}, "Commission rate updated")
