from flask import Blueprint, request

from ..db import db_cursor
from ..routes.estates import can_manage_estate, get_estate
from ..utils.audit import record_audit_log
from ..utils.authz import require_roles
from ..utils.responses import error, success

sales_bp = Blueprint("sales", __name__)


def serialize_buyer(row):
    return {
        "id": row["id"],
        "estateId": row["estate_id"],
        "fullName": row["full_name"],
        "email": row.get("email"),
        "phone": row.get("phone"),
        "address": row.get("address"),
        "identityType": row.get("identity_type"),
        "identityNumber": row.get("identity_number"),
    }


def serialize_reservation(row):
    return {
        "id": row["id"],
        "estateId": row["estate_id"],
        "propertyId": row["property_id"],
        "buyerId": row["buyer_id"],
        "status": row["status"],
        "reservedUntil": row.get("reserved_until"),
        "note": row.get("note"),
    }


def serialize_sale(row):
    return {
        "id": row["id"],
        "estateId": row["estate_id"],
        "propertyId": row["property_id"],
        "buyerId": row["buyer_id"],
        "reservationId": row.get("reservation_id"),
        "salePrice": float(row["sale_price"] or 0),
        "paymentStatus": row["payment_status"],
        "channel": row.get("channel") or "online",
        "status": row["status"],
        "note": row.get("note"),
    }


def serialize_allocation(row):
    return {
        "id": row["id"],
        "estateId": row["estate_id"],
        "propertyId": row["property_id"],
        "buyerId": row["buyer_id"],
        "saleId": row.get("sale_id"),
        "allocationReference": row["allocation_reference"],
        "allocatedAt": row.get("allocated_at"),
        "note": row.get("note"),
    }


def ensure_estate_access(cursor, current_user, estate_id):
    estate = get_estate(cursor, estate_id)
    if not estate:
        return None, error("NOT_FOUND", "Estate was not found.", 404)
    if not can_manage_estate(current_user, estate):
        return None, error("FORBIDDEN", "You cannot manage records for this estate.", 403)
    return estate, None


def ensure_property(cursor, estate_id, property_id):
    cursor.execute(
        "SELECT * FROM properties WHERE id = %s AND estate_id = %s LIMIT 1",
        (property_id, estate_id),
    )
    return cursor.fetchone()


def has_active_transaction(cursor, property_id):
    cursor.execute(
        """
        SELECT id FROM reservations
        WHERE property_id = %s AND status = 'active'
        LIMIT 1
        """,
        (property_id,),
    )
    if cursor.fetchone():
        return True

    cursor.execute(
        """
        SELECT id FROM sales
        WHERE property_id = %s AND status IN ('draft', 'active', 'completed')
        LIMIT 1
        """,
        (property_id,),
    )
    return bool(cursor.fetchone())


def update_property_status(cursor, property_id, current_user_id, next_status, note):
    cursor.execute("SELECT status FROM properties WHERE id = %s LIMIT 1", (property_id,))
    row = cursor.fetchone()
    previous_status = row["status"] if row else None
    cursor.execute("UPDATE properties SET status = %s WHERE id = %s", (next_status, property_id))
    cursor.execute(
        """
        INSERT INTO property_status_history
          (property_id, previous_status, next_status, changed_by, note)
        VALUES (%s, %s, %s, %s, %s)
        """,
        (property_id, previous_status, next_status, current_user_id, note),
    )


def expire_reservations(cursor):
    """Release reservations whose configured hold date has passed.

    This is deliberately safe to run repeatedly. It is called from sales reads
    and writes, while a scheduled worker can call the same function later for
    expiry even when nobody is actively using the dashboard.
    """
    cursor.execute(
        """
        SELECT id, property_id FROM reservations
        WHERE status = 'active' AND reserved_until IS NOT NULL AND reserved_until < CURRENT_DATE
        """
    )
    expired = cursor.fetchall()
    for reservation in expired:
        cursor.execute("UPDATE reservations SET status = 'expired' WHERE id = %s", (reservation["id"],))
        cursor.execute(
            """
            UPDATE properties p
            LEFT JOIN sales s ON s.property_id = p.id AND s.status IN ('draft', 'active', 'completed')
            SET p.status = 'available'
            WHERE p.id = %s AND p.status = 'reserved' AND s.id IS NULL
            """,
            (reservation["property_id"],),
        )
    return len(expired)


@sales_bp.get("/estates/<int:estate_id>/buyers")
@require_roles("estate_manager", "admin", "super_admin")
def list_buyers(current_user, estate_id):
    with db_cursor() as cursor:
        expire_reservations(cursor)
        _, access_error = ensure_estate_access(cursor, current_user, estate_id)
        if access_error:
            return access_error

        cursor.execute("SELECT * FROM buyers WHERE estate_id = %s ORDER BY created_at DESC LIMIT 200", (estate_id,))
        buyers = [serialize_buyer(row) for row in cursor.fetchall()]

    return success({"buyers": buyers})


