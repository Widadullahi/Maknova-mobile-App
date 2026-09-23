import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from flask import current_app


def send_email(to_address, subject, html_body, text_body=None):
    """
    Sends a transactional email over SMTP using the app's configured provider.

    Returns True when the message was handed to the SMTP server, False when no
    SMTP provider is configured (callers then fall back to a dev-only delivery
    path, e.g. logging the code) or when delivery failed.
    """
    host = current_app.config.get("EMAIL_SMTP_HOST", "")
    if not host:
        return False

    user = current_app.config.get("EMAIL_SMTP_USER", "")
    port = int(current_app.config.get("EMAIL_SMTP_PORT", "587"))
    from_address = current_app.config.get("EMAIL_FROM", "")

    message = MIMEMultipart("alternative")
    message["Subject"] = subject
    message["From"] = from_address
    message["To"] = to_address
    message.attach(MIMEText(text_body or html_body, "plain"))
    message.attach(MIMEText(html_body, "html"))

    try:
        if port == 465:
            server = smtplib.SMTP_SSL(host, port, timeout=15)
        else:
            server = smtplib.SMTP(host, port, timeout=15)
            server.starttls()
        try:
            if user:
                server.login(user, current_app.config.get("EMAIL_SMTP_PASSWORD", ""))
            server.send_message(message)
        finally:
            server.quit()
        return True
    except Exception as exc:  # noqa: BLE001 - delivery is best-effort, never crash the request
        current_app.logger.warning("Email send failed for %s: %s", to_address, exc)
        return False