DEMO_PASSWORD = "demo1234"
DEMO_ESTATE_MANAGER_EMAIL = "demo@estate.com"
DEMO_ADMIN_EMAIL = "admin@estate.com"
DEMO_RESIDENT_EMAIL = "resident@estate.com"
DEMO_SECURITY_EMAIL = "security@estate.com"
DEMO_BUYER_EMAIL = "buyer@estate.com"

DEMO_USERS_BY_EMAIL = {
    DEMO_ADMIN_EMAIL: {
        "id": "demo-admin",
        "full_name": "Demo Admin",
        "email": DEMO_ADMIN_EMAIL,
        "phone": "+234 800 000 0099",
        "role": "admin",
        "account_status": "active",
    },
    DEMO_ESTATE_MANAGER_EMAIL: {
        "id": "demo-estate-manager",
        "full_name": "Demo Estate Manager",
        "email": DEMO_ESTATE_MANAGER_EMAIL,
        "phone": "+234 800 000 0000",
        "role": "estate_manager",
        "account_status": "active",
    },
    DEMO_RESIDENT_EMAIL: {
        "id": "demo-resident",
        "full_name": "Demo Resident",
        "email": DEMO_RESIDENT_EMAIL,
        "phone": "+234 800 000 0001",
        "role": "resident",
        "account_status": "active",
    },
    DEMO_SECURITY_EMAIL: {
        "id": "demo-security",
        "full_name": "Demo Security",
        "email": DEMO_SECURITY_EMAIL,
        "phone": "+234 800 000 0002",
        "role": "security",
        "account_status": "active",
    },
    DEMO_BUYER_EMAIL: {
        "id": "demo-buyer",
        "full_name": "Demo Buyer",
        "email": DEMO_BUYER_EMAIL,
        "phone": "+234 800 000 0003",
        "role": "buyer",
        "account_status": "active",
    },
}

DEMO_USERS_BY_ID = {user["id"]: user for user in DEMO_USERS_BY_EMAIL.values()}


def is_demo_identity(user_id):
    return user_id in DEMO_USERS_BY_ID


def get_demo_user(user_id):
    return DEMO_USERS_BY_ID.get(user_id)
