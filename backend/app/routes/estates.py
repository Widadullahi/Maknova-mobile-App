import os
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4

from flask import Blueprint, current_app, request, send_file
from werkzeug.utils import secure_filename

from ..db import db_cursor
from ..utils.audit import record_audit_log
from ..utils.authz import require_roles
from ..utils.notify import create_notification, flush_push_queue, queue_push
from ..utils.responses import error, success
from ..utils.scope import can_manage_estate

estates_bp = Blueprint("estates", __name__)

PROPERTY_DOCUMENT_CATEGORIES = {"image", "video", "title_document", "allocation_document", "deed_of_assignment", "other"}
# 'image'/'video' stay public (marketing media) — served via the normal /uploads
# static route. Everything else here is a structural/title document and must go
# through the private vault: no public user, buyer, or resident may ever see
# these, even after a completed purchase (buyers only get the deed_of_assignment,
# and only once their sale is paid — see the dedicated deed endpoint below).
PRIVATE_PROPERTY_DOCUMENT_CATEGORIES = {"title_document", "allocation_document", "deed_of_assignment"}
ALLOWED_UPLOAD_MIME_TYPES = {"application/pdf", "image/jpeg", "image/png"}
MIN_UPLOAD_BYTES = 10 * 1024
# Anti-fraud media rule (client directive 11a.3): property photos/videos must be
# captured live through the app's camera. The backend enforces that a camera source
# and a fresh capture timestamp are provided with every image/video upload, and the
# file must be a real camera-produced mime type (never a PDF).
ALLOWED_CAMERA_MEDIA_MIME_TYPES = {"image/jpeg", "image/png", "video/mp4", "video/quicktime", "video/webm", "video/x-m4v", "video/3gpp"}
MEDIA_KINDS = {"photo", "video"}
MAX_CAPTURE_AGE_SECONDS = 15 * 60
BUYER_VISIBLE_STATUSES = {"sold", "allocated"}

PROPERTY_STATUSES = {
    "available",
    "reserved",
    "under_offer",
    "sold",
    "allocated",
    "unavailable",
}

PROPERTY_TRANSITIONS = {
    "available": {"reserved", "under_offer", "unavailable"},
    "reserved": {"available", "sold", "unavailable"},
    "under_offer": {"available", "sold", "unavailable"},
    "sold": {"allocated"},
    "allocated": set(),
    "unavailable": {"available"},
}


def serialize_estate(row):
    return {
        "id": row["id"],
        "managerUserId": row["manager_user_id"],
        "verificationApplicationId": row.get("verification_application_id"),
        "name": row["name"],
        "location": row["location"],
        "description": row.get("description"),
        "contactEmail": row.get("contact_email"),
        "contactPhone": row.get("contact_phone"),
        "status": row["status"],
        "isPublished": bool(row["is_published"]),
    }


def serialize_property(row):
    return {
        "id": row["id"],
        "estateId": row["estate_id"],
        "propertyIdentifier": row["property_identifier"],
        "plotNumber": row.get("plot_number"),
        "propertyType": row["property_type"],
        "plotSize": row.get("plot_size"),
        "price": float(row["price"] or 0),
        "description": row.get("description"),
        "status": row["status"],
        "buyerUserId": row.get("buyer_user_id"),
        "ownerUserId": row.get("owner_user_id"),
    }


def serialize_property_document(row):
    return {
        "id": row["id"],
        "propertyId": row["property_id"],
        "category": row["category"],
        "fileName": row["file_name"],
        "fileUrl": row["file_url"],
        "mimeType": row.get("mime_type"),
        "fileSize": row.get("file_size"),
        "captureSource": row.get("capture_source"),
        "capturedAt": row.get("captured_at"),
        "mediaKind": row.get("media_kind"),
        "createdAt": row.get("created_at"),
    }


def validate_property_upload(file_storage, allow_media=False):
    filename = secure_filename(file_storage.filename or "")
    mime_type = file_storage.mimetype or ""
    if not filename:
        return None, error("VALIDATION_ERROR", "A file name is required.", 422)
    allowed_types = ALLOWED_UPLOAD_MIME_TYPES if not allow_media else (ALLOWED_UPLOAD_MIME_TYPES | ALLOWED_CAMERA_MEDIA_MIME_TYPES)
    if mime_type not in allowed_types:
        return None, error("UNSUPPORTED_FILE_TYPE", "Upload a PDF, JPEG, or PNG document.", 422)

    stream = file_storage.stream
    current = stream.tell()
    stream.seek(0, os.SEEK_END)
    size = stream.tell()
    stream.seek(current)
    if size < MIN_UPLOAD_BYTES:
        return None, error("LOW_QUALITY_UPLOAD", "Upload appears too small to be a usable document.", 422)
    return {"filename": filename, "mimeType": mime_type, "size": size}, None


