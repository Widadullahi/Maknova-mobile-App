from flask import Blueprint, request

from ..db import db_cursor
from ..utils.authz import require_roles
from ..utils.responses import error, success

notifications_bp = Blueprint("notifications", __name__)


@notifications_bp.post("/push-token")
@require_roles()
def register_push_token(current_user):
    payload = request.get_json(silent=True) or {}
    token = (payload.get("token") or "").strip()
    platform = (payload.get("platform") or "").strip() or None

    if not token:
        return error("VALIDATION_ERROR", "A push token is required.", 422)

    with db_cursor(commit=True) as cursor:
        cursor.execute(
            """
            INSERT INTO push_tokens (user_id, token, platform)
            VALUES (%s, %s, %s)
            ON DUPLICATE KEY UPDATE user_id = VALUES(user_id), platform = VALUES(platform)
            """,
            (current_user["id"], token, platform),
        )

    return success({}, "Push token registered")


def serialize_notification(row):
    return {
        "id": row["id"],
        "userId": row.get("user_id"),
        "role": row.get("role"),
        "title": row["title"],
        "body": row["body"],
        "type": row["type"],
        "entityType": row.get("entity_type"),
        "entityId": row.get("entity_id"),
        "isRead": bool(row["is_read"]),
        "createdAt": row.get("created_at"),
        "readAt": row.get("read_at"),
    }


@notifications_bp.get("")
@require_roles("resident", "buyer", "security", "estate_manager", "admin", "super_admin")
def list_notifications(current_user):
    with db_cursor() as cursor:
        cursor.execute(
            """
            SELECT * FROM notifications
            WHERE user_id = %s OR role = %s OR (user_id IS NULL AND role IS NULL)
            ORDER BY created_at DESC
            LIMIT 100
            """,
            (current_user["id"], current_user["role"]),
        )
        notifications = [serialize_notification(row) for row in cursor.fetchall()]

    unread_count = sum(1 for item in notifications if not item["isRead"])
    return success({"notifications": notifications, "unreadCount": unread_count})


@notifications_bp.patch("/<int:notification_id>/read")
@require_roles("resident", "buyer", "security", "estate_manager", "admin", "super_admin")
def mark_notification_read(current_user, notification_id):
    with db_cursor(commit=True) as cursor:
        cursor.execute(
            """
            SELECT * FROM notifications
            WHERE id = %s
              AND (user_id = %s OR role = %s OR (user_id IS NULL AND role IS NULL))
            LIMIT 1
            """,
            (notification_id, current_user["id"], current_user["role"]),
        )
        notification = cursor.fetchone()
        if not notification:
            return error("NOT_FOUND", "Notification was not found.", 404)

        cursor.execute(
            "UPDATE notifications SET is_read = 1, read_at = CURRENT_TIMESTAMP WHERE id = %s",
            (notification_id,),
        )
        cursor.execute("SELECT * FROM notifications WHERE id = %s", (notification_id,))
        updated = cursor.fetchone()

    return success({"notification": serialize_notification(updated)}, "Notification marked as read")
