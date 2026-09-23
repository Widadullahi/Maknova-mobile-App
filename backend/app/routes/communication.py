from flask import Blueprint, request

from ..db import db_cursor
from ..utils.audit import record_audit_log
from ..utils.authz import require_roles
from ..utils.responses import error, success
from ..utils.scope import GROUP_KEYS, can_access_estate, can_access_group, get_user_estate_ids

communication_bp = Blueprint("communication", __name__)

GROUP_NAMES = {
    "all_residents": "All Residents",
    "estate_managers": "Estate Managers",
    "security_team": "Security Team",
    "maintenance": "Maintenance",
}

ANNOUNCEMENT_CATEGORIES = {
    "general",
    "maintenance",
    "security",
    "event",
    "billing",
}


def serialize_message(row):
    return {
        "id": row["id"],
        "senderUserId": row["sender_user_id"],
        "senderName": row.get("sender_name"),
        "body": row["body"],
        "createdAt": row.get("created_at"),
    }


def serialize_conversation(row):
    return {
        "id": row["id"],
        "type": row["type"],
        "estateId": row.get("estate_id"),
        "title": row.get("title"),
        "createdBy": row["created_by"],
        "createdAt": row.get("created_at"),
        "updatedAt": row.get("updated_at"),
        "participants": row.get("participants", []),
        "lastMessage": row.get("last_message"),
        "unreadCount": row.get("unread_count", 0),
    }


def serialize_announcement(row):
    return {
        "id": row["id"],
        "estateId": row.get("estate_id"),
        "createdBy": row["created_by"],
        "creatorName": row.get("creator_name"),
        "title": row["title"],
        "body": row["body"],
        "category": row.get("category"),
        "pinned": bool(row.get("pinned")),
        "eventAt": row.get("event_at"),
        "createdAt": row.get("created_at"),
        "acknowledgedCount": row.get("acknowledged_count", 0),
        "acknowledgedByMe": bool(row.get("acknowledged_by_me")),
    }


def resolve_primary_estate_id(cursor, current_user, requested_estate_id=None):
    if requested_estate_id:
        return int(requested_estate_id)
    estate_ids = get_user_estate_ids(cursor, current_user)
    if estate_ids is None:
        return None
    if not estate_ids:
        return None
    return sorted(estate_ids)[0]


# --- Direct / ad-hoc group conversations ---


@communication_bp.get("/conversations")
@require_roles()
def list_conversations(current_user):
    with db_cursor() as cursor:
        cursor.execute(
            """
            SELECT c.* FROM conversations c
            JOIN conversation_participants cp ON cp.conversation_id = c.id
            WHERE cp.user_id = %s
            ORDER BY c.updated_at DESC
            LIMIT 100
            """,
            (current_user["id"],),
        )
        conversations = cursor.fetchall()

        results = []
        for conversation in conversations:
            cursor.execute(
                """
                SELECT u.id, u.full_name, u.role
                FROM conversation_participants cp
                JOIN users u ON u.id = cp.user_id
                WHERE cp.conversation_id = %s
                """,
                (conversation["id"],),
            )
            participants = [{"userId": row["id"], "fullName": row["full_name"], "role": row["role"]} for row in cursor.fetchall()]

            cursor.execute(
                """
                SELECT m.*, u.full_name AS sender_name FROM messages m
                JOIN users u ON u.id = m.sender_user_id
                WHERE m.conversation_id = %s
                ORDER BY m.created_at DESC
                LIMIT 1
                """,
                (conversation["id"],),
            )
            last_message_row = cursor.fetchone()

            cursor.execute(
                "SELECT last_read_at FROM conversation_participants WHERE conversation_id = %s AND user_id = %s",
                (conversation["id"], current_user["id"]),
            )
            last_read_row = cursor.fetchone()
            last_read_at = last_read_row["last_read_at"] if last_read_row else None

            if last_read_at:
                cursor.execute(
                    "SELECT COUNT(*) AS count FROM messages WHERE conversation_id = %s AND created_at > %s",
                    (conversation["id"], last_read_at),
                )
            else:
                cursor.execute("SELECT COUNT(*) AS count FROM messages WHERE conversation_id = %s", (conversation["id"],))
            unread_count = cursor.fetchone()["count"]

            conversation["participants"] = participants
            conversation["last_message"] = serialize_message(last_message_row) if last_message_row else None
            conversation["unread_count"] = unread_count
            results.append(serialize_conversation(conversation))

    return success({"conversations": results})


