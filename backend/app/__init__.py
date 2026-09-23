from flask import Flask, send_from_directory
from flask_cors import CORS
from flask_jwt_extended import JWTManager

from .config import Config
from .migrations import apply_pending_migrations
from .seeds import seed_default_role_accounts
from .routes.admin import admin_bp
from .routes.analytics import analytics_bp
from .routes.auth import auth_bp
from .routes.email_verification import email_verification_bp
from .routes.communication import communication_bp
from .routes.demo import demo_bp
from .routes.estates import estates_bp
from .routes.forms import forms_bp
from .routes.health import health_bp
from .routes.installments import installments_bp
from .routes.maintenance import maintenance_bp
from .routes.notifications import notifications_bp
from .routes.payments import payments_bp
from .routes.public import public_bp
from .routes.reports import reports_bp
from .routes.residents import residents_bp
from .routes.sales import sales_bp
from .routes.saved_listings import saved_listings_bp
from .routes.support import support_bp
from .routes.users import users_bp
from .routes.verification import verification_bp
from .routes.visitor_passes import visitor_passes_bp
from .routes.wallet import wallet_bp


def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)

    CORS(app, resources={r"/api/*": {"origins": app.config["CORS_ORIGINS"]}})
    JWTManager(app)

    if app.config["RUN_MIGRATIONS_ON_STARTUP"]:
        with app.app_context():
            applied = apply_pending_migrations()
            if applied:
                app.logger.info("Applied database migrations: %s", ", ".join(applied))

    if app.config["SEED_DEFAULT_ROLE_ACCOUNTS"]:
        with app.app_context():
            created = seed_default_role_accounts()
            if created:
                app.logger.info("Seeded default role accounts: %s", ", ".join(created))

    app.register_blueprint(health_bp)
    app.register_blueprint(auth_bp, url_prefix="/api/v1/auth")
    app.register_blueprint(email_verification_bp, url_prefix="/api/v1/auth/email-verification")
    app.register_blueprint(users_bp, url_prefix="/api/v1/users")
    app.register_blueprint(verification_bp, url_prefix="/api/v1/verification")
    app.register_blueprint(estates_bp, url_prefix="/api/v1/estates")
    app.register_blueprint(sales_bp, url_prefix="/api/v1")
    app.register_blueprint(forms_bp, url_prefix="/api/v1/forms")
    app.register_blueprint(residents_bp, url_prefix="/api/v1")
    app.register_blueprint(admin_bp, url_prefix="/api/v1/admin")
    app.register_blueprint(demo_bp, url_prefix="/api/v1/demo")
    app.register_blueprint(visitor_passes_bp, url_prefix="/api/v1/visitor-passes")
    app.register_blueprint(notifications_bp, url_prefix="/api/v1/notifications")
    app.register_blueprint(reports_bp, url_prefix="/api/v1/reports")
    app.register_blueprint(maintenance_bp, url_prefix="/api/v1/maintenance")
    app.register_blueprint(analytics_bp, url_prefix="/api/v1/analytics")
    app.register_blueprint(saved_listings_bp, url_prefix="/api/v1/saved-listings")
    app.register_blueprint(payments_bp, url_prefix="/api/v1/payments")
    app.register_blueprint(installments_bp, url_prefix="/api/v1/installments")
    app.register_blueprint(public_bp, url_prefix="/api/v1/public")
    app.register_blueprint(support_bp, url_prefix="/api/v1/support")
    app.register_blueprint(communication_bp, url_prefix="/api/v1/communication")
    app.register_blueprint(wallet_bp, url_prefix="/api/v1/wallet")

    @app.get("/uploads/<path:filename>")
    def uploaded_file(filename):
        return send_from_directory(app.config["UPLOAD_DIR"], filename)

    return app
