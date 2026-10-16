"""
Notification creation + Expo push dispatch.

Two halves, on purpose:

1. create_notification(cursor, ...) inserts a notifications row on the route's
   own cursor, so the row commits atomically with the event that produced it.
2. Push delivery is queued (queue_push) and sent later (flush_push_queue),
   after the surrounding transaction has committed. A push therefore never goes
   out for a transaction that rolled back, and a slow/failing push provider can
   never break or roll back the request itself.

Routes that queue pushes must call flush_push_queue() after their
`with db_cursor(commit=True)` block. flush_push_queue never raises: push
failure is logged, never surfaced to the API caller.
"""
import logging

import requests
from flask import current_app

logger = logging.getLogger(__name__)

EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"
# Expo's push endpoint accepts at most 100 messages per request.
EXPO_PUSH_BATCH_SIZE = 100
# Must match the defaultChannel configured for expo-notifications in app.json.
EXPO_PUSH_CHANNEL_ID = "estateflow"

_push_queue = []


def create_notification(
    cursor,
    *,
    user_id=None,
    role=None,
    title,
    body,
    type="info",
    entity_type=None,
    entity_id=None,
):
    """Insert one notification row inside the caller's transaction.

    user_id targets one account; role creates a broadcast row visible to every
    account with that role (the list endpoint already resolves role rows).
    """
    cursor.execute(
        """
        INSERT INTO notifications (user_id, role, title, body, type, entity_type, entity_id)
        VALUES (%s, %s, %s, %s, %s, %s, %s)
        """,
        (user_id, role, title, body, type, entity_type, entity_id),
    )


def queue_push(user_ids=None, role=None, *, title, body, data=None):
    """Queue a push notification for delivery once the transaction commits."""
    targets = [uid for uid in (user_ids or []) if uid is not None]
    if not targets and not role:
        return
    _push_queue.append(
        {
            "userIds": targets,
            "role": role,
            "title": title,
            "body": body,
            "data": data or {},
        }
    )


def flush_push_queue():
    """Deliver everything queued since the last flush. Call after commit."""
    if not _push_queue:
        return

    queued = list(_push_queue)
    _push_queue.clear()

    if not current_app.config.get("EXPO_PUSH_ENABLED", True):
        return

    try:
        from ..db import db_cursor

        messages = []
        with db_cursor() as cursor:
            for item in queued:
                for token in _expo_tokens_for(cursor, item):
                    messages.append(
                        {
                            "to": token,
                            "title": item["title"],
                            "body": item["body"],
                            "data": item["data"],
                            "sound": "default",
                            "channelId": EXPO_PUSH_CHANNEL_ID,
                        }
                    )

        if not messages:
            return

        for start in range(0, len(messages), EXPO_PUSH_BATCH_SIZE):
            batch = messages[start : start + EXPO_PUSH_BATCH_SIZE]
            response = requests.post(
                EXPO_PUSH_URL,
                json=batch,
                timeout=5,
                headers={"Accept": "application/json"},
            )
            if response.status_code >= 400:
                logger.warning("Expo push dispatch returned HTTP %s", response.status_code)
    except requests.RequestException:
        logger.warning("Expo push dispatch failed", exc_info=True)
    except Exception:
        # A notification/push problem must never take down the API request that
        # already committed its real work.
        logger.exception("Push dispatch failed unexpectedly")


def _expo_tokens_for(cursor, item):
    if item["userIds"]:
        placeholders = ", ".join(["%s"] * len(item["userIds"]))
        cursor.execute(
            f"SELECT token FROM push_tokens WHERE user_id IN ({placeholders})",
            tuple(item["userIds"]),
        )
    elif item["role"]:
        cursor.execute(
            """
            SELECT pt.token
            FROM push_tokens pt
            JOIN users u ON u.id = pt.user_id
            WHERE u.role = %s
            """,
            (item["role"],),
        )
    else:
        return []

    # Only Expo push tokens can be delivered through the Expo push service.
    # Anything else (raw FCM/APNs tokens) is ignored.
    return [
        row["token"]
        for row in cursor.fetchall()
        if str(row["token"] or "").startswith("ExponentPushToken[")
    ]
