from datetime import datetime, timedelta, timezone

from flask import Blueprint, current_app, request
from flask_jwt_extended import create_access_token, create_refresh_token, get_jwt_identity, jwt_required

from ..db import db_cursor
from ..utils.audit import record_audit_log
from ..utils.demo import DEMO_PASSWORD, DEMO_USERS_BY_EMAIL, DEMO_USERS_BY_ID, is_demo_identity
from ..utils.responses import error, success
from ..utils.security import (
    generate_reset_token,
    hash_password,
    hash_reset_token,
    verify_password,
)
from .email_verification import is_email_verified

auth_bp = Blueprint("auth", __name__)

ALLOWED_ROLES = {
    "estate_manager",
    "resident",
    "buyer",
    "security",
    "public_user",
}

RESET_TOKEN_TTL_MINUTES = 30


def serialize_user(row):
    return {
        "id": row["id"],
        "fullName": row["full_name"],
        "email": row["email"],
        "phone": row.get("phone"),
        "role": row["role"],
        "accountStatus": row["account_status"],
    }


def issue_tokens(user_id):
    identity = str(user_id)
    return {
        "accessToken": create_access_token(identity=identity),
        "refreshToken": create_refresh_token(identity=identity, expires_delta=timedelta(days=30)),
    }


@auth_bp.post("/register")
def register():
    payload = request.get_json(silent=True) or {}
    full_name = (payload.get("fullName") or "").strip()
    email = (payload.get("email") or "").strip().lower()
    phone = (payload.get("phone") or "").strip() or None
    password = payload.get("password") or ""
    role = payload.get("role") or "public_user"

    if not full_name or not email or not password:
        return error("VALIDATION_ERROR", "Full name, email, and password are required.", 422)

    if role not in ALLOWED_ROLES:
        return error("VALIDATION_ERROR", "Selected role is not available for registration.", 422)

    if not is_email_verified(email):
        return error("EMAIL_NOT_VERIFIED", "Verify your email before creating an account.", 403)

    with db_cursor(commit=True) as cursor:
        cursor.execute("SELECT id FROM users WHERE email = %s LIMIT 1", (email,))
        if cursor.fetchone():
            return error("EMAIL_EXISTS", "An account with this email already exists.", 409)

        account_status = "pending" if role == "estate_manager" else "active"

        cursor.execute(
            """
            INSERT INTO users (full_name, email, phone, password_hash, role, account_status)
            VALUES (%s, %s, %s, %s, %s, %s)
            """,
            (full_name, email, phone, hash_password(password), role, account_status),
        )
        user_id = cursor.lastrowid
        cursor.execute("SELECT * FROM users WHERE id = %s", (user_id,))
        user = cursor.fetchone()

        record_audit_log(
            cursor,
            user_id,
            "auth.registered",
            "user",
            user_id,
            {"role": role, "accountStatus": account_status},
        )

    return success({"user": serialize_user(user), "tokens": issue_tokens(user["id"])}, "Account created", 201)


ADMIN_PORTAL_ROLES = {"admin", "super_admin"}
MANAGER_PORTAL_ROLES = {"estate_manager"}
PORTAL_ALLOWED_ROLES = {"admin": ADMIN_PORTAL_ROLES, "manager": MANAGER_PORTAL_ROLES}


@auth_bp.post("/login")
def login():
    payload = request.get_json(silent=True) or {}
    email = (payload.get("email") or "").strip().lower()
    password = payload.get("password") or ""
    portal = (payload.get("portal") or "").strip().lower()

    if not email or not password:
        return error("VALIDATION_ERROR", "Email and password are required.", 422)

    allowed_roles = PORTAL_ALLOWED_ROLES.get(portal)

    # Review finding #1: hardcoded demo accounts (demo@estate.com / demo1234)
    # were reachable in EVERY environment. They are now gated behind
    # DEMO_LOGIN_ENABLED (default off) so production can never log in with them.
    demo_user = DEMO_USERS_BY_EMAIL.get(email)
    if (
        current_app.config.get("DEMO_LOGIN_ENABLED")
        and demo_user
        and password == DEMO_PASSWORD
    ):
        if allowed_roles and demo_user["role"] not in allowed_roles:
            return error("FORBIDDEN", f"This account does not have access to the {portal} dashboard.", 403)
        return success({"user": serialize_user(demo_user), "tokens": issue_tokens(demo_user["id"])}, "Logged in")

    with db_cursor(commit=True) as cursor:
        cursor.execute("SELECT * FROM users WHERE email = %s LIMIT 1", (email,))
        user = cursor.fetchone()

        if not user or not verify_password(user["password_hash"], password):
            return error("INVALID_CREDENTIALS", "Invalid email or password.", 401)

        # Backend-enforced portal gate: an account whose role doesn't belong to the
        # requested web portal (admin or estate-manager) cannot obtain a token through
        # that portal's login form at all, even though require_roles() would also
        # block them from every role-restricted endpoint afterwards.
        if allowed_roles and user["role"] not in allowed_roles:
            return error("FORBIDDEN", f"This account does not have access to the {portal} dashboard.", 403)

        if user["account_status"] in ("suspended", "rejected"):
            return error("ACCOUNT_RESTRICTED", "This account is restricted. Contact the platform owner.", 403)

        record_audit_log(cursor, user["id"], "auth.logged_in", "user", user["id"], {"portal": portal or "mobile"})

    return success({"user": serialize_user(user), "tokens": issue_tokens(user["id"])}, "Logged in")