@sales_bp.post("/estates/<int:estate_id>/buyers")
@require_roles("estate_manager", "admin", "super_admin")
def create_buyer(current_user, estate_id):
    payload = request.get_json(silent=True) or {}
    full_name = (payload.get("fullName") or "").strip()

    if not full_name:
        return error("VALIDATION_ERROR", "Buyer full name is required.", 422)

    with db_cursor(commit=True) as cursor:
        _, access_error = ensure_estate_access(cursor, current_user, estate_id)
        if access_error:
            return access_error

        cursor.execute(
            """
            INSERT INTO buyers
              (estate_id, full_name, email, phone, address, identity_type, identity_number, created_by)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            """,
            (
                estate_id,
                full_name,
                (payload.get("email") or "").strip() or None,
                (payload.get("phone") or "").strip() or None,
                (payload.get("address") or "").strip() or None,
                (payload.get("identityType") or "").strip() or None,
                (payload.get("identityNumber") or "").strip() or None,
                current_user["id"],
            ),
        )
        buyer_id = cursor.lastrowid
        cursor.execute("SELECT * FROM buyers WHERE id = %s", (buyer_id,))
        buyer = cursor.fetchone()

    return success({"buyer": serialize_buyer(buyer)}, "Buyer created", 201)


@sales_bp.get("/estates/<int:estate_id>/sales")
@require_roles("estate_manager", "admin", "super_admin")
def list_sales(current_user, estate_id):
    with db_cursor() as cursor:
        expire_reservations(cursor)
        _, access_error = ensure_estate_access(cursor, current_user, estate_id)
        if access_error:
            return access_error

        cursor.execute("SELECT * FROM sales WHERE estate_id = %s ORDER BY created_at DESC LIMIT 200", (estate_id,))
        sales = [serialize_sale(row) for row in cursor.fetchall()]

    return success({"sales": sales})


@sales_bp.post("/estates/<int:estate_id>/reservations")
@require_roles("estate_manager", "admin", "super_admin")
def create_reservation(current_user, estate_id):
    payload = request.get_json(silent=True) or {}
    property_id = payload.get("propertyId")
    buyer_id = payload.get("buyerId")

    if not property_id or not buyer_id:
        return error("VALIDATION_ERROR", "Property and buyer are required.", 422)

    with db_cursor(commit=True) as cursor:
        expire_reservations(cursor)
        _, access_error = ensure_estate_access(cursor, current_user, estate_id)
        if access_error:
            return access_error

        property_row = ensure_property(cursor, estate_id, property_id)
        if not property_row:
            return error("NOT_FOUND", "Property was not found.", 404)
        if property_row["status"] not in ("available", "under_offer"):
            return error("PROPERTY_UNAVAILABLE", "Only available or under-offer properties can be reserved.", 422)
        if has_active_transaction(cursor, property_id):
            return error("ACTIVE_TRANSACTION_EXISTS", "This property already has an active transaction.", 409)

        cursor.execute("SELECT id FROM buyers WHERE id = %s AND estate_id = %s LIMIT 1", (buyer_id, estate_id))
        if not cursor.fetchone():
            return error("NOT_FOUND", "Buyer was not found.", 404)

        cursor.execute(
            """
            INSERT INTO reservations
              (estate_id, property_id, buyer_id, reserved_until, note, created_by)
            VALUES (%s, %s, %s, COALESCE(%s, DATE_ADD(CURRENT_DATE, INTERVAL 7 DAY)), %s, %s)
            """,
            (
                estate_id,
                property_id,
                buyer_id,
                payload.get("reservedUntil") or None,
                (payload.get("note") or "").strip() or None,
                current_user["id"],
            ),
        )
        reservation_id = cursor.lastrowid
        update_property_status(cursor, property_id, current_user["id"], "reserved", "Reservation created")
        record_audit_log(
            cursor,
            current_user["id"],
            "reservation.created",
            "property",
            property_id,
            {"estateId": estate_id, "buyerId": buyer_id, "reservationId": reservation_id},
        )
        cursor.execute("SELECT * FROM reservations WHERE id = %s", (reservation_id,))
        reservation = cursor.fetchone()

    return success({"reservation": serialize_reservation(reservation)}, "Reservation created", 201)


