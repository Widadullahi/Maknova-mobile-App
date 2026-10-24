from .db import db_cursor
from .utils.audit import record_audit_log
from .utils.security import hash_password

DEFAULT_ROLE_ACCOUNTS = [
    {
        "full_name": "Tomiwa Super Admin",
        "email": "devtomiwa9@gmail.com",
        "phone": None,
        "role": "super_admin",
        "password": "superadmin123",
        "account_status": "active",
    },
    {
        "full_name": "Seed Admin",
        "email": "admin@maknova.example",
        "phone": None,
        "role": "admin",
        "password": "admin123",
        "account_status": "active",
    },
    {
        "full_name": "Seed Estate Manager",
        "email": "manager@maknova.example",
        "phone": None,
        "role": "estate_manager",
        "password": "manager123",
        "account_status": "active",
    },
    {
        "full_name": "Seed Resident",
        "email": "resident@maknova.example",
        "phone": None,
        "role": "resident",
        "password": "resident123",
        "account_status": "active",
    },
    {
        "full_name": "Seed Buyer",
        "email": "buyer@maknova.example",
        "phone": None,
        "role": "buyer",
        "password": "buyer123",
        "account_status": "active",
    },
    {
        "full_name": "Seed Security",
        "email": "security@maknova.example",
        "phone": None,
        "role": "security",
        "password": "security123",
        "account_status": "active",
    },
    {
        "full_name": "Seed Public User",
        "email": "public@maknova.example",
        "phone": None,
        "role": "public_user",
        "password": "public123",
        "account_status": "active",
    },
]


def seed_default_role_accounts():
    created = []

    with db_cursor(commit=True) as cursor:
        for account in DEFAULT_ROLE_ACCOUNTS:
            cursor.execute("SELECT id FROM users WHERE email = %s LIMIT 1", (account["email"],))
            if cursor.fetchone():
                continue

            cursor.execute(
                """
                INSERT INTO users (full_name, email, phone, password_hash, role, account_status)
                VALUES (%s, %s, %s, %s, %s, %s)
                """,
                (
                    account["full_name"],
                    account["email"],
                    account["phone"],
                    hash_password(account["password"]),
                    account["role"],
                    account["account_status"],
                ),
            )
            user_id = cursor.lastrowid
            created.append(account["email"])
            record_audit_log(
                cursor,
                user_id,
                "seed.default_role_account_created",
                "user",
                user_id,
                {"role": account["role"], "email": account["email"]},
            )

    return created