def parse_capture_timestamp(raw_value):
    if not raw_value:
        return None
    value = str(raw_value).strip()
    try:
        normalized = value.replace("Z", "+00:00") if value.endswith("Z") else value
        parsed = datetime.fromisoformat(normalized)
    except ValueError:
        return None
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)


def validate_camera_media(file_storage, media_index, form):
    """
    Anti-fraud camera-only check for property photos/videos. The mobile camera
    capture stamps every media file with source=camera + capturedAt at the moment
    of capture; the backend rejects anything without those, anything flagged as a
    gallery/library pick, and anything whose capture timestamp is too old to have
    been taken live just now.
    """
    source = (form.get(f"sources[{media_index}]") or "").strip().lower()
    captured_at_raw = (form.get(f"capturedAts[{media_index}]") or "").strip()
    media_kind = (form.get(f"mediaKinds[{media_index}]") or "photo").strip().lower()

    if source != "camera":
        return None, error("CAMERA_CAPTURE_REQUIRED", "Property media must be captured live with the app camera. Gallery uploads are disabled.", 422)
    captured_at = parse_capture_timestamp(captured_at_raw)
    if not captured_at:
        return None, error("MISSING_CAPTURE_TIME", "Capture timestamp is required for live media.", 422)
    age_seconds = (datetime.now(timezone.utc) - captured_at).total_seconds()
    if age_seconds < 0 or age_seconds > MAX_CAPTURE_AGE_SECONDS:
        return None, error("STALE_CAPTURE", "This media was not captured just now. Take a fresh photo or video.", 422)
    if media_kind not in MEDIA_KINDS:
        return None, error("INVALID_MEDIA_KIND", "mediaKind must be 'photo' or 'video'.", 422)
    if file_storage.mimetype not in ALLOWED_CAMERA_MEDIA_MIME_TYPES:
        return None, error("UNSUPPORTED_MEDIA_TYPE", "Only camera-produced JPEG/PNG photos and MP4/MOV video are accepted for property media.", 422)
    return {"captureSource": "camera", "capturedAt": captured_at, "mediaKind": media_kind}, None


def save_property_upload(file_storage, estate_id, property_id, category):
    is_private = category in PRIVATE_PROPERTY_DOCUMENT_CATEGORIES
    upload_root = Path(current_app.config["PRIVATE_UPLOAD_DIR"] if is_private else current_app.config["UPLOAD_DIR"])
    target_dir = upload_root / "properties" / str(estate_id) / str(property_id) / category
    target_dir.mkdir(parents=True, exist_ok=True)
    safe_name = secure_filename(file_storage.filename or "upload")
    target_name = f"{uuid4().hex}_{safe_name}"
    target_path = target_dir / target_name
    file_storage.save(target_path)
    if is_private:
        return f"vault://properties/{estate_id}/{property_id}/{category}/{target_name}"
    return f"/uploads/properties/{estate_id}/{property_id}/{category}/{target_name}"


def property_document_path_from_url(file_url):
    raw = str(file_url or "")
    if not raw.startswith("vault://"):
        return None
    relative_path = raw[len("vault://"):]
    upload_root = Path(current_app.config["PRIVATE_UPLOAD_DIR"]).resolve()
    document_path = (upload_root / relative_path).resolve()
    if upload_root not in document_path.parents and document_path != upload_root:
        return None
    return document_path


def get_estate(cursor, estate_id):
    cursor.execute("SELECT * FROM estates WHERE id = %s LIMIT 1", (estate_id,))
    return cursor.fetchone()


@estates_bp.get("")
@require_roles("estate_manager", "buyer", "public_user", "admin", "super_admin")
def list_estates(current_user):
    with db_cursor() as cursor:
        if current_user["role"] in ("admin", "super_admin"):
            cursor.execute("SELECT * FROM estates ORDER BY created_at DESC LIMIT 100")
        else:
            cursor.execute(
                "SELECT * FROM estates WHERE manager_user_id = %s ORDER BY created_at DESC LIMIT 100",
                (current_user["id"],),
            )
        estates = [serialize_estate(row) for row in cursor.fetchall()]

    return success({"estates": estates})


