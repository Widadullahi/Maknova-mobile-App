from uuid import uuid4

from flask import Blueprint, current_app, request

from ..db import db_cursor
from ..utils.audit import record_audit_log
from ..utils.authz import require_roles
from ..utils.paystack import PaystackError, initialize_transaction, verify_transaction
from ..utils.responses import error, success
from ..utils.settings import get_commission_percent, get_guest_pass_fee, set_setting

wallet_bp = Blueprint("wallet", __name__)


def serialize_wallet(row):
    return {
        "id": row["id"],
        "userId": row["user_id"],
        "balance": float(row["balance"] or 0),
        "updatedAt": row.get("updated_at"),
    }


def serialize_wallet_transaction(row):
    return {
        "id": row["id"],
        "type": row["type"],
        "grossAmount": float(row["gross_amount"]) if row.get("gross_amount") is not None else None,
        "feeAmount": float(row["fee_amount"]) if row.get("fee_amount") is not None else None,
        "netAmount": float(row["net_amount"] or 0),
        "reference": row.get("reference"),
        "status": row["status"],
        "visitorPassId": row.get("visitor_pass_id"),
        "createdAt": row.get("created_at"),
    }


def get_or_create_wallet(cursor, user_id):
    cursor.execute("SELECT * FROM wallets WHERE user_id = %s LIMIT 1", (user_id,))
    wallet = cursor.fetchone()
    if wallet:
        return wallet
    cursor.execute("INSERT INTO wallets (user_id, balance) VALUES (%s, 0)", (user_id,))
    cursor.execute("SELECT * FROM wallets WHERE id = %s", (cursor.lastrowid,))
    return cursor.fetchone()


def deduct_guest_pass_fee(cursor, user):
    """
    Called from visitor_passes.create_visitor_pass for resident-generated passes
    only (estate manager/admin/super_admin-generated passes are exempt — this is
    specifically the "Resident Visitor Wallet" fee), and BEFORE the pass row is
    inserted: db_cursor's commit happens even on an early `return` from inside
    the `with` block (a return isn't an exception), so if we deducted after
    inserting the pass and then bailed out on insufficient funds, the pass would
    still get committed. Doing it first means an insufficient-balance case never
    touches the database at all, so there's nothing to roll back.

    Returns (ok, fee_amount, wallet_transaction_id). On ok=False, nothing was
    written — the caller must not create the pass.
    """
    fee = get_guest_pass_fee(cursor)
    wallet = get_or_create_wallet(cursor, user["id"])
    if float(wallet["balance"]) < fee:
        return False, fee, None

    cursor.execute("UPDATE wallets SET balance = balance - %s WHERE id = %s", (fee, wallet["id"]))
    cursor.execute(
        "INSERT INTO wallet_transactions (wallet_id, user_id, type, net_amount, status) VALUES (%s, %s, 'guest_pass_fee', %s, 'success')",
        (wallet["id"], user["id"], -fee),
    )
    return True, fee, cursor.lastrowid


def link_guest_pass_fee_transaction(cursor, wallet_transaction_id, visitor_pass_id):
    cursor.execute(
        "UPDATE wallet_transactions SET visitor_pass_id = %s WHERE id = %s",
        (visitor_pass_id, wallet_transaction_id),
    )


@wallet_bp.get("/me")
@require_roles("resident")
def get_my_wallet(current_user):
    with db_cursor(commit=True) as cursor:
        wallet = get_or_create_wallet(cursor, current_user["id"])
        cursor.execute(
            "SELECT * FROM wallet_transactions WHERE user_id = %s ORDER BY created_at DESC LIMIT 100",
            (current_user["id"],),
        )
        transactions = [serialize_wallet_transaction(row) for row in cursor.fetchall()]
        guest_pass_fee = get_guest_pass_fee(cursor)

    return success({"wallet": serialize_wallet(wallet), "transactions": transactions, "guestPassFee": guest_pass_fee})


