import json
import os
from pathlib import Path
from uuid import uuid4

from flask import Blueprint, current_app, request, send_file
from werkzeug.utils import secure_filename

from ..db import db_cursor
from ..utils.audit import record_audit_log
from ..utils.authz import get_current_user, require_roles
from ..utils.notify import create_notification, flush_push_queue, queue_push
from ..utils.responses import error, success

verification_bp = Blueprint("verification", __name__)


def _has_real_signature(application):
    """A typed signature is non-empty text; a drawn signature is a non-empty
    JSON stroke payload. An empty drawn pad serializes to "[]" — that is NOT a
    signature and must not pass submission validation (review finding #6)."""
    if (application.get("signature_text") or "").strip():
        return True

    raw = application.get("signature_data")
    if not raw:
        return False

    parsed = raw
    if isinstance(raw, str):
        try:
            parsed = json.loads(raw)
        except (ValueError, TypeError):
            return True  # non-JSON string payload: treat any content as signed
    if isinstance(parsed, (list, dict)):
        return len(parsed) > 0
    return True

APPLICANT_TYPES = {"estate_developer", "individual_landowner"}

# Estate developers (the existing, document-rich onboarding path).
REQUIRED_DOCUMENTS = {
    "government_planning_approval",
    "land_title",
    "survey_plan",
    "estate_development_approval",
}

# Individual landowners often can't produce the full estate-developer document set
# (e.g. a single plot, or a newly completed house). Instead of one fixed required
# list, they must supply at least MIN_LANDOWNER_DOCUMENTS from this broader pool.
LANDOWNER_ALTERNATIVE_DOCUMENTS = {
    "land_title",
    "certificate_of_occupancy",
    "deed_of_assignment",
    "survey_plan",
    "other_title_document",
    "purchase_receipt",
    "sworn_affidavit",
    "tax_receipt",
    "building_approval",
    "utility_bill",
    "chieftaincy_allocation_letter",
}
MIN_LANDOWNER_DOCUMENTS = 3

ALLOWED_DOCUMENTS = REQUIRED_DOCUMENTS | LANDOWNER_ALTERNATIVE_DOCUMENTS

ALLOWED_UPLOAD_MIME_TYPES = {
    "application/pdf",
    "image/jpeg",
    "image/png",
}
MIN_UPLOAD_BYTES = 75 * 1024


def serialize_application(row, documents=None):
    return {
        "id": row["id"],
        "userId": row["user_id"],
        "applicantType": row.get("applicant_type") or "estate_developer",
        "estateName": row["estate_name"],
        "estateLocation": row["estate_location"],
        "villageName": row.get("village_name"),
        "partiesInvolved": row.get("parties_involved"),
        "listingPrice": float(row["listing_price"]) if row.get("listing_price") is not None else None,
        "managerTitle": row.get("manager_title"),
        "status": row["status"],
        "termsVersion": row.get("terms_version"),
        "acceptedTermsAt": row.get("accepted_terms_at"),
        "signatureText": row.get("signature_text"),
        "signatureMethod": row.get("signature_method") or "typed",
        "signatureData": row.get("signature_data"),
        "adminNote": row.get("admin_note"),
        "submittedAt": row.get("submitted_at"),
        "reviewedAt": row.get("reviewed_at"),
        "documents": documents or [],
    }


def serialize_document(row):
    return {
        "id": row["id"],
        "applicationId": row["application_id"],
        "category": row["category"],
        "fileName": row["file_name"],
        "fileUrl": row["file_url"],
        "mimeType": row.get("mime_type"),
        "fileSize": row.get("file_size"),
        "createdAt": row.get("created_at"),
    }