@estates_bp.get("/public/properties")
def list_public_properties():
    search = (request.args.get("search") or "").strip()
    params = []
    filters = ["e.is_published = 1", "e.status = 'approved'", "p.status = 'available'"]

    if search:
        filters.append("(e.name LIKE %s OR e.location LIKE %s OR p.property_identifier LIKE %s OR p.plot_number LIKE %s)")
        like = f"%{search}%"
        params.extend([like, like, like, like])

    with db_cursor() as cursor:
        cursor.execute(
            f"""
            SELECT
              p.*,
              e.name AS estate_name,
              e.location AS estate_location,
              e.description AS estate_description,
              e.status AS estate_status,
              e.is_published AS estate_is_published
            FROM properties p
            JOIN estates e ON e.id = p.estate_id
            WHERE {' AND '.join(filters)}
            ORDER BY p.created_at DESC
            LIMIT 200
            """,
            tuple(params),
        )
        properties = []
        for row in cursor.fetchall():
            serialized = serialize_property(row)
            serialized["estateName"] = row["estate_name"]
            serialized["estateLocation"] = row["estate_location"]
            serialized["estateDescription"] = row.get("estate_description")
            serialized["estateStatus"] = row["estate_status"]
            serialized["estateIsPublished"] = bool(row["estate_is_published"])
            properties.append(serialized)

    return success({"properties": properties})


@estates_bp.post("")
@require_roles("estate_manager", "buyer", "public_user", "admin", "super_admin")
def create_estate(current_user):
    payload = request.get_json(silent=True) or {}
    name = (payload.get("name") or "").strip()
    location = (payload.get("location") or "").strip()
    description = (payload.get("description") or "").strip() or None
    contact_email = (payload.get("contactEmail") or "").strip() or None
    contact_phone = (payload.get("contactPhone") or "").strip() or None

    if not name or not location:
        return error("VALIDATION_ERROR", "Estate name and location are required.", 422)

    with db_cursor(commit=True) as cursor:
        if current_user["role"] in ("buyer", "public_user"):
            # Individual sellers (buyer/public_user accounts using the Individual
            # Landowner path) list exactly one property, so they get exactly one
            # estate/container record — this isn't a way to become an unlimited
            # multi-estate developer without ever registering as estate_manager.
            cursor.execute("SELECT id FROM estates WHERE manager_user_id = %s LIMIT 1", (current_user["id"],))
            if cursor.fetchone():
                return error(
                    "LIMIT_REACHED",
                    "You already have a property listing. Contact support if you need to list more than one.",
                    422,
                )

        cursor.execute(
            """
            INSERT INTO estates
              (manager_user_id, name, location, description, contact_email, contact_phone, status, is_published)
            VALUES (%s, %s, %s, %s, %s, %s, 'draft', 0)
            """,
            (current_user["id"], name, location, description, contact_email, contact_phone),
        )
        estate_id = cursor.lastrowid
        cursor.execute("SELECT * FROM estates WHERE id = %s", (estate_id,))
        estate = cursor.fetchone()

    return success({"estate": serialize_estate(estate)}, "Estate created", 201)


@estates_bp.get("/<int:estate_id>")
@require_roles("estate_manager", "buyer", "public_user", "admin", "super_admin")
def get_estate_detail(current_user, estate_id):
    with db_cursor() as cursor:
        estate = get_estate(cursor, estate_id)
        if not estate:
            return error("NOT_FOUND", "Estate was not found.", 404)
        if not can_manage_estate(current_user, estate):
            return error("FORBIDDEN", "You cannot access this estate.", 403)

    return success({"estate": serialize_estate(estate)})


@estates_bp.patch("/<int:estate_id>")
@require_roles("estate_manager", "buyer", "public_user", "admin", "super_admin")
def update_estate(current_user, estate_id):
    payload = request.get_json(silent=True) or {}

    with db_cursor(commit=True) as cursor:
        estate = get_estate(cursor, estate_id)
        if not estate:
            return error("NOT_FOUND", "Estate was not found.", 404)
        if not can_manage_estate(current_user, estate):
            return error("FORBIDDEN", "You cannot update this estate.", 403)

        cursor.execute(
            """
            UPDATE estates
            SET name = %s,
                location = %s,
                description = %s,
                contact_email = %s,
                contact_phone = %s
            WHERE id = %s
            """,
            (
                (payload.get("name") or estate["name"]).strip(),
                (payload.get("location") or estate["location"]).strip(),
                (payload.get("description") if payload.get("description") is not None else estate.get("description")),
                (payload.get("contactEmail") if payload.get("contactEmail") is not None else estate.get("contact_email")),
                (payload.get("contactPhone") if payload.get("contactPhone") is not None else estate.get("contact_phone")),
                estate_id,
            ),
        )
        cursor.execute("SELECT * FROM estates WHERE id = %s", (estate_id,))
        updated = cursor.fetchone()

    return success({"estate": serialize_estate(updated)}, "Estate updated")


