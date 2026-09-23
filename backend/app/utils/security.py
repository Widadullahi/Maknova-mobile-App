import hashlib
import secrets
from datetime import datetime, timezone

from werkzeug.security import check_password_hash, generate_password_hash


def hash_password(password):
    return generate_password_hash(password)


def verify_password(password_hash, password):
    return check_password_hash(password_hash, password)


def create_refresh_token_value():
    return secrets.token_urlsafe(48)


def utc_now():
    return datetime.now(timezone.utc)


def generate_reset_token():
    return secrets.token_urlsafe(32)


def hash_reset_token(token):
    return hashlib.sha256(token.encode("utf-8")).hexdigest()