@communication_bp.post("/conversations")
@require_roles()
def create_conversation(current_user):
    payload = request.get_json(silent=True) or {}
    conversation_type = payload.get("type") or "direct"
    participant_ids = [int(pid) for pid in (payload.get("participantUserIds") or []) if pid]
    title = (payload.get("title") or "").strip() or None

    if conversation_type not in ("direct", "group"):
        return error("VALIDATION_ERROR", "Conversation type is not supported.", 422)
    if not participant_ids:
        return error("VALIDATION_ERROR", "At least one other participant is required.", 422)
    if conversation_type == "direct" and len(participant_ids) != 1:
        return error("VALIDATION_ERROR", "Direct conversations must have exactly one other participant.", 422)

    all_participant_ids = sorted(set(participant_ids + [current_user["id"]]))

    with db_cursor(commit=True) as cursor:
        placeholders = ", ".join(["%s"] * len(participant_ids))
        cursor.execute(f"SELECT id FROM users WHERE id IN ({placeholders})", tuple(participant_ids))
        found_ids = {row["id"] for row in cursor.fetchall()}
        missing = set(participant_ids) - found_ids
        if missing:
            return error("NOT_FOUND", "One or more participants were not found.", 404)

        if conversation_type == "direct":
            other_user_id = participant_ids[0]
            cursor.execute(
                """
                SELECT c.id FROM conversations c
                JOIN conversation_participants cp1 ON cp1.conversation_id = c.id AND cp1.user_id = %s
                JOIN conversation_participants cp2 ON cp2.conversation_id = c.id AND cp2.user_id = %s
                WHERE c.type = 'direct'
                LIMIT 1
                """,
                (current_user["id"], other_user_id),
            )
            existing = cursor.fetchone()
            if existing:
                cursor.execute("SELECT * FROM conversations WHERE id = %s", (existing["id"],))
                return success({"conversation": serialize_conversation(cursor.fetchone())}, "Conversation already exists")

        cursor.execute(
            "INSERT INTO conversations (type, title, created_by) VALUES (%s, %s, %s)",
            (conversation_type, title, current_user["id"]),
        )
        conversation_id = cursor.lastrowid
        for user_id in all_participant_ids:
            cursor.execute(
                "INSERT INTO conversation_participants (conversation_id, user_id) VALUES (%s, %s)",
                (conversation_id, user_id),
            )
        cursor.execute("SELECT * FROM conversations WHERE id = %s", (conversation_id,))
        conversation = cursor.fetchone()

    return success({"conversation": serialize_conversation(conversation)}, "Conversation created", 201)


def _assert_participant(cursor, current_user, conversation_id):
    cursor.execute(
        "SELECT 1 FROM conversation_participants WHERE conversation_id = %s AND user_id = %s",
        (conversation_id, current_user["id"]),
    )
    return bool(cursor.fetchone())


@communication_bp.get("/conversations/<int:conversation_id>/messages")
@require_roles()
def list_conversation_messages(current_user, conversation_id):
    with db_cursor() as cursor:
        if not _assert_participant(cursor, current_user, conversation_id) and current_user["role"] not in ("admin", "super_admin"):
            return error("FORBIDDEN", "You are not part of this conversation.", 403)

        cursor.execute(
            """
            SELECT m.*, u.full_name AS sender_name FROM messages m
            JOIN users u ON u.id = m.sender_user_id
            WHERE m.conversation_id = %s
            ORDER BY m.created_at ASC
            LIMIT 500
            """,
            (conversation_id,),
        )
        messages = [serialize_message(row) for row in cursor.fetchall()]

    return success({"messages": messages})