@wallet_bp.post("/topup/initialize")
@require_roles("resident")
def initialize_topup(current_user):
    payload = request.get_json(silent=True) or {}
    try:
        amount = float(payload.get("amount"))
    except (TypeError, ValueError):
        return error("VALIDATION_ERROR", "A top-up amount is required.", 422)
    if amount <= 0:
        return error("VALIDATION_ERROR", "Top-up amount must be greater than zero.", 422)

    with db_cursor(commit=True) as cursor:
        wallet = get_or_create_wallet(cursor, current_user["id"])
        commission_percent = get_commission_percent(cursor)
        fee_amount = round(amount * commission_percent / 100, 2)
        net_amount = round(amount - fee_amount, 2)
        reference = f"WAL-{current_user['id']}-{uuid4().hex[:12]}"
        email = current_user.get("email") or f"resident{current_user['id']}@noemail.realestate.local"

        try:
            paystack_data = initialize_transaction(
                email=email,
                amount_kobo=int(round(amount * 100)),
                reference=reference,
                metadata={"userId": current_user["id"], "purpose": "wallet_topup"},
            )
        except PaystackError as exc:
            return error("PAYSTACK_ERROR", str(exc), 502)

        cursor.execute(
            """
            INSERT INTO wallet_transactions
              (wallet_id, user_id, type, gross_amount, fee_amount, net_amount, reference, status)
            VALUES (%s, %s, 'topup', %s, %s, %s, %s, 'pending')
            """,
            (wallet["id"], current_user["id"], amount, fee_amount, net_amount, reference),
        )
        record_audit_log(
            cursor,
            current_user["id"],
            "wallet.topup_initialized",
            entity_type="wallet_transaction",
            entity_id=cursor.lastrowid,
            metadata={"reference": reference, "amount": amount, "feeAmount": fee_amount},
        )

    return success(
        {
            "reference": reference,
            "authorizationUrl": paystack_data.get("authorization_url"),
            "publicKey": current_app.config["PAYSTACK_PUBLIC_KEY"],
            "grossAmount": amount,
            "feeAmount": fee_amount,
            "netAmount": net_amount,
        },
        "Top-up initialized",
        201,
    )


def apply_successful_topup(cursor, wallet_transaction, paystack_data):
    """Credits the wallet and marks the transaction successful. Called from the
    Paystack webhook and from the manual verify endpoint below; both paths check
    status != 'success' before calling this, so a double-credit requires two
    concurrent callers racing past that check — acceptable given Paystack's own
    idempotent event delivery and that this mirrors the existing sale-payment
    pattern in payments.py."""
    cursor.execute(
        "UPDATE wallet_transactions SET status = 'success' WHERE id = %s",
        (wallet_transaction["id"],),
    )
    cursor.execute(
        "UPDATE wallets SET balance = balance + %s WHERE id = %s",
        (wallet_transaction["net_amount"], wallet_transaction["wallet_id"]),
    )
    record_audit_log(
        cursor,
        None,
        "wallet.topup_success",
        entity_type="wallet_transaction",
        entity_id=wallet_transaction["id"],
        metadata={"reference": wallet_transaction["reference"], "netAmount": float(wallet_transaction["net_amount"])},
    )


@wallet_bp.get("/topup/verify/<reference>")
@require_roles("resident")
def verify_topup(current_user, reference):
    with db_cursor(commit=True) as cursor:
        cursor.execute(
            "SELECT * FROM wallet_transactions WHERE reference = %s AND user_id = %s LIMIT 1",
            (reference, current_user["id"]),
        )
        wallet_transaction = cursor.fetchone()
        if not wallet_transaction:
            return error("NOT_FOUND", "Transaction not found.", 404)

        try:
            paystack_data = verify_transaction(reference)
        except PaystackError as exc:
            return error("PAYSTACK_ERROR", str(exc), 502)

        if paystack_data.get("status") == "success" and wallet_transaction["status"] != "success":
            apply_successful_topup(cursor, wallet_transaction, paystack_data)
        elif paystack_data.get("status") != "success":
            cursor.execute("UPDATE wallet_transactions SET status = 'failed' WHERE id = %s", (wallet_transaction["id"],))

        cursor.execute("SELECT * FROM wallet_transactions WHERE reference = %s LIMIT 1", (reference,))
        wallet_transaction = cursor.fetchone()
        wallet = get_or_create_wallet(cursor, current_user["id"])

    return success({"transaction": serialize_wallet_transaction(wallet_transaction), "wallet": serialize_wallet(wallet)})


@wallet_bp.get("/settings/guest-pass-fee")
@require_roles("super_admin")
def get_guest_pass_fee_setting(current_user):
    with db_cursor() as cursor:
        fee = get_guest_pass_fee(cursor)
    return success({"guestPassFee": fee})


@wallet_bp.patch("/settings/guest-pass-fee")
@require_roles("super_admin")
def update_guest_pass_fee_setting(current_user):
    payload = request.get_json(silent=True) or {}
    try:
        fee = float(payload.get("guestPassFee"))
    except (TypeError, ValueError):
        return error("VALIDATION_ERROR", "guestPassFee must be a number.", 422)
    if fee < 0:
        return error("VALIDATION_ERROR", "guestPassFee cannot be negative.", 422)

    with db_cursor(commit=True) as cursor:
        set_setting(cursor, "guest_pass_fee", fee, current_user["id"])
        record_audit_log(
            cursor,
            current_user["id"],
            "settings.guest_pass_fee_updated",
            entity_type="platform_settings",
            entity_id=None,
            metadata={"guestPassFee": fee},
        )

    return success({"guestPassFee": fee}, "Guest pass fee updated")