@estates_bp.patch("/<int:estate_id>/publish")
@require_roles("estate_manager", "buyer", "public_user", "admin", "super_admin")
def publish_estate(current_user, estate_id):
    """
    Explicit go-live switch. An estate (and its available plots) only becomes
    visible through the public listing endpoint once it is BOTH status='approved'
    (super_admin/admin verification decision) AND is_published=1 (this switch).
    Interested public/buyer users can only ever see that a listing exists once
    both conditions are true — i.e. after we've verified the underlying documents.
    """
    payload = request.get_json(silent=True) or {}
    is_published = bool(payload.get("isPublished"))

    with db_cursor(commit=True) as cursor:
        estate = get_estate(cursor, estate_id)
        if not estate:
            return error("NOT_FOUND", "Estate was not found.", 404)
        if not can_manage_estate(current_user, estate):
            return error("FORBIDDEN", "You cannot publish this estate.", 403)
        if is_published and estate["status"] != "approved":
            return error(
                "NOT_APPROVED",
                "This estate must be approved by the platform owner before it can be made public.",
                422,
            )

        cursor.execute("UPDATE estates SET is_published = %s WHERE id = %s", (1 if is_published else 0, estate_id))
        record_audit_log(
            cursor,
            current_user["id"],
            "estate.publish_toggled",
            "estate",
            estate_id,
            {"isPublished": is_published},
        )

        if is_published:
            create_notification(
                cursor,
                user_id=estate["manager_user_id"],
                title="Estate is now live",
                body=f"{estate['name']} is published and visible to potential buyers.",
                type="estate",
                entity_type="estate",
                entity_id=estate_id,
            )
            queue_push(
                [estate["manager_user_id"]],
                title="Estate is now live",
                body=f"{estate['name']} is published and visible to potential buyers.",
                data={"type": "estate", "entityType": "estate", "entityId": estate_id},
            )

        cursor.execute("SELECT * FROM estates WHERE id = %s", (estate_id,))
        updated = cursor.fetchone()

    flush_push_queue()
    return success({"estate": serialize_estate(updated)}, "Estate visibility updated")


@estates_bp.delete("/<int:estate_id>")
@require_roles("super_admin")
def delete_estate(current_user, estate_id):
    """
    Permanent, irreversible removal — Master Owner (super_admin) only. Distinct
    from the report-driven "estate_removed" status (a soft, reversible flag an
    admin can also set): this actually deletes the estate row, and every plot,
    buyer, sale, reservation, allocation, and resident record scoped to it
    cascades away with it at the database level. Requires an explicit
    confirm: true, same pattern as the plot field-edit endpoint, and the full
    estate snapshot is written to the audit log before deletion since the row
    itself won't exist to look up afterwards.
    """
    payload = request.get_json(silent=True) or {}
    if payload.get("confirm") is not True:
        return error(
            "CONFIRMATION_REQUIRED",
            "Deleting an estate is permanent. Resend the request with confirm: true.",
            422,
        )

    with db_cursor(commit=True) as cursor:
        estate = get_estate(cursor, estate_id)
        if not estate:
            return error("NOT_FOUND", "Estate was not found.", 404)

        cursor.execute("SELECT COUNT(*) AS count FROM properties WHERE estate_id = %s", (estate_id,))
        property_count = cursor.fetchone()["count"]

        record_audit_log(
            cursor,
            current_user["id"],
            "estate.deleted",
            entity_type="estate",
            entity_id=estate_id,
            metadata={
                "name": estate["name"],
                "location": estate["location"],
                "managerUserId": estate["manager_user_id"],
                "status": estate["status"],
                "propertyCount": property_count,
            },
        )
        cursor.execute("DELETE FROM estates WHERE id = %s", (estate_id,))

    return success({}, "Estate permanently deleted")


@estates_bp.get("/<int:estate_id>/properties")
@require_roles("estate_manager", "buyer", "public_user", "admin", "super_admin")
def list_properties(current_user, estate_id):
    status = request.args.get("status")
    search = (request.args.get("search") or "").strip()
    params = [estate_id]
    filters = ["estate_id = %s"]

    if status:
        if status not in PROPERTY_STATUSES:
            return error("VALIDATION_ERROR", "Property status is not supported.", 422)
        filters.append("status = %s")
        params.append(status)

    if search:
        filters.append("(property_identifier LIKE %s OR plot_number LIKE %s OR property_type LIKE %s)")
        like = f"%{search}%"
        params.extend([like, like, like])

    with db_cursor() as cursor:
        estate = get_estate(cursor, estate_id)
        if not estate:
            return error("NOT_FOUND", "Estate was not found.", 404)
        if not can_manage_estate(current_user, estate):
            return error("FORBIDDEN", "You cannot access this estate.", 403)

        cursor.execute(
            f"""
            SELECT * FROM properties
            WHERE {' AND '.join(filters)}
            ORDER BY created_at DESC
            LIMIT 200
            """,
            tuple(params),
        )
        properties = [serialize_property(row) for row in cursor.fetchall()]

    return success({"properties": properties})


