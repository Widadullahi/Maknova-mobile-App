#!/usr/bin/env python3
"""
Seed realistic demo data through the real API endpoints (not raw SQL), so the
mobile app has content to show on a fresh local database.

Flow: login seeded manager -> create estate -> 3 plots -> 2 buyers ->
reservation -> sale -> installment plan -> second (in-office) sale ->
approve+publish estate (direct DB; no API path exists) -> verify public listing.

Safe to re-run: exits early if the demo estate already exists.

Usage: python3 backend/scripts/seed_demo_data.py
"""
import json
import sys
import urllib.error
import urllib.request

BASE = "http://127.0.0.1:4959/api/v1"
MANAGER_EMAIL = "manager@maknova.example"
MANAGER_PASSWORD = "manager123"
ESTATE_NAME = "Amani Gardens Estate"


def call(method, path, body=None, token=None):
    url = f"{BASE}{path}"
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, method=method)
    req.add_header("Content-Type", "application/json")
    if token:
        req.add_header("Authorization", f"Bearer {token}")
    try:
        with urllib.request.urlopen(req, timeout=20) as resp:
            return resp.status, json.loads(resp.read().decode() or "{}")
    except urllib.error.HTTPError as exc:
        return exc.code, json.loads(exc.read().decode() or "{}")


def step(label, status, body, required=True):
    ok = 200 <= status < 300
    print(f"{'PASS' if ok else 'FAIL'}  {label}: [{status}] {json.dumps(body)[:140]}")
    if not ok and required:
        print("Seeding stopped.")
        sys.exit(1)
    return body


def deep_find(obj, key):
    """Recursively find the first value for `key` in a nested response."""
    if isinstance(obj, dict):
        for k, v in obj.items():
            if k == key and v is not None:
                return v
            found = deep_find(v, key)
            if found is not None:
                return found
    elif isinstance(obj, list):
        for item in obj:
            found = deep_find(item, key)
            if found is not None:
                return found
    return None


def extract_id(body, *keys):
    """Pull the first integer-looking id from the candidate keys."""
    for key in keys:
        value = deep_find(body, key)
        if value is not None:
            try:
                return int(value)
            except (TypeError, ValueError):
                continue
    return None