def validate_upload(file_storage):
    filename = secure_filename(file_storage.filename or "")
    mime_type = file_storage.mimetype or ""
    if not filename:
        return None, error("VALIDATION_ERROR", "A file name is required.", 422)
    if mime_type not in ALLOWED_UPLOAD_MIME_TYPES:
        return None, error("UNSUPPORTED_FILE_TYPE", "Upload a PDF, JPEG scan, or PNG scan.", 422)

    stream = file_storage.stream
    current = stream.tell()
    stream.seek(0, os.SEEK_END)
    size = stream.tell()
    stream.seek(current)
    if size < MIN_UPLOAD_BYTES:
        return None, error(
            "LOW_QUALITY_UPLOAD",
            "Upload appears too small for an official PDF or high-resolution scan.",
            422,
            {"minimumBytes": MIN_UPLOAD_BYTES, "actualBytes": size},
        )
    return {"filename": filename, "mimeType": mime_type, "size": size}, None


def save_upload(file_storage, application_id, category):
    # Private vault: NOT under UPLOAD_DIR, so this file is unreachable through the
    # public /uploads/<path:filename> static route no matter what URL is guessed.
    # The only way to it is get_document_file() below, which checks the requester's
    # identity and role.
    upload_root = Path(current_app.config["PRIVATE_UPLOAD_DIR"])
    target_dir = upload_root / "verification" / str(application_id) / category
    target_dir.mkdir(parents=True, exist_ok=True)
    safe_name = secure_filename(file_storage.filename or "upload")
    target_name = f"{uuid4().hex}_{safe_name}"
    target_path = target_dir / target_name
    file_storage.save(target_path)
    # Stored as a vault-relative marker, not a real public URL — it is only ever
    # resolved by document_path_from_url() against PRIVATE_UPLOAD_DIR.
    return target_path, f"vault://verification/{application_id}/{category}/{target_name}"


def get_application_documents(cursor, application_id):
    cursor.execute(
        "SELECT * FROM verification_documents WHERE application_id = %s ORDER BY created_at DESC",
        (application_id,),
    )
    return [serialize_document(row) for row in cursor.fetchall()]


def document_path_from_url(file_url):
    raw = str(file_url or "")
    if raw.startswith("vault://"):
        relative_path = raw[len("vault://"):]
        upload_root = Path(current_app.config["PRIVATE_UPLOAD_DIR"]).resolve()
    else:
        # Backward compatibility for documents saved before the private vault existed.
        relative_path = raw.lstrip("/")
        if relative_path.startswith("uploads/"):
            relative_path = relative_path[len("uploads/"):]
        upload_root = Path(current_app.config["UPLOAD_DIR"]).resolve()

    document_path = (upload_root / relative_path).resolve()
    if upload_root not in document_path.parents and document_path != upload_root:
        return None
    return document_path


@verification_bp.get("/documents/<int:document_id>/file")
@require_roles()
def get_document_file(current_user, document_id):
    """
    Private document vault. Only the Master Owner / verification staff
    (admin, super_admin) and the applicant who owns this specific application may
    ever retrieve a verification document — never other public users, buyers, or
    residents, and never after a purchase completes. The applicant may be an
    estate_manager (estate developer) or a buyer/public_user account (an
    individual landowner selling their own single property) — either way, only
    the exact account that submitted the application can see its own documents.
    Staff access here is view/stream only; nothing about this endpoint enables
    bulk export.
    """
    with db_cursor() as cursor:
        cursor.execute(
            """
            SELECT vd.*, eva.user_id AS owner_user_id
            FROM verification_documents vd
            JOIN estate_verification_applications eva ON eva.id = vd.application_id
            WHERE vd.id = %s
            LIMIT 1
            """,
            (document_id,),
        )
        document = cursor.fetchone()

    if not document:
        return error("NOT_FOUND", "Verification document was not found.", 404)

    is_owner = document["owner_user_id"] == current_user["id"]
    is_staff = current_user["role"] in ("admin", "super_admin")
    if not is_owner and not is_staff:
        return error("FORBIDDEN", "You do not have access to this document.", 403)

    document_path = document_path_from_url(document["file_url"])
    if not document_path or not document_path.exists():
        return error("FILE_NOT_FOUND", "The uploaded document file is missing from storage.", 404)

    if is_staff:
        with db_cursor(commit=True) as audit_cursor:
            record_audit_log(
                audit_cursor,
                current_user["id"],
                "verification.document_viewed",
                "verification_document",
                document_id,
                {"category": document["category"], "fileName": document.get("file_name")},
            )

    # Staff (plain `admin`) may review/validate documents but must never download
    # raw files to a personal device — only super_admin (Master Owner) or the
    # applicant themselves can request the attachment/download form. A staff
    # request for ?download=1 is silently served as an inline view instead of
    # rejected outright, since the content is otherwise identical and blocking
    # the whole request would just break their legitimate review flow.
    is_download_allowed = is_owner or current_user["role"] == "super_admin"
    as_attachment = request.args.get("download") == "1" and is_download_allowed

    return send_file(
        document_path,
        mimetype=document.get("mime_type") or None,
        as_attachment=as_attachment,
        download_name=document.get("file_name") or document_path.name,
    )