@communication_bp.post("/conversations/<int:conversation_id>/messages")
@require_roles()
def send_conversation_message(current_user, conversation_id):
    payload = request.get_json(silent=True) or {}
    body = (payload.get("body") or "").strip()
    if not body:
        return error("VALIDATION_ERROR", "Message body is required.", 422)

    with db_cursor(commit=True) as cursor:
        if not _assert_participant(cursor, current_user, conversation_id):
            return error("FORBIDDEN", "You are not part of this conversation.", 403)

        cursor.execute(
            "INSERT INTO messages (conversation_id, sender_user_id, body) VALUES (%s, %s, %s)",
            (conversation_id, current_user["id"], body),
        )
        message_id = cursor.lastrowid
        cursor.execute(
            "UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = %s",
            (conversation_id,),
        )
        cursor.execute(
            "UPDATE conversation_participants SET last_read_at = CURRENT_TIMESTAMP WHERE conversation_id = %s AND user_id = %s",
            (conversation_id, current_user["id"]),
        )
        cursor.execute(
            """
            SELECT m.*, u.full_name AS sender_name FROM messages m
            JOIN users u ON u.id = m.sender_user_id
            WHERE m.id = %s
            """,
            (message_id,),
        )
        message = cursor.fetchone()

    return success({"message": serialize_message(message)}, "Message sent", 201)


@communication_bp.patch("/conversations/<int:conversation_id>/read")
@require_roles()
def mark_conversation_read(current_user, conversation_id):
    with db_cursor(commit=True) as cursor:
        if not _assert_participant(cursor, current_user, conversation_id):
            return error("FORBIDDEN", "You are not part of this conversation.", 403)
        cursor.execute(
            "UPDATE conversation_participants SET last_read_at = CURRENT_TIMESTAMP WHERE conversation_id = %s AND user_id = %s",
            (conversation_id, current_user["id"]),
        )

    return success({}, "Marked as read")


@communication_bp.get("/contacts")
@require_roles("resident", "security", "estate_manager")
def list_contacts(current_user):
    """People the current user is allowed to start a direct conversation with —
    scoped to the estate(s) they belong to, not a global user directory."""
    with db_cursor() as cursor:
        estate_ids = get_user_estate_ids(cursor, current_user)
        if not estate_ids:
            return success({"contacts": []})
        placeholders = ", ".join(["%s"] * len(estate_ids))
        params = list(estate_ids)
        contacts = []

        if current_user["role"] in ("resident", "security"):
            cursor.execute(
                f"SELECT DISTINCT u.id, u.full_name, u.role FROM estates e JOIN users u ON u.id = e.manager_user_id WHERE e.id IN ({placeholders})",
                tuple(params),
            )
            contacts.extend(cursor.fetchall())

        if current_user["role"] == "estate_manager":
            cursor.execute(
                f"""
                SELECT DISTINCT u.id, u.full_name, u.role
                FROM residents r JOIN users u ON u.id = r.user_id
                WHERE r.estate_id IN ({placeholders}) AND r.status IN ('verified', 'active')
                """,
                tuple(params),
            )
            contacts.extend(cursor.fetchall())
            cursor.execute(
                f"""
                SELECT DISTINCT u.id, u.full_name, u.role
                FROM security_assignments sa JOIN users u ON u.id = sa.user_id
                WHERE sa.estate_id IN ({placeholders}) AND sa.status = 'active'
                """,
                tuple(params),
            )
            contacts.extend(cursor.fetchall())

        if current_user["role"] == "security":
            cursor.execute(
                f"""
                SELECT DISTINCT u.id, u.full_name, u.role
                FROM security_assignments sa JOIN users u ON u.id = sa.user_id
                WHERE sa.estate_id IN ({placeholders}) AND sa.status = 'active' AND sa.user_id != %s
                """,
                tuple(params) + (current_user["id"],),
            )
            contacts.extend(cursor.fetchall())

    seen = set()
    unique_contacts = []
    for row in contacts:
        if row["id"] in seen or row["id"] == current_user["id"]:
            continue
        seen.add(row["id"])
        unique_contacts.append({"userId": row["id"], "fullName": row["full_name"], "role": row["role"]})

    return success({"contacts": unique_contacts})


