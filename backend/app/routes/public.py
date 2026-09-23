import re

from flask import Blueprint, request

from ..db import db_cursor
from ..utils.audit import record_audit_log
from ..utils.responses import success

public_bp = Blueprint("public", __name__)

EMAIL_PATTERN = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")


@public_bp.post("/account-deletion-requests")
def public_account_deletion_request():
    """Accept a website deletion request without revealing whether an email exists."""
    payload = request.get_json(silent=True) or {}
    email = (payload.get("email") or "").strip().lower()
    full_name = (payload.get("fullName") or "").strip()[:160] or None
    reason = (payload.get("reason") or "").strip()[:1000] or None

    generic_message = "If an account matches those details, the deletion request has been received for review."
    if not EMAIL_PATTERN.match(email):
        return success({}, generic_message)

    with db_cursor(commit=True) as cursor:
        cursor.execute("SELECT id, email, full_name FROM users WHERE email = %s LIMIT 1", (email,))
        user = cursor.fetchone()
        if not user:
            return success({}, generic_message)

        cursor.execute(
            """
            SELECT id FROM account_deletion_requests
            WHERE user_id = %s AND status IN ('pending', 'in_review', 'approved')
            ORDER BY id DESC LIMIT 1
            """,
            (user["id"],),
        )
        if cursor.fetchone():
            return success({}, generic_message)

        cursor.execute(
            """
            INSERT INTO account_deletion_requests
              (user_id, email, full_name, reason, requester_ip)
            VALUES (%s, %s, %s, %s, %s)
            """,
            (user["id"], user["email"], full_name or user["full_name"], reason, request.remote_addr),
        )
        request_id = cursor.lastrowid
        record_audit_log(
            cursor,
            None,
            "account_deletion.public_requested",
            "user",
            user["id"],
            {"requestId": request_id},
        )

    return success({}, generic_message, 201)
