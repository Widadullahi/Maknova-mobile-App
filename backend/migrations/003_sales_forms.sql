CREATE TABLE IF NOT EXISTS buyers (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  estate_id BIGINT UNSIGNED NOT NULL,
  full_name VARCHAR(160) NOT NULL,
  email VARCHAR(190) NULL,
  phone VARCHAR(40) NULL,
  address TEXT NULL,
  identity_type VARCHAR(80) NULL,
  identity_number VARCHAR(120) NULL,
  created_by BIGINT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY buyers_estate_id_index (estate_id),
  KEY buyers_created_by_index (created_by),
  CONSTRAINT buyers_estate_id_foreign
    FOREIGN KEY (estate_id) REFERENCES estates(id)
    ON DELETE CASCADE,
  CONSTRAINT buyers_created_by_foreign
    FOREIGN KEY (created_by) REFERENCES users(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS reservations (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  estate_id BIGINT UNSIGNED NOT NULL,
  property_id BIGINT UNSIGNED NOT NULL,
  buyer_id BIGINT UNSIGNED NOT NULL,
  status ENUM('active', 'cancelled', 'converted_to_sale', 'expired') NOT NULL DEFAULT 'active',
  reserved_until DATE NULL,
  note TEXT NULL,
  created_by BIGINT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY reservations_estate_id_index (estate_id),
  KEY reservations_property_id_index (property_id),
  KEY reservations_buyer_id_index (buyer_id),
  CONSTRAINT reservations_estate_id_foreign
    FOREIGN KEY (estate_id) REFERENCES estates(id)
    ON DELETE CASCADE,
  CONSTRAINT reservations_property_id_foreign
    FOREIGN KEY (property_id) REFERENCES properties(id)
    ON DELETE CASCADE,
  CONSTRAINT reservations_buyer_id_foreign
    FOREIGN KEY (buyer_id) REFERENCES buyers(id)
    ON DELETE CASCADE,
  CONSTRAINT reservations_created_by_foreign
    FOREIGN KEY (created_by) REFERENCES users(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS sales (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  estate_id BIGINT UNSIGNED NOT NULL,
  property_id BIGINT UNSIGNED NOT NULL,
  buyer_id BIGINT UNSIGNED NOT NULL,
  reservation_id BIGINT UNSIGNED NULL,
  sale_price DECIMAL(15, 2) NOT NULL DEFAULT 0,
  payment_status ENUM('pending', 'partial', 'paid', 'failed', 'refunded') NOT NULL DEFAULT 'pending',
  status ENUM('draft', 'active', 'completed', 'cancelled') NOT NULL DEFAULT 'active',
  note TEXT NULL,
  created_by BIGINT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY sales_estate_id_index (estate_id),
  KEY sales_property_id_index (property_id),
  KEY sales_buyer_id_index (buyer_id),
  CONSTRAINT sales_estate_id_foreign
    FOREIGN KEY (estate_id) REFERENCES estates(id)
    ON DELETE CASCADE,
  CONSTRAINT sales_property_id_foreign
    FOREIGN KEY (property_id) REFERENCES properties(id)
    ON DELETE CASCADE,
  CONSTRAINT sales_buyer_id_foreign
    FOREIGN KEY (buyer_id) REFERENCES buyers(id)
    ON DELETE CASCADE,
  CONSTRAINT sales_reservation_id_foreign
    FOREIGN KEY (reservation_id) REFERENCES reservations(id)
    ON DELETE SET NULL,
  CONSTRAINT sales_created_by_foreign
    FOREIGN KEY (created_by) REFERENCES users(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS allocations (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  estate_id BIGINT UNSIGNED NOT NULL,
  property_id BIGINT UNSIGNED NOT NULL,
  buyer_id BIGINT UNSIGNED NOT NULL,
  sale_id BIGINT UNSIGNED NULL,
  allocation_reference VARCHAR(120) NOT NULL,
  allocated_at DATE NOT NULL,
  note TEXT NULL,
  created_by BIGINT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY allocations_reference_unique (allocation_reference),
  KEY allocations_estate_id_index (estate_id),
  KEY allocations_property_id_index (property_id),
  CONSTRAINT allocations_estate_id_foreign
    FOREIGN KEY (estate_id) REFERENCES estates(id)
    ON DELETE CASCADE,
  CONSTRAINT allocations_property_id_foreign
    FOREIGN KEY (property_id) REFERENCES properties(id)
    ON DELETE CASCADE,
  CONSTRAINT allocations_buyer_id_foreign
    FOREIGN KEY (buyer_id) REFERENCES buyers(id)
    ON DELETE CASCADE,
  CONSTRAINT allocations_sale_id_foreign
    FOREIGN KEY (sale_id) REFERENCES sales(id)
    ON DELETE SET NULL,
  CONSTRAINT allocations_created_by_foreign
    FOREIGN KEY (created_by) REFERENCES users(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS digital_form_templates (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  code VARCHAR(80) NOT NULL,
  name VARCHAR(160) NOT NULL,
  version VARCHAR(40) NOT NULL DEFAULT 'v1',
  schema_json JSON NOT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY digital_form_templates_code_version_unique (code, version)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS form_submissions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  template_id BIGINT UNSIGNED NOT NULL,
  estate_id BIGINT UNSIGNED NULL,
  property_id BIGINT UNSIGNED NULL,
  buyer_id BIGINT UNSIGNED NULL,
  resident_user_id BIGINT UNSIGNED NULL,
  submitted_by BIGINT UNSIGNED NOT NULL,
  status ENUM('draft', 'submitted', 'reviewed', 'approved', 'rejected') NOT NULL DEFAULT 'submitted',
  payload_json JSON NOT NULL,
  submitted_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY form_submissions_template_id_index (template_id),
  KEY form_submissions_estate_id_index (estate_id),
  CONSTRAINT form_submissions_template_id_foreign
    FOREIGN KEY (template_id) REFERENCES digital_form_templates(id)
    ON DELETE CASCADE,
  CONSTRAINT form_submissions_estate_id_foreign
    FOREIGN KEY (estate_id) REFERENCES estates(id)
    ON DELETE SET NULL,
  CONSTRAINT form_submissions_property_id_foreign
    FOREIGN KEY (property_id) REFERENCES properties(id)
    ON DELETE SET NULL,
  CONSTRAINT form_submissions_buyer_id_foreign
    FOREIGN KEY (buyer_id) REFERENCES buyers(id)
    ON DELETE SET NULL,
  CONSTRAINT form_submissions_resident_user_id_foreign
    FOREIGN KEY (resident_user_id) REFERENCES users(id)
    ON DELETE SET NULL,
  CONSTRAINT form_submissions_submitted_by_foreign
    FOREIGN KEY (submitted_by) REFERENCES users(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS signature_records (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  form_submission_id BIGINT UNSIGNED NOT NULL,
  signer_user_id BIGINT UNSIGNED NOT NULL,
  signature_method ENUM('typed', 'drawn', 'electronic_acceptance') NOT NULL DEFAULT 'typed',
  signature_text VARCHAR(190) NULL,
  terms_version VARCHAR(40) NULL,
  signed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  device_metadata JSON NULL,
  PRIMARY KEY (id),
  KEY signature_records_submission_id_index (form_submission_id),
  CONSTRAINT signature_records_submission_id_foreign
    FOREIGN KEY (form_submission_id) REFERENCES form_submissions(id)
    ON DELETE CASCADE,
  CONSTRAINT signature_records_signer_user_id_foreign
    FOREIGN KEY (signer_user_id) REFERENCES users(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO digital_form_templates (code, name, version, schema_json)
VALUES
  ('plot_allocation_form', 'Plot Allocation Form', 'v1', JSON_OBJECT('fields', JSON_ARRAY('allocationReference', 'buyerName', 'propertyIdentifier'))),
  ('ownership_transfer_form', 'Ownership Transfer Form', 'v1', JSON_OBJECT('fields', JSON_ARRAY('previousOwner', 'newOwner', 'propertyIdentifier'))),
  ('noc_issuance_form', 'NOC Issuance Form', 'v1', JSON_OBJECT('fields', JSON_ARRAY('recipientName', 'propertyIdentifier', 'purpose'))),
  ('resident_entry_approval_form', 'Resident Entry Approval Form', 'v1', JSON_OBJECT('fields', JSON_ARRAY('residentName', 'propertyIdentifier', 'approvalReason'))),
  ('resident_verification_form', 'Resident Verification Form', 'v1', JSON_OBJECT('fields', JSON_ARRAY('residentName', 'identityType', 'identityNumber')));
