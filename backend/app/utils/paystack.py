import requests
from flask import current_app


class PaystackError(Exception):
    pass


def _headers():
    return {
        "Authorization": f"Bearer {current_app.config['PAYSTACK_SECRET_KEY']}",
        "Content-Type": "application/json",
    }


def initialize_transaction(email, amount_kobo, reference, callback_url=None, metadata=None, subaccount=None, split=None):
    payload = {
        "email": email,
        "amount": amount_kobo,
        "reference": reference,
        "metadata": metadata or {},
    }
    if callback_url:
        payload["callback_url"] = callback_url
    # Split-payment support (client directive 11a.1): when a Paystack subaccount
    # (the recipient's payout account) and split code have been configured for an
    # estate manager, Paystack auto-splits each transaction at settlement time
    # between the platform (commission) and the recipient. Both values are set per
    # request by the caller; nothing is hardcoded here.
    if subaccount:
        payload["subaccount"] = subaccount
    if split:
        payload["split"] = split

    response = requests.post(
        f"{current_app.config['PAYSTACK_BASE_URL']}/transaction/initialize",
        json=payload,
        headers=_headers(),
        timeout=15,
    )
    body = response.json()
    if not response.ok or not body.get("status"):
        raise PaystackError(body.get("message", "Paystack initialization failed."))
    return body["data"]


def verify_transaction(reference):
    response = requests.get(
        f"{current_app.config['PAYSTACK_BASE_URL']}/transaction/verify/{reference}",
        headers=_headers(),
        timeout=15,
    )
    body = response.json()
    if not response.ok or not body.get("status"):
        raise PaystackError(body.get("message", "Paystack verification failed."))
    return body["data"]
