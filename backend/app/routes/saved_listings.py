from flask import Blueprint

from ..db import db_cursor
from ..utils.authz import require_roles
from ..utils.responses import error, success

saved_listings_bp = Blueprint("saved_listings", __name__)


def serialize_saved_listing(row):
    return {
        "id": row["id"],
        "propertyId": row["property_id"],
        "estateId": row.get("estate_id"),
        "propertyIdentifier": row.get("property_identifier"),
        "plotNumber": row.get("plot_number"),
        "propertyType": row.get("property_type"),
        "plotSize": row.get("plot_size"),
        "price": float(row.get("price") or 0),
        "status": row.get("status"),
        "estateName": row.get("estate_name"),
        "estateLocation": row.get("estate_location"),
        "createdAt": row.get("created_at"),
    }


@saved_listings_bp.get("")
@require_roles("buyer", "resident", "public_user", "estate_manager", "admin", "super_admin")
def list_saved_listings(current_user):
    with db_cursor() as cursor:
        cursor.execute(
            """
            SELECT saved_listings.id,
                   saved_listings.property_id,
                   saved_listings.created_at,
                   properties.estate_id,
                   properties.property_identifier,
                   properties.plot_number,
                   properties.property_type,
                   properties.plot_size,
                   properties.price,
                   properties.status,
                   estates.name AS estate_name,
                   estates.location AS estate_location
            FROM saved_listings
            INNER JOIN properties ON properties.id = saved_listings.property_id
            INNER JOIN estates ON estates.id = properties.estate_id
            WHERE saved_listings.user_id = %s
            ORDER BY saved_listings.created_at DESC
            LIMIT 200
            """,
            (current_user["id"],),
        )
        listings = [serialize_saved_listing(row) for row in cursor.fetchall()]

    return success({"listings": listings, "propertyIds": [item["propertyId"] for item in listings]})


@saved_listings_bp.post("/<int:property_id>")
@require_roles("buyer", "resident", "public_user", "estate_manager", "admin", "super_admin")
def save_listing(current_user, property_id):
    with db_cursor(commit=True) as cursor:
        cursor.execute("SELECT id FROM properties WHERE id = %s LIMIT 1", (property_id,))
        if not cursor.fetchone():
            return error("NOT_FOUND", "Property was not found.", 404)

        cursor.execute(
            "INSERT IGNORE INTO saved_listings (user_id, property_id) VALUES (%s, %s)",
            (current_user["id"], property_id),
        )

    return success({"propertyId": property_id, "saved": True}, "Listing saved", 201)


@saved_listings_bp.delete("/<int:property_id>")
@require_roles("buyer", "resident", "public_user", "estate_manager", "admin", "super_admin")
def unsave_listing(current_user, property_id):
    with db_cursor(commit=True) as cursor:
        cursor.execute(
            "DELETE FROM saved_listings WHERE user_id = %s AND property_id = %s",
            (current_user["id"], property_id),
        )

    return success({"propertyId": property_id, "saved": False}, "Listing removed from saved")
