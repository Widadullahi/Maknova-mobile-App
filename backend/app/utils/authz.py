from functools import wraps

from flask_jwt_extended import get_jwt_identity, jwt_required

from ..db import db_cursor
from .demo import get_demo_user
from .responses import error


def get_current_user():
    user_id = get_jwt_identity()
    if not user_id:
        return None

    demo_user = get_demo_user(user_id)
    if demo_user:
        return demo_user

    with db_cursor() as cursor:
        cursor.execute("SELECT * FROM users WHERE id = %s LIMIT 1", (user_id,))
        return cursor.fetchone()


def require_roles(*roles):
    def decorator(fn):
        @wraps(fn)
        @jwt_required()
        def wrapper(*args, **kwargs):
            user = get_current_user()

            if not user:
                return error("UNAUTHORIZED", "Authentication is required.", 401)

            if user["account_status"] in ("suspended", "rejected"):
                return error("ACCOUNT_RESTRICTED", "This account is restricted.", 403)

            if roles and user["role"] not in roles:
                return error("FORBIDDEN", "You do not have permission to perform this action.", 403)

            return fn(user, *args, **kwargs)

        return wrapper

    return decorator
