from flask import current_app

DEFAULTS = {
    "commission_percent": lambda: current_app.config["PLATFORM_COMMISSION_PERCENT"],
    "buyer_transaction_fee_percent": lambda: 2.20,
    "seller_commission_percent": lambda: 1.50,
    "guest_pass_fee": lambda: current_app.config["DEFAULT_GUEST_PASS_FEE"],
}


def get_setting(cursor, key):
    cursor.execute("SELECT setting_value FROM platform_settings WHERE setting_key = %s LIMIT 1", (key,))
    row = cursor.fetchone()
    if row:
        return float(row["setting_value"])
    return DEFAULTS[key]()


def set_setting(cursor, key, value, updated_by):
    cursor.execute(
        """
        INSERT INTO platform_settings (setting_key, setting_value, updated_by)
        VALUES (%s, %s, %s)
        ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value), updated_by = VALUES(updated_by)
        """,
        (key, str(value), updated_by),
    )


def get_commission_percent(cursor):
    return get_setting(cursor, "commission_percent")

def get_buyer_transaction_fee_percent(cursor):
    return get_setting(cursor, "buyer_transaction_fee_percent")

def get_seller_commission_percent(cursor):
    return get_setting(cursor, "seller_commission_percent")


def get_guest_pass_fee(cursor):
    return get_setting(cursor, "guest_pass_fee")
