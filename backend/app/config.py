import os
from datetime import timedelta

from dotenv import load_dotenv

load_dotenv()


class Config:
    APP_SECRET = os.getenv("APP_SECRET", os.getenv("SECRET_KEY", "dev-secret"))
    SECRET_KEY = os.getenv("SECRET_KEY", "dev-secret")
    JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "dev-jwt-secret")
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(minutes=30)
    JWT_REFRESH_TOKEN_EXPIRES = timedelta(days=30)
    # Query-string token support exists only so the admin/manager dashboards can put a
    # private document behind a plain <img>/<a href> tag (browsers don't attach
    # Authorization headers to those). It accepts the exact same JWT as the header
    # does — no separate/weaker credential — and every document endpoint still runs
    # its normal role/ownership check regardless of which location the token came from.
    JWT_TOKEN_LOCATION = ["headers", "query_string"]
    JWT_QUERY_STRING_NAME = "access_token"
    CORS_ORIGINS = os.getenv("CORS_ORIGINS", "*").split(",")

    MYSQL_HOST = os.getenv("MYSQL_HOST", "127.0.0.1")
    MYSQL_PORT = int(os.getenv("MYSQL_PORT", "3306"))
    MYSQL_USER = os.getenv("MYSQL_USER", "real_estate")
    MYSQL_PASSWORD = os.getenv("MYSQL_PASSWORD", "real_estate")
    MYSQL_DATABASE = os.getenv("MYSQL_DATABASE", "real_estate")
    # Managed-MySQL TLS (Aiven/RDS/DigitalOcean). Point MYSQL_SSL_CA at the
    # provider's CA certificate file; empty = no TLS (local/VPS dev unchanged).
    MYSQL_SSL_CA = os.getenv("MYSQL_SSL_CA", "")
    MYSQL_SSL_VERIFY_IDENTITY = os.getenv("MYSQL_SSL_VERIFY_IDENTITY", "false").lower() in ("1", "true", "yes")
    RUN_MIGRATIONS_ON_STARTUP = os.getenv("RUN_MIGRATIONS_ON_STARTUP", "true").lower() in ("1", "true", "yes")
    # Demo login accounts (utils/demo.py). Disabled by default — production must
    # never accept demo@estate.com / demo1234. Set DEMO_LOGIN_ENABLED=true ONLY in
    # local/demo environments where the seeded demo identities are needed.
    DEMO_LOGIN_ENABLED = os.getenv("DEMO_LOGIN_ENABLED", "false").lower() in ("1", "true", "yes")
    # Expo push service (https://exp.host). Device tokens are registered by the
    # mobile app via POST /notifications/push-token. Disable in dev to skip all
    # outbound push calls.
    EXPO_PUSH_ENABLED = os.getenv("EXPO_PUSH_ENABLED", "true").lower() in ("1", "true", "yes")
    SEED_DEFAULT_ROLE_ACCOUNTS = os.getenv("SEED_DEFAULT_ROLE_ACCOUNTS", "true").lower() in ("1", "true", "yes")
    UPLOAD_DIR = os.getenv(
        "UPLOAD_DIR",
        os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "uploads")),
    )
    # Outside UPLOAD_DIR on purpose: UPLOAD_DIR is served publicly (unauthenticated) via
    # the /uploads/<path:filename> route in __init__.py. Private title/structural
    # documents (verification docs, plot title/allocation docs, deeds) must never be
    # reachable through that public static route, so they live here instead and are
    # only ever served through authenticated, role-checked endpoints.
    PRIVATE_UPLOAD_DIR = os.getenv(
        "PRIVATE_UPLOAD_DIR",
        os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "private_uploads")),
    )

    # Paystack test keys (client-provided, 2026-08-04). Secret key must never be sent to the mobile app.
    PAYSTACK_PUBLIC_KEY = os.getenv("PAYSTACK_PUBLIC_KEY", "pk_test_768d5db0541db9fd7d088edfc9fc814a1ffc31c0")
    PAYSTACK_SECRET_KEY = os.getenv("PAYSTACK_SECRET_KEY", "")
    PAYSTACK_BASE_URL = os.getenv("PAYSTACK_BASE_URL", "https://api.paystack.co")
    PLATFORM_COMMISSION_PERCENT = float(os.getenv("PLATFORM_COMMISSION_PERCENT", "2.00"))
    # Paystack split-payment accounts (client directive 11a.1). When the recipient
    # (estate manager/distributor) subaccount code is configured, every initialized
    # sale transaction is passed `subaccount` + `split` so Paystack auto-splits at
    # settlement between the platform commission and the recipient. Leave empty to
    # collect into the master account and split in the legacy (charge-on-top) mode.
    PAYSTACK_SUBACCOUNT_CODE = os.getenv("PAYSTACK_SUBACCOUNT_CODE", "")
    PAYSTACK_SPLIT_CODE = os.getenv("PAYSTACK_SPLIT_CODE", "")
    # Flat naira fee deducted from a resident's wallet per guest pass generated.
    # Configurable at runtime by the Master Owner via platform_settings; this is
    # only the fallback used before that setting has ever been saved.
    DEFAULT_GUEST_PASS_FEE = float(os.getenv("DEFAULT_GUEST_PASS_FEE", "50.00"))

    # Transactional email (SMTP) — see .env.example. When EMAIL_SMTP_HOST is empty the backend does
    # NOT send mail; the register-time OTP endpoint returns the code in the
    # response (devCode) and logs it so development can proceed without a provider.
    EMAIL_SMTP_HOST = os.getenv("EMAIL_SMTP_HOST", "")
    EMAIL_SMTP_PORT = int(os.getenv("EMAIL_SMTP_PORT", "587"))
    EMAIL_SMTP_USER = os.getenv("EMAIL_SMTP_USER", "")
    EMAIL_SMTP_PASSWORD = os.getenv("EMAIL_SMTP_PASSWORD", "")
    EMAIL_FROM = os.getenv("EMAIL_FROM", "Maknova Platform <no-reply@watchup.site>")
    EMAIL_OTP_TTL_MINUTES = int(os.getenv("EMAIL_OTP_TTL_MINUTES", "15"))