@verification_bp.get("/me")
@require_roles("estate_manager", "buyer", "public_user")
def get_my_application(current_user):
    with db_cursor() as cursor:
        cursor.execute(
            """
            SELECT * FROM estate_verification_applications
            WHERE user_id = %s
            ORDER BY created_at DESC
            LIMIT 1
            """,
            (current_user["id"],),
        )
        application = cursor.fetchone()

        if not application:
            return success({"application": None})

        documents = get_application_documents(cursor, application["id"])

    return success({"application": serialize_application(application, documents)})


@verification_bp.post("/applications")
@require_roles("estate_manager", "buyer", "public_user")
def create_or_update_application(current_user):
    payload = request.get_json(silent=True) or {}
    applicant_type = payload.get("applicantType") or "estate_developer"
    estate_name = (payload.get("estateName") or "").strip()
    estate_location = (payload.get("estateLocation") or "").strip()
    village_name = (payload.get("villageName") or "").strip() or None
    parties_involved = (payload.get("partiesInvolved") or "").strip() or None
    listing_price = payload.get("listingPrice")
    manager_title = (payload.get("managerTitle") or "").strip() or None
    terms_version = (payload.get("termsVersion") or "").strip() or None
    signature_text = (payload.get("signatureText") or "").strip() or None
    signature_method = payload.get("signatureMethod") or "typed"
    signature_data = payload.get("signatureData") or None
    accepted_terms = bool(payload.get("acceptedTerms"))

    if applicant_type not in APPLICANT_TYPES:
        return error("VALIDATION_ERROR", "Applicant type is not supported.", 422)
    if signature_method not in ("typed", "drawn"):
        return error("VALIDATION_ERROR", "Signature method is not supported.", 422)
    if signature_method == "drawn" and not _has_real_signature({"signature_text": signature_text, "signature_data": signature_data}):
        return error("VALIDATION_ERROR", "Please draw your signature before continuing.", 422)
    if not estate_name or not estate_location:
        return error("VALIDATION_ERROR", "Estate/property name and location are required.", 422)
    if not village_name or not parties_involved:
        return error(
            "VALIDATION_ERROR",
            "The village/community name and the individuals involved (seller, co-owners, family/community head, witnesses) are required so verification staff can visit and confirm the land in person.",
            422,
        )
    if listing_price in (None, ""):
        return error("VALIDATION_ERROR", "A price is required for verification.", 422)
    try:
        listing_price = float(listing_price)
    except (TypeError, ValueError):
        return error("VALIDATION_ERROR", "Price must be a number.", 422)
    if listing_price < 0:
        return error("VALIDATION_ERROR", "Price cannot be negative.", 422)

    with db_cursor(commit=True) as cursor:
        cursor.execute(
            """
            SELECT * FROM estate_verification_applications
            WHERE user_id = %s AND status IN ('draft', 'additional_info_required', 'rejected')
            ORDER BY created_at DESC
            LIMIT 1
            """,
            (current_user["id"],),
        )
        existing = cursor.fetchone()

        if existing:
            cursor.execute(
                """
                UPDATE estate_verification_applications
                SET applicant_type = %s,
                    estate_name = %s,
                    estate_location = %s,
                    village_name = %s,
                    parties_involved = %s,
                    listing_price = %s,
                    manager_title = %s,
                    terms_version = %s,
                    signature_text = %s,
                    signature_method = %s,
                    signature_data = %s,
                    accepted_terms_at = CASE WHEN %s = 1 THEN CURRENT_TIMESTAMP ELSE accepted_terms_at END
                WHERE id = %s
                """,
                (
                    applicant_type,
                    estate_name,
                    estate_location,
                    village_name,
                    parties_involved,
                    listing_price,
                    manager_title,
                    terms_version,
                    signature_text,
                    signature_method,
                    signature_data,
                    1 if accepted_terms else 0,
                    existing["id"],
                ),
            )
            application_id = existing["id"]
        else:
            cursor.execute(
                """
                INSERT INTO estate_verification_applications
                  (user_id, applicant_type, estate_name, estate_location, village_name,
                   parties_involved, listing_price, manager_title, terms_version,
                   signature_text, signature_method, signature_data, accepted_terms_at)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, CASE WHEN %s = 1 THEN CURRENT_TIMESTAMP ELSE NULL END)
                """,
                (
                    current_user["id"],
                    applicant_type,
                    estate_name,
                    estate_location,
                    village_name,
                    parties_involved,
                    listing_price,
                    manager_title,
                    terms_version,
                    signature_text,
                    signature_method,
                    signature_data,
                    1 if accepted_terms else 0,
                ),
            )
            application_id = cursor.lastrowid

        cursor.execute("SELECT * FROM estate_verification_applications WHERE id = %s", (application_id,))
        application = cursor.fetchone()
        documents = get_application_documents(cursor, application_id)

    return success({"application": serialize_application(application, documents)}, "Application saved", 201)


