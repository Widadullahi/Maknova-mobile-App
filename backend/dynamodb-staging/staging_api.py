"""Isolated DynamoDB authentication slice. Not a complete application backend.

No MySQL imports, startup migrations, default credentials or production URLs.
Unported endpoints explicitly return 503 instead of silently using MySQL.
"""
from datetime import timedelta
import os

from flask import Flask, jsonify, request
from flask_cors import CORS
from flask_jwt_extended import (
    JWTManager, create_access_token, create_refresh_token, get_jwt_identity, jwt_required,
)
from werkzeug.security import check_password_hash

from migration import aws_table, keypart


def create_app(table=None, jwt_secret=None):
    app = Flask(__name__)
    secret = jwt_secret or os.environ.get("STAGING_JWT_SECRET")
    if not secret or len(secret) < 32:
        raise ValueError("A separate STAGING_JWT_SECRET of at least 32 characters is required")
    app.config.update(JWT_SECRET_KEY=secret, JWT_ACCESS_TOKEN_EXPIRES=timedelta(minutes=30),
                      JWT_REFRESH_TOKEN_EXPIRES=timedelta(days=30))
    JWTManager(app)
    origins = os.getenv("STAGING_CORS_ORIGINS", "http://127.0.0.1:8082").split(",")
    CORS(app, resources={r"/api/*": {"origins": origins}})
    store = table if table is not None else aws_table(
        os.environ["STAGING_DYNAMODB_TABLE"], os.getenv("AWS_REGION", "eu-west-1"),
        os.getenv("DYNAMODB_ENDPOINT_URL"), os.getenv("AWS_PROFILE"))

    def success(data, message="Request successful"):
        return jsonify(data=data, message=message)

    def error(code, message, status):
        return jsonify(error={"code": code, "message": message}), status

    def get_user(identity):
        # Imported users retain their original integer identifiers.
        try:
            numeric_id = int(identity)
        except (ValueError, TypeError):
            return None
        result = store.get_item(Key={"PK": f"ROW#users#{keypart([numeric_id])}", "SK": "ROW"},
                                ConsistentRead=True).get("Item")
        return result.get("data") if result else None

    def serialize(user):
        return {"id": int(user["id"]), "fullName": user["full_name"], "email": user["email"],
                "phone": user.get("phone"), "role": user["role"], "accountStatus": user["account_status"]}

    def tokens(user):
        return {"accessToken": create_access_token(identity=str(user["id"])),
                "refreshToken": create_refresh_token(identity=str(user["id"]))}

    @app.get("/health")
    def health():
        # Accessing the table distinguishes health from a static HTTP response.
        store.get_item(Key={"PK": "MIGRATION", "SK": "SNAPSHOT"}, ConsistentRead=True)
        return success({"status": "ok", "database": "dynamodb", "stage": "local-migration",
                        "runtimeCutoverReady": False})

    @app.post("/api/v1/auth/login")
    def login():
        marker = store.get_item(Key={"PK": "MIGRATION", "SK": "SNAPSHOT"}, ConsistentRead=True).get("Item")
        if not marker or marker.get("status") != "verified":
            return error("MIGRATION_PENDING", "The staging import has not been verified.", 503)
        body = request.get_json(silent=True) or {}
        email = str(body.get("email") or "").strip().lower()
        password = body.get("password") or ""
        if not email or not isinstance(password, str) or not password:
            return error("VALIDATION_ERROR", "Email and password are required.", 422)
        pointer = store.get_item(Key={"PK": f"UNIQUE#users#email#{email}", "SK": "LOCK"},
                                 ConsistentRead=True).get("Item")
        record = store.get_item(Key={"PK": pointer["recordPK"], "SK": "ROW"},
                                ConsistentRead=True).get("Item") if pointer else None
        user = record.get("data") if record else None
        if not user or not check_password_hash(user["password_hash"], password):
            return error("INVALID_CREDENTIALS", "Email or password is incorrect.", 401)
        if user["account_status"] in {"suspended", "rejected"}:
            return error("ACCOUNT_RESTRICTED", "This account is restricted.", 403)
        roles = {"admin": {"admin", "super_admin"}, "manager": {"estate_manager"}}
        portal = str(body.get("portal") or "").strip().lower()
        if portal in roles and user["role"] not in roles[portal]:
            return error("FORBIDDEN", "This account cannot use this portal.", 403)
        return success({"user": serialize(user), "tokens": tokens(user)}, "Logged in")

    @app.get("/api/v1/auth/me")
    @app.get("/api/v1/users/me")
    @jwt_required()
    def me():
        user = get_user(get_jwt_identity())
        if not user:
            return error("UNAUTHORIZED", "Account was not found.", 401)
        if user["account_status"] in {"suspended", "rejected"}:
            return error("ACCOUNT_RESTRICTED", "This account is restricted.", 403)
        return success({"user": serialize(user)})

    @app.post("/api/v1/auth/refresh")
    @jwt_required(refresh=True)
    def refresh():
        user = get_user(get_jwt_identity())
        if not user or user["account_status"] in {"suspended", "rejected"}:
            return error("UNAUTHORIZED", "This account cannot refresh its session.", 401)
        return success({"tokens": tokens(user)})

    @app.post("/api/v1/auth/logout")
    @jwt_required(optional=True)
    def logout():
        return success({}, "Logged out")

    @app.errorhandler(404)
    def unported(_error):
        return error("MIGRATION_PENDING", "This workflow has not been ported to DynamoDB. Keep using the existing testing backend.", 503)

    return app


if __name__ == "__main__":
    create_app().run(host="127.0.0.1", port=4960, debug=False)