@auth_bp.get("/me")
@jwt_required()
def me():
    user_id = get_jwt_identity()

    if is_demo_identity(user_id) and current_app.config.get("DEMO_LOGIN_ENABLED"):
        return success({"user": serialize_user(DEMO_USERS_BY_ID[user_id])})

    with db_cursor() as cursor:
        cursor.execute("SELECT * FROM users WHERE id = %s LIMIT 1", (user_id,))
        user = cursor.fetchone()

    if not user:
        return error("NOT_FOUND", "User account was not found.", 404)

    return success({"user": serialize_user(user)})


@auth_bp.post("/refresh")
@jwt_required(refresh=True)
def refresh():
    user_id = get_jwt_identity()

    # Demo identities cannot mint new tokens once the demo gate is off.
    if is_demo_identity(user_id) and not current_app.config.get("DEMO_LOGIN_ENABLED"):
        return error("UNAUTHORIZED", "Authentication is required.", 401)

    return success({"tokens": issue_tokens(user_id)})


@auth_bp.post("/logout")
@jwt_required(optional=True)
def logout():
    user_id = get_jwt_identity()

    if user_id and not is_demo_identity(user_id):
        with db_cursor(commit=True) as cursor:
            record_audit_log(cursor, user_id, "auth.logged_out", "user", user_id)

    return success({}, "Logged out")


@auth_bp.post("/password-reset/request")
def request_password_reset():
    payload = request.get_json(silent=True) or {}
    email = (payload.get("email") or "").strip().lower()
    generic_message = "If an account exists for this email, a reset code has been issued."

    if not email or email in DEMO_USERS_BY_EMAIL:
        return success({}, generic_message)

    with db_cursor(commit=True) as cursor:
        cursor.execute("SELECT id FROM users WHERE email = %s LIMIT 1", (email,))
        user = cursor.fetchone()

        if not user:
            return success({}, generic_message)

        token = generate_reset_token()
        expires_at = datetime.now(timezone.utc) + timedelta(minutes=RESET_TOKEN_TTL_MINUTES)

        cursor.execute(
            "INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES (%s, %s, %s)",
            (user["id"], hash_reset_token(token), expires_at),
        )
        record_audit_log(cursor, user["id"], "auth.password_reset_requested", "user", user["id"])

    response_data = {}
    if current_app.config.get("ENV") == "development" or current_app.debug:
        response_data["devResetToken"] = token

    return success(response_data, generic_message)


@auth_bp.post("/password-reset/confirm")
def confirm_password_reset():
    payload = request.get_json(silent=True) or {}
    token = (payload.get("token") or "").strip()
    new_password = payload.get("newPassword") or ""

    if not token or len(new_password) < 6:
        return error("VALIDATION_ERROR", "A reset token and a password of at least 6 characters are required.", 422)

    token_hash = hash_reset_token(token)

    with db_cursor(commit=True) as cursor:
        cursor.execute(
            """
            SELECT * FROM password_reset_tokens
            WHERE token_hash = %s AND used_at IS NULL AND expires_at > UTC_TIMESTAMP()
            LIMIT 1
            """,
            (token_hash,),
        )
        reset_record = cursor.fetchone()

        if not reset_record:
            return error("INVALID_TOKEN", "This reset code is invalid or has expired.", 400)

        cursor.execute(
            "UPDATE users SET password_hash = %s WHERE id = %s",
            (hash_password(new_password), reset_record["user_id"]),
        )
        cursor.execute(
            "UPDATE password_reset_tokens SET used_at = CURRENT_TIMESTAMP WHERE id = %s",
            (reset_record["id"],),
        )
        record_audit_log(cursor, reset_record["user_id"], "auth.password_reset_completed", "user", reset_record["user_id"])

    return success({}, "Password updated. You can now sign in with your new password.")