@verification_bp.post("/applications/<int:application_id>/documents")
@require_roles("estate_manager", "buyer", "public_user")
def add_document(current_user, application_id):
    payload = request.get_json(silent=True) or {}
    category = payload.get("category")
    file_name = (payload.get("fileName") or "").strip()
    file_url = (payload.get("fileUrl") or "").strip()
    mime_type = (payload.get("mimeType") or "").strip() or None
    file_size = payload.get("fileSize")

    if category not in ALLOWED_DOCUMENTS:
        return error("VALIDATION_ERROR", "Document category is not supported.", 422)

    if not file_name or not file_url:
        return error("VALIDATION_ERROR", "File name and file URL are required.", 422)

    with db_cursor(commit=True) as cursor:
        cursor.execute(
            """
            SELECT id FROM estate_verification_applications
            WHERE id = %s AND user_id = %s
            LIMIT 1
            """,
            (application_id, current_user["id"]),
        )
        if not cursor.fetchone():
            return error("NOT_FOUND", "Verification application was not found.", 404)

        cursor.execute(
            """
            INSERT INTO verification_documents
              (application_id, category, file_name, file_url, mime_type, file_size)
            VALUES (%s, %s, %s, %s, %s, %s)
            """,
            (application_id, category, file_name, file_url, mime_type, file_size),
        )
        document_id = cursor.lastrowid
        cursor.execute("SELECT * FROM verification_documents WHERE id = %s", (document_id,))
        document = cursor.fetchone()

    return success({"document": serialize_document(document)}, "Document added", 201)