# --- Community groups (fixed, auto-membership) ---


@communication_bp.get("/groups")
@require_roles()
def list_groups(current_user):
    requested_estate_id = request.args.get("estateId")
    with db_cursor() as cursor:
        estate_id = resolve_primary_estate_id(cursor, current_user, requested_estate_id)
        if not estate_id:
            return success({"groups": []})

        groups = []
        for group_key in GROUP_KEYS:
            if not can_access_group(cursor, current_user, estate_id, group_key):
                continue
            cursor.execute(
                """
                SELECT m.*, u.full_name AS sender_name FROM community_group_messages m
                JOIN users u ON u.id = m.sender_user_id
                WHERE m.estate_id = %s AND m.group_key = %s
                ORDER BY m.created_at DESC
                LIMIT 1
                """,
                (estate_id, group_key),
            )
            last_message_row = cursor.fetchone()
            groups.append(
                {
                    "estateId": estate_id,
                    "groupKey": group_key,
                    "name": GROUP_NAMES[group_key],
                    "lastMessage": serialize_message(last_message_row) if last_message_row else None,
                }
            )

    return success({"groups": groups})


@communication_bp.get("/groups/<int:estate_id>/<group_key>/messages")
@require_roles()
def list_group_messages(current_user, estate_id, group_key):
    with db_cursor() as cursor:
        if not can_access_group(cursor, current_user, estate_id, group_key):
            return error("FORBIDDEN", "You do not have access to this group.", 403)

        cursor.execute(
            """
            SELECT m.*, u.full_name AS sender_name FROM community_group_messages m
            JOIN users u ON u.id = m.sender_user_id
            WHERE m.estate_id = %s AND m.group_key = %s
            ORDER BY m.created_at ASC
            LIMIT 500
            """,
            (estate_id, group_key),
        )
        messages = [serialize_message(row) for row in cursor.fetchall()]

    return success({"messages": messages})


@communication_bp.post("/groups/<int:estate_id>/<group_key>/messages")
@require_roles()
def send_group_message(current_user, estate_id, group_key):
    payload = request.get_json(silent=True) or {}
    body = (payload.get("body") or "").strip()
    if not body:
        return error("VALIDATION_ERROR", "Message body is required.", 422)

    with db_cursor(commit=True) as cursor:
        if not can_access_group(cursor, current_user, estate_id, group_key):
            return error("FORBIDDEN", "You do not have access to this group.", 403)

        cursor.execute(
            "INSERT INTO community_group_messages (estate_id, group_key, sender_user_id, body) VALUES (%s, %s, %s, %s)",
            (estate_id, group_key, current_user["id"], body),
        )
        message_id = cursor.lastrowid
        cursor.execute(
            """
            SELECT m.*, u.full_name AS sender_name FROM community_group_messages m
            JOIN users u ON u.id = m.sender_user_id
            WHERE m.id = %s
            """,
            (message_id,),
        )
        message = cursor.fetchone()

    return success({"message": serialize_message(message)}, "Message sent", 201)


# --- Announcements ---