@sales_bp.post("/estates/<int:estate_id>/sales")
@require_roles("estate_manager", "admin", "super_admin")
def create_sale(current_user, estate_id):
    payload = request.get_json(silent=True) or {}
    property_id = payload.get("propertyId")
    buyer_id = payload.get("buyerId")
    reservation_id = payload.get("reservationId")

    if not property_id or not buyer_id:
        return error("VALIDATION_ERROR", "Property and buyer are required.", 422)

    with db_cursor(commit=True) as cursor:
        expire_reservations(cursor)
        _, access_error = ensure_estate_access(cursor, current_user, estate_id)
        if access_error:
            return access_error

        property_row = ensure_property(cursor, estate_id, property_id)
        if not property_row:
            return error("NOT_FOUND", "Property was not found.", 404)
        if property_row["status"] not in ("reserved", "under_offer", "available"):
            return error("PROPERTY_UNAVAILABLE", "This property cannot be marked sold from its current status.", 422)

        cursor.execute("SELECT id FROM buyers WHERE id = %s AND estate_id = %s LIMIT 1", (buyer_id, estate_id))
        if not cursor.fetchone():
            return error("NOT_FOUND", "Buyer was not found.", 404)

        if reservation_id:
            cursor.execute(
                "UPDATE reservations SET status = 'converted_to_sale' WHERE id = %s AND property_id = %s",
                (reservation_id, property_id),
            )

        cursor.execute(
            """
            INSERT INTO sales
              (estate_id, property_id, buyer_id, reservation_id, sale_price, payment_status, channel, status, note, created_by)
            VALUES (%s, %s, %s, %s, %s, %s, %s, 'active', %s, %s)
            """,
            (
                estate_id,
                property_id,
                buyer_id,
                reservation_id,
                payload.get("salePrice") or property_row["price"] or 0,
                payload.get("paymentStatus") or "pending",
                payload.get("channel") if payload.get("channel") in ("online", "in_office") else "online",
                (payload.get("note") or "").strip() or None,
                current_user["id"],
            ),
        )
        sale_id = cursor.lastrowid
        # A sale record is not proof of payment. Keep the plot reserved until
        # Paystack confirms the transaction; the payment callback moves it to
        # sold atomically.
        if property_row["status"] != "reserved":
            update_property_status(cursor, property_id, current_user["id"], "reserved", "Sale awaiting payment")
        record_audit_log(
            cursor,
            current_user["id"],
            "sale.created",
            "property",
            property_id,
            {"estateId": estate_id, "buyerId": buyer_id, "saleId": sale_id},
        )
        cursor.execute("SELECT * FROM sales WHERE id = %s", (sale_id,))
        sale = cursor.fetchone()

    return success({"sale": serialize_sale(sale)}, "Sale recorded", 201)


@sales_bp.post("/estates/<int:estate_id>/allocations")
@require_roles("estate_manager", "admin", "super_admin")
def create_allocation(current_user, estate_id):
    payload = request.get_json(silent=True) or {}
    property_id = payload.get("propertyId")
    buyer_id = payload.get("buyerId")
    allocation_reference = (payload.get("allocationReference") or "").strip()

    if not property_id or not buyer_id or not allocation_reference:
        return error("VALIDATION_ERROR", "Property, buyer, and allocation reference are required.", 422)

    with db_cursor(commit=True) as cursor:
        _, access_error = ensure_estate_access(cursor, current_user, estate_id)
        if access_error:
            return access_error

        property_row = ensure_property(cursor, estate_id, property_id)
        if not property_row:
            return error("NOT_FOUND", "Property was not found.", 404)
        if property_row["status"] != "sold":
            return error("PROPERTY_NOT_SOLD", "Only sold properties can be allocated.", 422)

        sale_id = payload.get("saleId")
        if sale_id:
            cursor.execute(
                "SELECT payment_status FROM sales WHERE id = %s AND property_id = %s LIMIT 1",
                (sale_id, property_id),
            )
            sale_row = cursor.fetchone()
            if not sale_row or sale_row["payment_status"] != "paid":
                return error("PAYMENT_NOT_CONFIRMED", "Allocation is available after the sale payment is verified.", 422)

        cursor.execute("SELECT id FROM buyers WHERE id = %s AND estate_id = %s LIMIT 1", (buyer_id, estate_id))
        if not cursor.fetchone():
            return error("NOT_FOUND", "Buyer was not found.", 404)

        cursor.execute(
            """
            INSERT INTO allocations
              (estate_id, property_id, buyer_id, sale_id, allocation_reference, allocated_at, note, created_by)
            VALUES (%s, %s, %s, %s, %s, COALESCE(%s, CURRENT_DATE), %s, %s)
            """,
            (
                estate_id,
                property_id,
                buyer_id,
                sale_id or None,
                allocation_reference,
                payload.get("allocatedAt") or None,
                (payload.get("note") or "").strip() or None,
                current_user["id"],
            ),
        )
        allocation_id = cursor.lastrowid
        update_property_status(cursor, property_id, current_user["id"], "allocated", "Allocation recorded")
        record_audit_log(
            cursor,
            current_user["id"],
            "allocation.created",
            "property",
            property_id,
            {"estateId": estate_id, "buyerId": buyer_id, "allocationId": allocation_id},
        )
        cursor.execute("SELECT * FROM allocations WHERE id = %s", (allocation_id,))
        allocation = cursor.fetchone()

    return success({"allocation": serialize_allocation(allocation)}, "Allocation recorded", 201)