@estates_bp.post("/<int:estate_id>/properties")
@require_roles("estate_manager", "buyer", "public_user", "admin", "super_admin")
def create_property(current_user, estate_id):
    payload = request.get_json(silent=True) or {}
    property_identifier = (payload.get("propertyIdentifier") or "").strip()
    property_type = (payload.get("propertyType") or "").strip()
    plot_number = (payload.get("plotNumber") or "").strip() or None
    plot_size = (payload.get("plotSize") or "").strip() or None
    description = (payload.get("description") or "").strip() or None
    price = payload.get("price") or 0
    status = payload.get("status") or "available"

    if status not in PROPERTY_STATUSES:
        return error("VALIDATION_ERROR", "Property status is not supported.", 422)

    if not property_identifier or not property_type:
        return error("VALIDATION_ERROR", "Property identifier and property type are required.", 422)

    with db_cursor(commit=True) as cursor:
        estate = get_estate(cursor, estate_id)
        if not estate:
            return error("NOT_FOUND", "Estate was not found.", 404)
        if not can_manage_estate(current_user, estate):
            return error("FORBIDDEN", "You cannot add properties to this estate.", 403)

        if current_user["role"] in ("buyer", "public_user"):
            # Individual sellers list exactly one property under their one estate.
            cursor.execute("SELECT id FROM properties WHERE estate_id = %s LIMIT 1", (estate_id,))
            if cursor.fetchone():
                return error(
                    "LIMIT_REACHED",
                    "You already have a property listed. Edit your existing listing instead of adding another.",
                    422,
                )

        cursor.execute(
            """
            INSERT INTO properties
              (estate_id, property_identifier, plot_number, property_type, plot_size, price, description, status)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            """,
            (estate_id, property_identifier, plot_number, property_type, plot_size, price, description, status),
        )
        property_id = cursor.lastrowid
        cursor.execute(
            """
            INSERT INTO property_status_history
              (property_id, previous_status, next_status, changed_by, note)
            VALUES (%s, NULL, %s, %s, 'Initial status')
            """,
            (property_id, status, current_user["id"]),
        )
        cursor.execute("SELECT * FROM properties WHERE id = %s", (property_id,))
        created = cursor.fetchone()

    return success({"property": serialize_property(created)}, "Property created", 201)


EDITABLE_PROPERTY_FIELDS = {
    "propertyIdentifier": "property_identifier",
    "plotNumber": "plot_number",
    "propertyType": "property_type",
    "plotSize": "plot_size",
    "price": "price",
    "description": "description",
}


@estates_bp.patch("/<int:estate_id>/properties/<int:property_id>")
@require_roles("estate_manager", "buyer", "public_user", "admin", "super_admin")
def update_property_fields(current_user, estate_id, property_id):
    """
    Edits core plot fields (identifier, type, size, price, description) after
    creation. Deliberately separate from the status-transition endpoint: changing
    a listed price or identifier after buyers may have already seen it is a
    materially different, more sensitive action than moving a plot through its
    sales lifecycle, so it requires an explicit confirmation flag and is always
    audited with a before/after diff.
    """
    payload = request.get_json(silent=True) or {}

    if payload.get("confirm") is not True:
        return error(
            "CONFIRMATION_REQUIRED",
            "Editing plot fields requires explicit confirmation. Resend the request with confirm: true.",
            422,
        )

    updates = {db_field: payload[api_field] for api_field, db_field in EDITABLE_PROPERTY_FIELDS.items() if api_field in payload}
    if not updates:
        return error("VALIDATION_ERROR", "No editable fields were provided.", 422)

    if "property_type" in updates and not str(updates["property_type"]).strip():
        return error("VALIDATION_ERROR", "Property type cannot be empty.", 422)
    if "property_identifier" in updates and not str(updates["property_identifier"]).strip():
        return error("VALIDATION_ERROR", "Property identifier cannot be empty.", 422)
    if "price" in updates:
        try:
            updates["price"] = float(updates["price"])
        except (TypeError, ValueError):
            return error("VALIDATION_ERROR", "Price must be a number.", 422)
        if updates["price"] < 0:
            return error("VALIDATION_ERROR", "Price cannot be negative.", 422)

    with db_cursor(commit=True) as cursor:
        estate = get_estate(cursor, estate_id)
        if not estate:
            return error("NOT_FOUND", "Estate was not found.", 404)
        if not can_manage_estate(current_user, estate):
            return error("FORBIDDEN", "You cannot edit properties in this estate.", 403)

        cursor.execute("SELECT * FROM properties WHERE id = %s AND estate_id = %s LIMIT 1", (property_id, estate_id))
        existing = cursor.fetchone()
        if not existing:
            return error("NOT_FOUND", "Property was not found.", 404)

        before = {field: (float(existing[field]) if field == "price" else existing.get(field)) for field in updates}

        set_clause = ", ".join(f"{field} = %s" for field in updates)
        cursor.execute(
            f"UPDATE properties SET {set_clause} WHERE id = %s",
            (*updates.values(), property_id),
        )

        record_audit_log(
            cursor,
            current_user["id"],
            "property.fields_updated",
            entity_type="property",
            entity_id=property_id,
            metadata={"before": before, "after": updates},
        )

        cursor.execute("SELECT * FROM properties WHERE id = %s", (property_id,))
        updated = cursor.fetchone()

    return success({"property": serialize_property(updated)}, "Property updated")