def main():
    # 1. Login as the seeded (real, DB-backed) estate manager
    status, body = call("POST", "/auth/login", {
        "email": MANAGER_EMAIL, "password": MANAGER_PASSWORD,
    })
    body = step("Login estate manager", status, body)
    token = deep_find(body, "accessToken") or deep_find(body, "token")
    assert token and isinstance(token, str), f"no access token in login response: {json.dumps(body)[:200]}"

    # Re-run guard: if the demo estate is already there, do nothing.
    status, body = call("GET", "/estates", token=token)
    existing = None

    def find_estate(obj):
        if isinstance(obj, dict):
            if obj.get("name") == ESTATE_NAME and obj.get("id") is not None:
                return obj
            for v in obj.values():
                found = find_estate(v)
                if found:
                    return found
        elif isinstance(obj, list):
            for item in obj:
                found = find_estate(item)
                if found:
                    return found
        return None

    if status == 200:
        existing = find_estate(body)
    if existing:
        print(f"SKIP  Estate '{ESTATE_NAME}' already exists (id={existing['id']}). Nothing to do.")
        return

    # 2. Create the estate
    status, body = call("POST", "/estates", {
        "name": ESTATE_NAME,
        "location": "Lekki Phase 2, Lagos",
        "description": "Serviced gated estate with paved roads, drainage, perimeter security and green areas.",
        "contactEmail": "sales@amanigardens.example",
        "contactPhone": "+2348012345678",
    }, token)
    body = step("Create estate", status, body)
    estate_id = extract_id(body, "estateId", "id")
    assert estate_id, f"no estate id in response: {json.dumps(body)[:200]}"

    # 3. Create plots
    plots = [
        {"propertyIdentifier": "PLOT-12A", "propertyType": "residential",
         "plotNumber": "12A", "plotSize": "648 sqm", "price": 25000000,
         "description": "Corner plot facing the central park."},
        {"propertyIdentifier": "PLOT-12B", "propertyType": "residential",
         "plotNumber": "12B", "plotSize": "600 sqm", "price": 22000000,
         "description": "Standard residential plot, 2 blocks from the gate."},
        {"propertyIdentifier": "PLOT-C5", "propertyType": "commercial",
         "plotNumber": "C5", "plotSize": "1000 sqm", "price": 45000000,
         "description": "Commercial plot on the estate service road."},
    ]
    plot_ids = []
    for plot in plots:
        status, body = call("POST", f"/estates/{estate_id}/properties", plot, token)
        body = step(f"Create plot {plot['plotNumber']}", status, body)
        plot_ids.append(extract_id(body, "propertyId", "id"))

    # 4. Create buyers
    buyers = [
        {"fullName": "Chinedu Okafor", "email": "chinedu.okafor@example.com",
         "phone": "+2348023456789", "address": "12 Admiralty Way, Lekki",
         "identityType": "NIN", "identityNumber": "22134567890"},
        {"fullName": "Aisha Bello", "email": "aisha.bello@example.com",
         "phone": "+2348034567890", "address": "7 Palace Road, Oniru",
         "identityType": "Drivers License", "identityNumber": "LAG-889231"},
    ]
    buyer_ids = []
    for buyer in buyers:
        status, body = call("POST", f"/estates/{estate_id}/buyers", buyer, token)
        body = step(f"Create buyer {buyer['fullName']}", status, body)
        buyer_ids.append(extract_id(body, "buyerId", "id"))

    # 5. Reserve PLOT-12B for Aisha
    status, body = call("POST", f"/estates/{estate_id}/reservations", {
        "propertyId": plot_ids[1], "buyerId": buyer_ids[1],
    }, token)
    body = step("Reserve PLOT-12B", status, body)
    reservation_id = extract_id(body, "reservationId", "id")

    # 6. Record the sale (plot stays 'reserved' until Paystack confirms payment)
    status, body = call("POST", f"/estates/{estate_id}/sales", {
        "propertyId": plot_ids[1], "buyerId": buyer_ids[1],
        "reservationId": reservation_id,
        "paymentStatus": "pending", "channel": "online",
        "note": "Online purchase - installment plan agreed.",
    }, token)
    body = step("Record sale (PLOT-12B, online)", status, body)
    sale_id = extract_id(body, "saleId", "id")
    assert sale_id, f"no sale id in response: {json.dumps(body)[:200]}"

    # 7. Attach a 6-installment plan to the sale
    status, body = call("POST", "/installments/plans", {
        "saleId": sale_id, "installmentCount": 6,
    }, token)
    step("Create installment plan (6x)", status, body)

    # 8. Second sale: PLOT-C5 to Chinedu, recorded in-office
    status, body = call("POST", f"/estates/{estate_id}/sales", {
        "propertyId": plot_ids[2], "buyerId": buyer_ids[0],
        "paymentStatus": "pending", "channel": "in_office",
        "note": "Completed physically at the office.",
    }, token)
    step("Record sale (PLOT-C5, in-office)", status, body)

    print()
    print("SQL step: estate approval + publish (no API path exists for this yet).")
    try:
        import pymysql
        conn = pymysql.connect(host="127.0.0.1", port=3306, user="real_estate",
                               password="real_estate", database="real_estate")
        with conn.cursor() as cur:
            cur.execute("UPDATE estates SET status='approved', is_published=1 WHERE id=%s", (estate_id,))
        conn.commit()
        conn.close()
        print(f"PASS  Estate {estate_id} approved + published (direct DB update)")
    except Exception as exc:  # noqa: BLE001 - best effort, print manual SQL instead
        print(f"WARN  Could not auto-publish ({exc}). Run manually:")
        print(f"  docker exec maknova-mysql mysql -uroot -prootpw -e \"")
        print(f"    UPDATE real_estate.estates SET status='approved', is_published=1 WHERE id={estate_id};")
        print(f"  \"")

    # 9. Verify the public listing endpoint
    status, body = call("GET", "/estates/public/properties")
    step("GET public properties (no auth)", status, body, required=False)
    print()
    print(f"IDs -> estate={estate_id} plots={plot_ids} buyers={buyer_ids} sale={sale_id} reservation={reservation_id}")
    print("Done. Log in on the app as manager@maknova.example / manager123")


if __name__ == "__main__":
    main()
