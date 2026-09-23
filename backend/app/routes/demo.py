from copy import deepcopy

from flask import Blueprint
from flask import request

from ..utils.responses import error, success

demo_bp = Blueprint("demo", __name__)


def naira(value):
    return f"₦{value:,.0f}"


FLOWS = {
    "admin-dashboard": {
        "title": "Admin dashboard",
        "status": "demo",
        "stats": [
            {"value": "24", "label": "pending reviews"},
            {"value": "138", "label": "active estates"},
            {"value": "7", "label": "flagged reports"},
        ],
        "sections": [
            {"title": "Review queue", "items": ["Amani Gardens · Planning approval", "Riverbend Estate · Survey plan"]},
            {"title": "Risk alerts", "items": ["2 duplicate title uploads", "1 estate report escalated"]},
        ],
    },
    "payments": {
        "title": "Payments",
        "status": "demo",
        "stats": [
            {"value": naira(124500000), "label": "total revenue"},
            {"value": "18", "label": "active plans"},
            {"value": "6", "label": "overdue"},
        ],
        "sections": [
            {"title": "Recent transactions", "items": ["Plot 14B deposit · Paid", "Estate setup fee · Pending"]},
            {"title": "Distribution", "items": ["Completed 72%", "Pending 18%", "Overdue 10%"]},
        ],
    },
    "communication": {
        "title": "Communication hub",
        "status": "demo",
        "stats": [
            {"value": "12", "label": "unread"},
            {"value": "3", "label": "pinned"},
            {"value": "5", "label": "open issues"},
        ],
        "sections": [
            {"title": "Pinned announcement", "items": ["Water shutdown · Friday 8AM-2PM"]},
            {"title": "Direct chats", "items": ["Security Lead · Gate B update", "Resident: Ada Okafor · Visitor request"]},
        ],
    },
    "visitors": {
        "title": "Visitor operations",
        "status": "demo",
        "stats": [
            {"value": "342", "label": "30-day visits"},
            {"value": "28", "label": "active"},
            {"value": "4", "label": "denied"},
        ],
        "sections": [
            {"title": "Gate status", "items": ["Gate A · Open · Staffed", "Gate B · Open · Staffed"]},
            {"title": "Purpose breakdown", "items": ["Family 42%", "Delivery 24%", "Business 19%"]},
        ],
    },
    "maintenance": {
        "title": "Maintenance",
        "status": "demo",
        "stats": [
            {"value": "14", "label": "open"},
            {"value": "6", "label": "assigned"},
            {"value": "2", "label": "urgent"},
        ],
        "sections": [
            {"title": "Requests", "items": ["Water leak near Plot 14B", "Street light outage Gate B"]},
            {"title": "Providers", "items": ["Prime Plumbing · 4.8", "Lekki Fixers · 4.6"]},
        ],
    },
    "reports": {
        "title": "Reports",
        "status": "demo",
        "stats": [
            {"value": "32%", "label": "sales growth"},
            {"value": "1,248", "label": "users"},
            {"value": "94%", "label": "visitor clearance"},
        ],
        "sections": [
            {"title": "Exports", "items": ["Sales by estate", "Maintenance by priority", "Visitor entries by gate"]},
            {"title": "Trends", "items": ["Weekly collections up 12%", "Visitor peaks Saturday evenings"]},
        ],
    },
}

FLOW_ALIASES = {
    "add-estate": ("reports", "Add new estate"),
    "add-plot": ("reports", "Add plot"),
    "checkout-payment": ("payments", "Checkout"),
    "digital-forms": ("reports", "Digital forms"),
    "document-signing": ("reports", "Preview and sign"),
    "estate-users": ("reports", "Estate users"),
    "fill-form": ("reports", "Fill form"),
    "help-support": ("reports", "Help and support"),
    "installments": ("payments", "Installments"),
    "otp-verification": ("reports", "OTP verification"),
    "maintenance-details": ("maintenance", "Maintenance detail"),
    "maintenance-request": ("maintenance", "Maintenance request"),
    "plot-map": ("reports", "Plot map"),
    "premium-chat": ("communication", "Premium chat"),
    "profile": ("reports", "Profile"),
    "settings": ("reports", "Settings"),
    "transaction-history": ("payments", "Transactions"),
    "visitor-history": ("visitors", "Visitor history"),
    "visitor-dashboard": ("visitors", "Visitor dashboard"),
    "visitor-pass": ("visitors", "Visitor pass"),
}