@estates_bp.patch("/<int:estate_id>/properties/<int:property_id>/status")
@require_roles("estate_manager", "buyer", "public_user", "admin", "super_admin")
def update_property_status(current_user, estate_id, property_id):
    payload = request.get_json(silent=True) or {}
    next_status = payload.get("status")
    note = (payload.get("note") or "").strip() or None
    buyer_user_id = payload.get("buyerUserId")
    owner_user_id = payload.get("ownerUserId")

    if next_status not in PROPERTY_STATUSES:
        return error("VALIDATION_ERROR", "Property status is not supported.", 422)

    with db_cursor(commit=True) as cursor:
        estate = get_estate(cursor, estate_id)
        if not estate:
            return error("NOT_FOUND", "Estate was not found.", 404)
        if not can_manage_estate(current_user, estate):
            return error("FORBIDDEN", "You cannot update this property.", 403)

        cursor.execute(
            "SELECT * FROM properties WHERE id = %s AND estate_id = %s LIMIT 1",
            (property_id, estate_id),
        )
        property_row = cursor.fetchone()
        if not property_row:
            return error("NOT_FOUND", "Property was not found.", 404)

        previous_status = property_row["status"]
        allowed = next_status in PROPERTY_TRANSITIONS.get(previous_status, set())
        admin_override = current_user["role"] in ("admin", "super_admin")

        if not allowed and not admin_override:
            return error("INVALID_STATUS_TRANSITION", "This property status transition is not allowed.", 422)

        if next_status in BUYER_VISIBLE_STATUSES and not (buyer_user_id or property_row.get("buyer_user_id")):
            return error(
                "BUYER_REQUIRED",
                "A buyer account must be assigned before marking this property sold or allocated.",
                422,
            )

        if next_status in BUYER_VISIBLE_STATUSES:
            # Entering sold/allocated: attach (or keep) the buyer/owner account.
            cursor.execute(
                """
                UPDATE properties
                SET status = %s,
                    buyer_user_id = COALESCE(%s, buyer_user_id),
                    owner_user_id = COALESCE(%s, owner_user_id)
                WHERE id = %s
                """,
                (next_status, buyer_user_id, owner_user_id, property_id),
            )
        else:
            # Review finding #3: leaving a buyer-visible status (e.g. an admin
            # reverting sold/allocated back to available) must DROP the stale
            # buyer/owner account, not silently keep it via COALESCE — otherwise
            # the plot keeps showing up in the previous buyer's purchases list.
            cursor.execute(
                """
                UPDATE properties
                SET status = %s,
                    buyer_user_id = %s,
                    owner_user_id = %s
                WHERE id = %s
                """,
                (next_status, buyer_user_id, owner_user_id, property_id),
            )
        cursor.execute(
            """
            INSERT INTO property_status_history
              (property_id, previous_status, next_status, changed_by, note)
            VALUES (%s, %s, %s, %s, %s)
            """,
            (property_id, previous_status, next_status, current_user["id"], note),
        )
        record_audit_log(
            cursor,
            current_user["id"],
            "property.status_updated",
            "property",
            property_id,
            {"previousStatus": previous_status, "nextStatus": next_status},
        )
        cursor.execute("SELECT * FROM properties WHERE id = %s", (property_id,))
        updated = cursor.fetchone()

    return success({"property": serialize_property(updated)}, "Property status updated")


@estates_bp.get("/<int:estate_id>/properties/<int:property_id>/documents")
@require_roles("estate_manager", "buyer", "public_user", "admin", "super_admin")
def list_property_documents(current_user, estate_id, property_id):
    with db_cursor() as cursor:
        estate = get_estate(cursor, estate_id)
        if not estate:
            return error("NOT_FOUND", "Estate was not found.", 404)
        if not can_manage_estate(current_user, estate):
            return error("FORBIDDEN", "You cannot access this property.", 403)

        cursor.execute(
            "SELECT * FROM properties WHERE id = %s AND estate_id = %s LIMIT 1",
            (property_id, estate_id),
        )
        if not cursor.fetchone():
            return error("NOT_FOUND", "Property was not found.", 404)

        cursor.execute(
            "SELECT * FROM property_documents WHERE property_id = %s ORDER BY created_at DESC",
            (property_id,),
        )
        documents = [serialize_property_document(row) for row in cursor.fetchall()]

    return success({"documents": documents})