@verification_bp.post("/applications/<int:application_id>/documents/upload")
@require_roles("estate_manager", "buyer", "public_user")
def upload_documents(current_user, application_id):
    category = request.form.get("category")
    files = request.files.getlist("files")
    if not files and request.files.get("file"):
        files = [request.files["file"]]

    if category not in ALLOWED_DOCUMENTS:
        return error("VALIDATION_ERROR", "Document category is not supported.", 422)
    if not files:
        return error("VALIDATION_ERROR", "At least one file is required.", 422)

    validated = []
    for file_storage in files:
        metadata, validation_error = validate_upload(file_storage)
        if validation_error:
            return validation_error
        validated.append((file_storage, metadata))

    with db_cursor(commit=True) as cursor:
        cursor.execute(
            """
            SELECT id FROM estate_verification_applications
            WHERE id = %s AND user_id = %s
            LIMIT 1
            """,
            (application_id, current_user["id"]),
        )
        if not cursor.fetchone():
            return error("NOT_FOUND", "Verification application was not found.", 404)

        documents = []
        for file_storage, metadata in validated:
            _, public_url = save_upload(file_storage, application_id, category)
            cursor.execute(
                """
                INSERT INTO verification_documents
                  (application_id, category, file_name, file_url, mime_type, file_size)
                VALUES (%s, %s, %s, %s, %s, %s)
                """,
                (
                    application_id,
                    category,
                    metadata["filename"],
                    public_url,
                    metadata["mimeType"],
                    metadata["size"],
                ),
            )
            document_id = cursor.lastrowid
            cursor.execute("SELECT * FROM verification_documents WHERE id = %s", (document_id,))
            documents.append(serialize_document(cursor.fetchone()))

        record_audit_log(
            cursor,
            current_user["id"],
            "verification.documents_uploaded",
            "estate_verification_application",
            application_id,
            {"category": category, "count": len(documents)},
        )

    return success({"documents": documents}, "Documents uploaded", 201)


@verification_bp.post("/applications/<int:application_id>/submit")
@require_roles("estate_manager", "buyer", "public_user")
def submit_application(current_user, application_id):
    with db_cursor(commit=True) as cursor:
        cursor.execute(
            """
            SELECT * FROM estate_verification_applications
            WHERE id = %s AND user_id = %s
            LIMIT 1
            """,
            (application_id, current_user["id"]),
        )
        application = cursor.fetchone()

        if not application:
            return error("NOT_FOUND", "Verification application was not found.", 404)

        if not application.get("accepted_terms_at") or not _has_real_signature(application):
            return error("VALIDATION_ERROR", "Terms acceptance and signature are required.", 422)
        if not application.get("village_name") or not application.get("parties_involved") or application.get("listing_price") is None:
            return error(
                "VALIDATION_ERROR",
                "Village/community name, parties involved, and price are required before submitting.",
                422,
            )

        cursor.execute(
            "SELECT DISTINCT category FROM verification_documents WHERE application_id = %s",
            (application_id,),
        )
        categories = {row["category"] for row in cursor.fetchall()}
        applicant_type = application.get("applicant_type") or "estate_developer"

        if applicant_type == "individual_landowner":
            landowner_docs = categories & LANDOWNER_ALTERNATIVE_DOCUMENTS
            if len(landowner_docs) < MIN_LANDOWNER_DOCUMENTS:
                return error(
                    "MISSING_DOCUMENTS",
                    f"Individual landowner submissions require at least {MIN_LANDOWNER_DOCUMENTS} supporting documents.",
                    422,
                    {"minimumRequired": MIN_LANDOWNER_DOCUMENTS, "uploadedCount": len(landowner_docs)},
                )
        else:
            missing = sorted(REQUIRED_DOCUMENTS - categories)
            if missing:
                return error("MISSING_DOCUMENTS", "Required verification documents are missing.", 422, {"missing": missing})

        cursor.execute(
            """
            UPDATE estate_verification_applications
            SET status = 'pending_review', submitted_at = CURRENT_TIMESTAMP
            WHERE id = %s
            """,
            (application_id,),
        )

        # Alert verification staff (admins) that a new application is waiting
        # for review.
        create_notification(
            cursor,
            role="admin",
            title="New verification application",
            body=f"{application.get('estate_name') or 'A new estate'} was submitted for verification review.",
            type="verification",
            entity_type="verification_application",
            entity_id=application_id,
        )
        queue_push(
            role="admin",
            title="New verification application",
            body=f"{application.get('estate_name') or 'A new estate'} was submitted for verification review.",
            data={"type": "verification", "entityType": "verification_application", "entityId": application_id},
        )

        cursor.execute("SELECT * FROM estate_verification_applications WHERE id = %s", (application_id,))
        updated = cursor.fetchone()
        documents = get_application_documents(cursor, application_id)

    flush_push_queue()
    return success({"application": serialize_application(updated, documents)}, "Application submitted")
