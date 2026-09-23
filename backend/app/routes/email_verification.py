import hashlib
import secrets
from datetime import datetime, timedelta

from flask import Blueprint, current_app, request

from ..db import db_cursor
from ..utils.emailer import send_email
from ..utils.responses import error, success

email_verification_bp = Blueprint("email_verification", __name__)

MAX_ATTEMPTS = 5


def hash_code(code):
    # Peppered hash so a DB leak never exposes usable codes.
    pepper = current_app.config["APP_SECRET"]
    return hashlib.sha256(f"{code}::{pepper}".encode("utf-8")).hexdigest()


def generate_code():
    return f"{secrets.randbelow(1000000):06d}"


def send_code_email(email, code):
    html = (
        f"<h3>Your Maknova verification code</h3>"
        f"<p>Use the code below to finish creating your account. It expires in "
        f"{int(current_app.config.get('EMAIL_OTP_TTL_MINUTES', 15))} minutes.</p>"
        f"<p style='font-size:24px;letter-spacing:4px;font-weight:bold'>{code}</p>"
        f"<p>If you did not request this code, you can safely ignore this email.</p>"
    )
    return send_email(email, "Your Maknova verification code", html, f"Your verification code is {code}. It expires in 15 minutes.")


@email_verification_bp.post("/request")
def request_verification():
    payload = request.get_json(silent=True) or {}
    email = (payload.get("email") or "").strip().lower()

    if not email:
        return error("VALIDATION_ERROR", "Email is required.", 422)

    code = generate_code()
    ttl_minutes = int(current_app.config.get("EMAIL_OTP_TTL_MINUTES", 15))
    expires_at = datetime.utcnow() + timedelta(minutes=ttl_minutes)

    with db_cursor(commit=True) as cursor:
        # Revoke outstanding codes for this address so only the newest one can be used.
        cursor.execute(
            "UPDATE email_verification_codes SET used_at = %s WHERE email = %s AND used_at IS NULL",
            (datetime.utcnow(), email),
        )
        cursor.execute(
            "INSERT INTO email_verification_codes (email, code_hash, expires_at) VALUES (%s, %s, %s)",
            (email, hash_code(code), expires_at),
        )

    sent = send_code_email(email, code)
    if sent:
        return success({"delivered": True}, "Verification code sent to your email.")

    # No SMTP provider configured: surface the code so development/testing can
    # proceed. This only happens when EMAIL_SMTP_HOST is empty.
    current_app.logger.info("Email OTP for %s is %s (no SMTP configured)", email, code)
    return success(
        {"delivered": False, "devCode": code},
        "Email delivery is not configured. Returning the code for development.",
    )


@email_verification_bp.post("/verify")
def verify_code():
    payload = request.get_json(silent=True) or {}
    email = (payload.get("email") or "").strip().lower()
    code = str(payload.get("code") or "").strip()

    if not email or not code:
        return error("VALIDATION_ERROR", "Email and verification code are required.", 422)

    if not code.isdigit() or len(code) != 6:
        return error("INVALID_CODE", "The verification code must be 6 digits.", 400)

    now = datetime.utcnow()
    with db_cursor(commit=True) as cursor:
        cursor.execute(
            """
            SELECT id, code_hash, expires_at, used_at, verified_at, attempts
            FROM email_verification_codes
            WHERE email = %s
            ORDER BY created_at DESC, id DESC
            LIMIT 1
            """,
            (email,),
        )
        row = cursor.fetchone()

        if not row:
            return error("INVALID_CODE", "No verification code was found for this email. Request a new one.", 400)

        if row["attempts"] >= MAX_ATTEMPTS:
            return error("RATE_LIMITED", "Too many incorrect attempts. Request a new code and try again.", 429)

        if row["code_hash"] != hash_code(code):
            cursor.execute(
                "UPDATE email_verification_codes SET attempts = attempts + 1 WHERE id = %s",
                (row["id"],),
            )
            remaining = MAX_ATTEMPTS - row["attempts"] - 1
            message = "The verification code is incorrect."
            if remaining > 0:
                message = f"The verification code is incorrect. {remaining} attempt(s) left."
            return error("INVALID_CODE", message, 400)

        if row["used_at"]:
            return error("CODE_USED", "This code has already been used. Request a new one.", 400)

        if row["expires_at"] < now:
            return error("CODE_EXPIRED", "This code has expired. Request a new one.", 400)

        cursor.execute(
            "UPDATE email_verification_codes SET used_at = %s, verified_at = %s WHERE id = %s",
            (now, now, row["id"]),
        )

    return success({"email": email}, "Email verified.")


def is_email_verified(email):
    with db_cursor() as cursor:
        cursor.execute(
            """
            SELECT verified_at
            FROM email_verification_codes
            WHERE email = %s AND verified_at IS NOT NULL AND used_at IS NOT NULL
            ORDER BY verified_at DESC
            LIMIT 1
            """,
            (email,),
        )
        return bool(cursor.fetchone())