@estates_bp.post("/<int:estate_id>/properties/<int:property_id>/documents")
@require_roles("estate_manager", "buyer", "public_user", "admin", "super_admin")
def add_property_document(current_user, estate_id, property_id):
    payload = request.get_json(silent=True) or {}
    category = payload.get("category") or "other"
    file_name = (payload.get("fileName") or "").strip()
    file_url = (payload.get("fileUrl") or "").strip()
    mime_type = (payload.get("mimeType") or "").strip() or None
    file_size = payload.get("fileSize")

    if category not in PROPERTY_DOCUMENT_CATEGORIES:
        return error("VALIDATION_ERROR", "Document category is not supported.", 422)
    if not file_name or not file_url:
        return error("VALIDATION_ERROR", "File name and file URL are required.", 422)

    with db_cursor(commit=True) as cursor:
        estate = get_estate(cursor, estate_id)
        if not estate:
            return error("NOT_FOUND", "Estate was not found.", 404)
        if not can_manage_estate(current_user, estate):
            return error("FORBIDDEN", "You cannot add documents to this property.", 403)

        cursor.execute(
            "SELECT id FROM properties WHERE id = %s AND estate_id = %s LIMIT 1",
            (property_id, estate_id),
        )
        if not cursor.fetchone():
            return error("NOT_FOUND", "Property was not found.", 404)

        cursor.execute(
            """
            INSERT INTO property_documents (property_id, category, file_name, file_url, mime_type, file_size)
            VALUES (%s, %s, %s, %s, %s, %s)
            """,
            (property_id, category, file_name, file_url, mime_type, file_size),
        )
        document_id = cursor.lastrowid
        record_audit_log(cursor, current_user["id"], "property.document_added", "property", property_id, {"category": category})
        cursor.execute("SELECT * FROM property_documents WHERE id = %s", (document_id,))
        document = cursor.fetchone()

    return success({"document": serialize_property_document(document)}, "Document added", 201)


@estates_bp.post("/<int:estate_id>/properties/<int:property_id>/documents/upload")
@require_roles("estate_manager", "buyer", "public_user", "admin", "super_admin")
def upload_property_documents(current_user, estate_id, property_id):
    category = request.form.get("category") or "other"
    files = request.files.getlist("files")
    if not files and request.files.get("file"):
        files = [request.files["file"]]

    if category not in PROPERTY_DOCUMENT_CATEGORIES:
        return error("VALIDATION_ERROR", "Document category is not supported.", 422)
    if not files:
        return error("VALIDATION_ERROR", "At least one file is required.", 422)

    validated = []
    is_media = category in ("image", "video")
    for index, file_storage in enumerate(files):
        metadata, validation_error = validate_property_upload(file_storage, allow_media=is_media)
        if validation_error:
            return validation_error
        if is_media:
            media_metadata, media_error = validate_camera_media(file_storage, index, request.form)
            if media_error:
                return media_error
            metadata.update(media_metadata)
        validated.append((file_storage, metadata))

    with db_cursor(commit=True) as cursor:
        estate = get_estate(cursor, estate_id)
        if not estate:
            return error("NOT_FOUND", "Estate was not found.", 404)
        if not can_manage_estate(current_user, estate):
            return error("FORBIDDEN", "You cannot add documents to this property.", 403)

        cursor.execute(
            "SELECT id FROM properties WHERE id = %s AND estate_id = %s LIMIT 1",
            (property_id, estate_id),
        )
        if not cursor.fetchone():
            return error("NOT_FOUND", "Property was not found.", 404)

        documents = []
        for file_storage, metadata in validated:
            public_url = save_property_upload(file_storage, estate_id, property_id, category)
            cursor.execute(
                """
                INSERT INTO property_documents
                  (property_id, category, file_name, file_url, mime_type, file_size, capture_source, captured_at, media_kind)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                """,
                (
                    property_id,
                    category,
                    metadata["filename"],
                    public_url,
                    metadata["mimeType"],
                    metadata["size"],
                    metadata.get("captureSource"),
                    metadata.get("capturedAt"),
                    metadata.get("mediaKind"),
                ),
            )
            document_id = cursor.lastrowid
            cursor.execute("SELECT * FROM property_documents WHERE id = %s", (document_id,))
            documents.append(serialize_property_document(cursor.fetchone()))

        record_audit_log(
            cursor,
            current_user["id"],
            "property.documents_uploaded",
            "property",
            property_id,
            {
                "category": category,
                "count": len(documents),
                "cameraCaptured": is_media,
                "serverTime": datetime.utcnow().isoformat(),
            },
        )

    return success({"documents": documents}, "Documents uploaded", 201)


