from contextlib import contextmanager

import pymysql
from flask import current_app


def get_connection():
    connect_kwargs = dict(
        host=current_app.config["MYSQL_HOST"],
        port=current_app.config["MYSQL_PORT"],
        user=current_app.config["MYSQL_USER"],
        password=current_app.config["MYSQL_PASSWORD"],
        database=current_app.config["MYSQL_DATABASE"],
        cursorclass=pymysql.cursors.DictCursor,
        autocommit=False,
        connect_timeout=10,
    )
    # Legacy SQL TLS connection. PyMySQL 1.x takes
    # ssl as a dict, not individual kwargs. When MYSQL_SSL_CA is empty (local
    # development) no TLS config is passed and behavior is unchanged.
    ssl_ca = current_app.config.get("MYSQL_SSL_CA")
    if ssl_ca:
        connect_kwargs["ssl"] = {"ca": ssl_ca}
        connect_kwargs["ssl_verify_cert"] = True
        connect_kwargs["ssl_verify_identity"] = current_app.config.get("MYSQL_SSL_VERIFY_IDENTITY", False)
    return pymysql.connect(**connect_kwargs)


@contextmanager
def db_cursor(commit=False):
    connection = get_connection()
    try:
        with connection.cursor() as cursor:
            yield cursor
        if commit:
            connection.commit()
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()
