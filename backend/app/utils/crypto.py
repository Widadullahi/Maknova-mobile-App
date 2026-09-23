import base64
import hashlib
import json

from flask import current_app
from cryptography.fernet import Fernet


def _derive_key(context):
    secret = current_app.config["APP_SECRET"].encode("utf-8")
    digest = hashlib.sha256(secret + b":" + context.encode("utf-8")).digest()
    return base64.urlsafe_b64encode(digest)


def encrypt_json(payload, context):
    plaintext = json.dumps(payload, separators=(",", ":"), sort_keys=True).encode("utf-8")
    return Fernet(_derive_key(context)).encrypt(plaintext).decode("ascii")


def decrypt_json(token, context):
    plaintext = Fernet(_derive_key(context)).decrypt(token.encode("ascii"))
    return json.loads(plaintext.decode("utf-8"))
