from pathlib import Path

import pymysql

from .db import get_connection


MIGRATIONS_DIR = Path(__file__).resolve().parents[1] / "migrations"
IDEMPOTENT_MYSQL_ERROR_CODES = {
    1050,  # table already exists
    1060,  # duplicate column name
    1061,  # duplicate key name
    1091,  # cannot drop missing key/column
    1826,  # duplicate foreign key constraint name
}


def split_sql_statements(sql):
    """
    Splits a migration file into individual statements on top-level semicolons,
    tracking quote state so a semicolon inside a string literal isn't treated as
    a statement boundary. Also tracks SQL comments (--, #, /* */): a bug here
    once had a stray apostrophe inside a `--` comment (an English contraction
    like "platform's") flip the quote-tracking state for the rest of the file,
    silently corrupting every statement split after that point. Comments must
    be skipped entirely, not scanned for quote characters.
    """
    statements = []
    current = []
    in_single = False
    in_double = False
    in_line_comment = False
    in_block_comment = False

    index = 0
    length = len(sql)
    while index < length:
        char = sql[index]
        next_char = sql[index + 1] if index + 1 < length else ""

        if in_line_comment:
            current.append(char)
            if char == "\n":
                in_line_comment = False
            index += 1
            continue

        if in_block_comment:
            current.append(char)
            if char == "*" and next_char == "/":
                current.append(next_char)
                index += 2
                in_block_comment = False
                continue
            index += 1
            continue

        if not in_single and not in_double:
            if (char == "-" and next_char == "-") or char == "#":
                in_line_comment = True
                current.append(char)
                index += 1
                continue
            if char == "/" and next_char == "*":
                in_block_comment = True
                current.append(char)
                index += 1
                continue

        if char == "'" and not in_double:
            in_single = not in_single
        elif char == '"' and not in_single:
            in_double = not in_double

        if char == ";" and not in_single and not in_double:
            statement = "".join(current).strip()
            if statement:
                statements.append(statement)
            current = []
        else:
            current.append(char)
        index += 1

    tail = "".join(current).strip()
    if tail:
        statements.append(tail)

    return statements


def ensure_migration_table(cursor):
    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS schema_migrations (
          id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
          filename VARCHAR(255) NOT NULL,
          applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (id),
          UNIQUE KEY schema_migrations_filename_unique (filename)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        """
    )


def apply_pending_migrations():
    migration_files = sorted(MIGRATIONS_DIR.glob("*.sql"))

    if not migration_files:
        return []

    applied = []
    connection = get_connection()

    try:
        with connection.cursor() as cursor:
            ensure_migration_table(cursor)
            connection.commit()

            cursor.execute("SELECT filename FROM schema_migrations")
            applied_names = {row["filename"] for row in cursor.fetchall()}

            for migration_file in migration_files:
                if migration_file.name in applied_names:
                    continue

                sql = migration_file.read_text(encoding="utf-8")
                for statement in split_sql_statements(sql):
                    try:
                        cursor.execute(statement)
                    except pymysql.err.OperationalError as exc:
                        if exc.args and exc.args[0] in IDEMPOTENT_MYSQL_ERROR_CODES:
                            continue
                        raise
                    except pymysql.err.InternalError as exc:
                        if exc.args and exc.args[0] in IDEMPOTENT_MYSQL_ERROR_CODES:
                            continue
                        raise

                cursor.execute(
                    "INSERT INTO schema_migrations (filename) VALUES (%s)",
                    (migration_file.name,),
                )
                connection.commit()
                applied.append(migration_file.name)
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()

    return applied