@communication_bp.get("/announcements")
@require_roles()
def list_announcements(current_user):
    requested_estate_id = request.args.get("estateId")

    with db_cursor() as cursor:
        where = ["1 = 1"]
        params = []

        if current_user["role"] in ("admin", "super_admin"):
            if requested_estate_id:
                where.append("a.estate_id = %s")
                params.append(requested_estate_id)
        else:
            estate_ids = get_user_estate_ids(cursor, current_user)
            estate_ids = estate_ids or set()
            if estate_ids:
                placeholders = ", ".join(["%s"] * len(estate_ids))
                where.append(f"(a.estate_id IS NULL OR a.estate_id IN ({placeholders}))")
                params.extend(estate_ids)
            else:
                where.append("a.estate_id IS NULL")

        cursor.execute(
            f"""
            SELECT
              a.*,
              u.full_name AS creator_name,
              (SELECT COUNT(*) FROM announcement_acknowledgements ak WHERE ak.announcement_id = a.id) AS acknowledged_count,
              EXISTS(
                SELECT 1 FROM announcement_acknowledgements ak
                WHERE ak.announcement_id = a.id AND ak.user_id = %s
              ) AS acknowledged_by_me
            FROM announcements a
            JOIN users u ON u.id = a.created_by
            WHERE {' AND '.join(where)}
            ORDER BY a.pinned DESC, a.created_at DESC
            LIMIT 200
            """,
            tuple([current_user["id"]] + params),
        )
        announcements = [serialize_announcement(row) for row in cursor.fetchall()]

    return success({"announcements": announcements})


@communication_bp.post("/announcements")
@require_roles("estate_manager", "admin", "super_admin")
def create_announcement(current_user):
    payload = request.get_json(silent=True) or {}
    title = (payload.get("title") or "").strip()
    body = (payload.get("body") or "").strip()
    category = payload.get("category") or "general"
    pinned = bool(payload.get("pinned"))
    event_at = payload.get("eventAt") or None
    estate_id = payload.get("estateId")

    if not title or not body:
        return error("VALIDATION_ERROR", "Title and body are required.", 422)
    if category not in ANNOUNCEMENT_CATEGORIES:
        return error("VALIDATION_ERROR", "Announcement category is not supported.", 422)

    with db_cursor(commit=True) as cursor:
        if current_user["role"] == "estate_manager":
            estate_ids = get_user_estate_ids(cursor, current_user)
            if not estate_id:
                if not estate_ids:
                    return error("VALIDATION_ERROR", "estateId is required.", 422)
                estate_id = sorted(estate_ids)[0]
            elif int(estate_id) not in (estate_ids or set()):
                return error("FORBIDDEN", "You cannot broadcast to this estate.", 403)
        elif estate_id:
            if not can_access_estate(cursor, current_user, int(estate_id)):
                return error("FORBIDDEN", "You cannot broadcast to this estate.", 403)
        # admin/super_admin with no estateId => platform-wide announcement (estate_id NULL)

        cursor.execute(
            """
            INSERT INTO announcements (estate_id, created_by, title, body, category, pinned, event_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            """,
            (estate_id, current_user["id"], title, body, category, 1 if pinned else 0, event_at),
        )
        announcement_id = cursor.lastrowid
        record_audit_log(
            cursor,
            current_user["id"],
            "announcement.created",
            entity_type="announcement",
            entity_id=announcement_id,
            metadata={"estateId": estate_id, "title": title},
        )
        cursor.execute(
            """
            SELECT a.*, u.full_name AS creator_name, 0 AS acknowledged_count, 0 AS acknowledged_by_me
            FROM announcements a JOIN users u ON u.id = a.created_by
            WHERE a.id = %s
            """,
            (announcement_id,),
        )
        announcement = cursor.fetchone()

    return success({"announcement": serialize_announcement(announcement)}, "Announcement published", 201)


@communication_bp.post("/announcements/<int:announcement_id>/acknowledge")
@require_roles()
def acknowledge_announcement(current_user, announcement_id):
    with db_cursor(commit=True) as cursor:
        cursor.execute("SELECT id FROM announcements WHERE id = %s LIMIT 1", (announcement_id,))
        if not cursor.fetchone():
            return error("NOT_FOUND", "Announcement was not found.", 404)

        cursor.execute(
            "INSERT IGNORE INTO announcement_acknowledgements (announcement_id, user_id) VALUES (%s, %s)",
            (announcement_id, current_user["id"]),
        )

    return success({}, "Acknowledged")
