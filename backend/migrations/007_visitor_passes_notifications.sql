CREATE TABLE IF NOT EXISTS visitor_passes (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  estate_id BIGINT UNSIGNED NULL,
  resident_user_id BIGINT UNSIGNED NULL,
  host_name VARCHAR(160) NULL,
  visitor_name VARCHAR(160) NOT NULL,
  visitor_phone VARCHAR(40) NULL,
  visitor_identity_type VARCHAR(80) NULL,
  visitor_identity_number VARCHAR(120) NULL,
  plate_number VARCHAR(40) NULL,
  purpose VARCHAR(80) NOT NULL,
  pass_type ENUM('single_entry', 'multi_day', 'recurring') NOT NULL DEFAULT 'single_entry',
  code VARCHAR(40) NOT NULL,
  pin VARCHAR(12) NOT NULL,
  qr_payload VARCHAR(255) NOT NULL,
  status ENUM('pending', 'approved', 'denied', 'checked_in', 'checked_out', 'expired') NOT NULL DEFAULT 'approved',
  expected_date VARCHAR(80) NULL,
  expected_time VARCHAR(80) NULL,
  valid_from DATETIME NULL,
  valid_until DATETIME NULL,
  created_by BIGINT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY visitor_passes_code_unique (code),
  UNIQUE KEY visitor_passes_pin_unique (pin),
  KEY visitor_passes_estate_id_index (estate_id),
  KEY visitor_passes_status_index (status),
  KEY visitor_passes_created_by_index (created_by),
  CONSTRAINT visitor_passes_estate_id_foreign
    FOREIGN KEY (estate_id) REFERENCES estates(id)
    ON DELETE SET NULL,
  CONSTRAINT visitor_passes_resident_user_id_foreign
    FOREIGN KEY (resident_user_id) REFERENCES users(id)
    ON DELETE SET NULL,
  CONSTRAINT visitor_passes_created_by_foreign
    FOREIGN KEY (created_by) REFERENCES users(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS visitor_pass_verifications (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  visitor_pass_id BIGINT UNSIGNED NULL,
  verified_by BIGINT UNSIGNED NULL,
  verification_method ENUM('qr', 'pin', 'code') NOT NULL,
  scanned_value VARCHAR(255) NOT NULL,
  result ENUM('approved', 'checked_in', 'checked_out', 'denied', 'expired', 'already_used', 'not_found') NOT NULL,
  message VARCHAR(255) NOT NULL,
  gate_name VARCHAR(120) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY visitor_pass_verifications_pass_id_index (visitor_pass_id),
  KEY visitor_pass_verifications_verified_by_index (verified_by),
  KEY visitor_pass_verifications_result_index (result),
  CONSTRAINT visitor_pass_verifications_pass_id_foreign
    FOREIGN KEY (visitor_pass_id) REFERENCES visitor_passes(id)
    ON DELETE SET NULL,
  CONSTRAINT visitor_pass_verifications_verified_by_foreign
    FOREIGN KEY (verified_by) REFERENCES users(id)
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS notifications (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NULL,
  role VARCHAR(40) NULL,
  title VARCHAR(160) NOT NULL,
  body TEXT NOT NULL,
  type VARCHAR(80) NOT NULL DEFAULT 'info',
  entity_type VARCHAR(80) NULL,
  entity_id BIGINT UNSIGNED NULL,
  is_read TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  read_at TIMESTAMP NULL,
  PRIMARY KEY (id),
  KEY notifications_user_id_index (user_id),
  KEY notifications_role_index (role),
  KEY notifications_is_read_index (is_read),
  CONSTRAINT notifications_user_id_foreign
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