VISITOR_PASSES = {
    "VP-2026-000482": {
        "code": "VP-2026-000482",
        "pin": "482901",
        "visitorName": "Chinedu Okafor",
        "hostName": "Ada Okafor",
        "estateName": "Amani Gardens Estate",
        "plotNumber": "Plot 14B",
        "purpose": "Family visit",
        "status": "approved",
        "validUntil": "2026-08-01T20:00:00+01:00",
    },
    "VP-2026-000111": {
        "code": "VP-2026-000111",
        "pin": "111222",
        "visitorName": "Delivery Rider",
        "hostName": "Musa Bello",
        "estateName": "Amani Gardens Estate",
        "plotNumber": "Plot 22A",
        "purpose": "Delivery",
        "status": "checked_in",
        "validUntil": "2026-08-01T18:00:00+01:00",
    },
    "VP-2026-000999": {
        "code": "VP-2026-000999",
        "pin": "999000",
        "visitorName": "Unknown Visitor",
        "hostName": "N/A",
        "estateName": "Amani Gardens Estate",
        "plotNumber": "N/A",
        "purpose": "Unverified",
        "status": "denied",
        "validUntil": "2026-08-01T18:00:00+01:00",
    },
}


def resolve_flow(flow_key):
    if flow_key in FLOWS:
      payload = deepcopy(FLOWS[flow_key])
      payload["key"] = flow_key
      return payload

    alias = FLOW_ALIASES.get(flow_key)
    if not alias:
        return None

    canonical_key, title = alias
    payload = deepcopy(FLOWS[canonical_key])
    payload["key"] = flow_key
    payload["canonicalKey"] = canonical_key
    payload["title"] = title
    return payload


@demo_bp.get("/flows")
def list_demo_flows():
    flows = [{"key": key, "title": value["title"], "status": value["status"]} for key, value in FLOWS.items()]
    flows.extend(
        {"key": key, "title": title, "status": "demo", "canonicalKey": canonical}
        for key, (canonical, title) in FLOW_ALIASES.items()
    )
    return success({"flows": flows})


@demo_bp.get("/flows/<flow_key>")
def get_demo_flow(flow_key):
    flow = resolve_flow(flow_key)
    if not flow:
        return error("NOT_FOUND", "Demo flow was not found.", 404)

    return success({"flow": flow})


@demo_bp.get("/overview")
def get_demo_overview():
    return success(
        {
            "overview": {
                "productStatus": "UI-first demo",
                "implementedFlows": len(FLOWS) + len(FLOW_ALIASES),
                "backendMode": "database-free demo endpoints",
                "nextIntegrationStep": "replace demo payloads with MySQL-backed service queries",
            }
        }
    )


def extract_pass_code(payload):
    qr_payload = (payload.get("qrPayload") or payload.get("code") or "").strip()
    pin = (payload.get("pin") or "").strip()

    if pin:
        for visitor_pass in VISITOR_PASSES.values():
            if visitor_pass["pin"] == pin:
                return visitor_pass["code"]

    if "visitor-pass/" in qr_payload:
        return qr_payload.split("visitor-pass/", 1)[1].split("?", 1)[0].strip()

    return qr_payload


@demo_bp.post("/visitor-passes/verify")
def verify_visitor_pass():
    payload = request.get_json(silent=True) or {}
    pass_code = extract_pass_code(payload)
    visitor_pass = VISITOR_PASSES.get(pass_code)

    if not visitor_pass:
        return success(
            {
                "verification": {
                    "status": "not_found",
                    "message": "Visitor pass was not found.",
                    "pass": None,
                }
            }
        )

    status = visitor_pass["status"]
    message_by_status = {
        "approved": "Pass is valid. Visitor can be checked in.",
        "checked_in": "Pass has already been used for check-in.",
        "denied": "Pass is denied and cannot be used for entry.",
        "expired": "Pass has expired.",
    }

    return success(
        {
            "verification": {
                "status": status,
                "message": message_by_status.get(status, "Pass requires manual review."),
                "pass": visitor_pass,
            }
        }
    )
