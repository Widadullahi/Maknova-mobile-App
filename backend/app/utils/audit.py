import json


def record_audit_log(cursor, actor_user_id, action, entity_type=None, entity_id=None, metadata=None):
    cursor.execute(
        """
        INSERT INTO audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
        VALUES (%s, %s, %s, %s, %s)
        """,
        (actor_user_id, action, entity_type, entity_id, json.dumps(metadata or {})),
    )