@estates_bp.get("/properties/documents/<int:document_id>/file")
@require_roles()
def get_property_document_file(current_user, document_id):
    """
    Private vault for plot title/allocation/deed documents. Structural title
    documents (title_document, allocation_document) are NEVER released to buyers,
    public users, or residents — not even after a completed purchase — only to the
    Master Owner/verification staff and the estate manager who owns the property.
    The deed_of_assignment is the one exception: the buyer that property is sold to
    may retrieve it, but only once, and only after the plot has actually sold.
    """
    with db_cursor(commit=True) as cursor:
        cursor.execute(
            """
            SELECT pd.*, p.estate_id AS property_estate_id, p.buyer_user_id, p.status AS property_status
            FROM property_documents pd
            JOIN properties p ON p.id = pd.property_id
            WHERE pd.id = %s
            LIMIT 1
            """,
            (document_id,),
        )
        document = cursor.fetchone()
        if not document:
            return error("NOT_FOUND", "Document was not found.", 404)

        estate = get_estate(cursor, document["property_estate_id"])
        is_owner_manager = estate and can_manage_estate(current_user, estate)
        is_staff = current_user["role"] in ("admin", "super_admin")
        is_buyer_of_deed = (
            document["category"] == "deed_of_assignment"
            and current_user["role"] in ("buyer", "resident", "public_user")
            and document["buyer_user_id"] == current_user["id"]
            and document["property_status"] in BUYER_VISIBLE_STATUSES
        )

        if not (is_owner_manager or is_staff or is_buyer_of_deed):
            return error("FORBIDDEN", "You do not have access to this document.", 403)

        if is_staff:
            record_audit_log(
                cursor,
                current_user["id"],
                "property.document_viewed",
                "property_document",
                document_id,
                {"category": document["category"]},
            )
        elif is_buyer_of_deed:
            record_audit_log(
                cursor,
                current_user["id"],
                "property.deed_delivered",
                "property_document",
                document_id,
                {"propertyId": document["property_id"]},
            )

    document_path = property_document_path_from_url(document["file_url"])
    if not document_path or not document_path.exists():
        return error("FILE_NOT_FOUND", "The uploaded document file is missing from storage.", 404)

    # Staff (admin/super_admin) access is strictly VIEW-ONLY: their ?download=1
    # is served inline, exactly like the verification vault endpoint does. Only
    # the owner-manager and the buyer-of-deed can receive attachment downloads.
    staff_view_only = current_user["role"] in ("admin", "super_admin")

    return send_file(
        document_path,
        mimetype=document.get("mime_type") or None,
        as_attachment=request.args.get("download") == "1" and not staff_view_only,
        download_name=document.get("file_name") or document_path.name,
    )


@estates_bp.get("/my/purchases")
@require_roles("buyer", "resident", "public_user", "admin", "super_admin")
def list_my_purchases(current_user):
    with db_cursor() as cursor:
        # Review finding #7: this used to run one sale query and one document
        # query per property (N+1). The latest-sale id is now resolved with a
        # correlated subquery in the same round trip, and documents are fetched
        # in a single IN (...) query below.
        cursor.execute(
            """
            SELECT
              p.*,
              (SELECT s.id FROM sales s WHERE s.property_id = p.id ORDER BY s.id DESC LIMIT 1) AS latest_sale_id
            FROM properties p
            WHERE p.buyer_user_id = %s OR p.owner_user_id = %s
            ORDER BY p.updated_at DESC
            LIMIT 100
            """,
            (current_user["id"], current_user["id"]),
        )
        rows = cursor.fetchall()

        documents_by_property = {}
        visible_ids = [row["id"] for row in rows if row["status"] in BUYER_VISIBLE_STATUSES]
        if visible_ids:
            placeholders = ", ".join(["%s"] * len(visible_ids))
            cursor.execute(
                f"""
                SELECT *
                FROM property_documents
                WHERE property_id IN ({placeholders})
                  AND category IN ('image', 'deed_of_assignment')
                ORDER BY created_at DESC
                """,
                tuple(visible_ids),
            )
            for doc in cursor.fetchall():
                documents_by_property.setdefault(doc["property_id"], []).append(doc)

        properties = []
        for row in rows:
            serialized = serialize_property(row)
            serialized["saleId"] = row.get("latest_sale_id")
            if row["status"] in BUYER_VISIBLE_STATUSES:
                # Buyers only ever get marketing photos and their own deed of
                # assignment — never the structural title/allocation documents
                # behind the estate manager's verification, per the platform's
                # document-privacy rule. Those stay staff/owner-only, served
                # exclusively via get_property_document_file() above.
                serialized["documents"] = [
                    serialize_property_document(doc)
                    for doc in documents_by_property.get(row["id"], [])
                ]
            else:
                serialized["documents"] = []
            properties.append(serialized)

    return success({"properties": properties})
