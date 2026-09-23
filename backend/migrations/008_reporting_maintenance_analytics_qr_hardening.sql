ALTER TABLE visitor_passes ADD COLUMN qr_token_hash VARCHAR(255) NULL AFTER qr_payload;
ALTER TABLE visitor_passes ADD COLUMN checked_in_at TIMESTAMP NULL AFTER valid_until;
ALTER TABLE visitor_passes ADD COLUMN checked_out_at TIMESTAMP NULL AFTER checked_in_at;
ALTER TABLE visitor_passes ADD COLUMN checked_in_by BIGINT UNSIGNED NULL AFTER checked_out_at;
ALTER TABLE visitor_passes ADD COLUMN checked_out_by BIGINT UNSIGNED NULL AFTER checked_in_by;
ALTER TABLE visitor_passes ADD COLUMN gate_name VARCHAR(120) NULL AFTER checked_out_by;
ALTER TABLE visitor_passes ADD KEY visitor_passes_qr_token_hash_index (qr_token_hash);
ALTER TABLE visitor_passes
  ADD CONSTRAINT visitor_passes_checked_in_by_foreign
  FOREIGN KEY (checked_in_by) REFERENCES users(id)
  ON DELETE SET NULL;
ALTER TABLE visitor_passes
  ADD CONSTRAINT visitor_passes_checked_out_by_foreign
  FOREIGN KEY (checked_out_by) REFERENCES users(id)
  ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS estate_reports (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  estate_id BIGINT UNSIGNED NULL,
  property_id BIGINT UNSIGNED NULL,
  reporter_user_id BIGINT UNSIGNED NULL,
  reporter_name VARCHAR(160) NULL,
  reporter_contact VARCHAR(190) NULL,
  category ENUM('false_estate_information', 'suspicious_documents', 'fraud_concern', 'misrepresentation', 'other_violation') NOT NULL,
  description TEXT NOT NULL,
  attachment_url TEXT NULL,
  status ENUM('submitted', 'under_review', 'additional_info_required', 'dismissed', 'escalated', 'estate_suspended', 'estate_removed') NOT NULL DEFAULT 'submitted',
  admin_note TEXT NULL,
  reviewed_by BIGINT UNSIGNED NULL,
  reviewed_at TIMESTAMP NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY estate_reports_estate_id_index (estate_id),
  KEY estate_reports_status_index (status),
  KEY estate_reports_category_index (category),
  CONSTRAINT estate_reports_estate_id_foreign
    FOREIGN KEY (estate_id) REFERENCES estates(id)
    ON DELETE SET NULL,
  CONSTRAINT estate_reports_property_id_foreign
    FOREIGN KEY (property_id) REFERENCES properties(id)
    ON DELETE SET NULL,
  CONSTRAINT estate_reports_reporter_user_id_foreign
    FOREIGN KEY (reporter_user_id) REFERENCES users(id)
    ON DELETE SET NULL,
  CONSTRAINT estate_reports_reviewed_by_foreign
    FOREIGN KEY (reviewed_by) REFERENCES users(id)
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS service_providers (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  estate_id BIGINT UNSIGNED NULL,
  name VARCHAR(160) NOT NULL,
  category VARCHAR(80) NOT NULL,
  phone VARCHAR(40) NULL,
  rating DECIMAL(3, 2) NOT NULL DEFAULT 0,
  availability ENUM('available', 'busy', 'offline') NOT NULL DEFAULT 'available',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY service_providers_category_index (category),
  KEY service_providers_estate_id_index (estate_id),
  CONSTRAINT service_providers_estate_id_foreign
    FOREIGN KEY (estate_id) REFERENCES estates(id)
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS maintenance_requests (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  estate_id BIGINT UNSIGNED NULL,
  resident_user_id BIGINT UNSIGNED NULL,
  property_id BIGINT UNSIGNED NULL,
  provider_id BIGINT UNSIGNED NULL,
  title VARCHAR(160) NOT NULL,
  category VARCHAR(80) NOT NULL,
  description TEXT NOT NULL,
  priority ENUM('low', 'medium', 'high', 'urgent') NOT NULL DEFAULT 'medium',
  status ENUM('open', 'assigned', 'in_progress', 'resolved', 'closed') NOT NULL DEFAULT 'open',
  preferred_time VARCHAR(120) NULL,
  attachment_url TEXT NULL,
  created_by BIGINT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY maintenance_requests_status_index (status),
  KEY maintenance_requests_estate_id_index (estate_id),
  CONSTRAINT maintenance_requests_estate_id_foreign
    FOREIGN KEY (estate_id) REFERENCES estates(id)
    ON DELETE SET NULL,
  CONSTRAINT maintenance_requests_provider_id_foreign
    FOREIGN KEY (provider_id) REFERENCES service_providers(id)
    ON DELETE SET NULL,
  CONSTRAINT maintenance_requests_created_by_foreign
    FOREIGN KEY (created_by) REFERENCES users(id)
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS maintenance_updates (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  request_id BIGINT UNSIGNED NOT NULL,
  author_user_id BIGINT UNSIGNED NULL,
  status VARCHAR(40) NULL,
  note TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY maintenance_updates_request_id_index (request_id),
  CONSTRAINT maintenance_updates_request_id_foreign
    FOREIGN KEY (request_id) REFERENCES maintenance_requests(id)
    ON DELETE CASCADE,
  CONSTRAINT maintenance_updates_author_user_id_foreign
    FOREIGN KEY (author_user_id) REFERENCES users(id)
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS analytics_exports (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  requested_by BIGINT UNSIGNED NULL,
  report_type VARCHAR(80) NOT NULL,
  format ENUM('json', 'csv') NOT NULL DEFAULT 'json',
  filters_json JSON NULL,
  status ENUM('ready', 'failed') NOT NULL DEFAULT 'ready',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY analytics_exports_requested_by_index (requested_by),
  CONSTRAINT analytics_exports_requested_by_foreign
    FOREIGN KEY (requested_by) REFERENCES users(id)
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
