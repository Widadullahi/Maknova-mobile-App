CREATE TABLE IF NOT EXISTS estate_verification_applications (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  estate_name VARCHAR(190) NOT NULL,
  estate_location VARCHAR(255) NOT NULL,
  manager_title VARCHAR(120) NULL,
  status ENUM('draft', 'pending_review', 'approved', 'rejected', 'additional_info_required') NOT NULL DEFAULT 'draft',
  terms_version VARCHAR(40) NULL,
  accepted_terms_at TIMESTAMP NULL,
  signature_text VARCHAR(190) NULL,
  admin_note TEXT NULL,
  reviewed_by BIGINT UNSIGNED NULL,
  reviewed_at TIMESTAMP NULL,
  submitted_at TIMESTAMP NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY verification_user_id_index (user_id),
  KEY verification_status_index (status),
  CONSTRAINT verification_user_id_foreign
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE,
  CONSTRAINT verification_reviewed_by_foreign
    FOREIGN KEY (reviewed_by) REFERENCES users(id)
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS verification_documents (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  application_id BIGINT UNSIGNED NOT NULL,
  category ENUM(
    'government_planning_approval',
    'land_title',
    'certificate_of_occupancy',
    'deed_of_assignment',
    'survey_plan',
    'estate_development_approval',
    'other_title_document'
  ) NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  file_url TEXT NOT NULL,
  mime_type VARCHAR(120) NULL,
  file_size BIGINT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY verification_documents_application_id_index (application_id),
  KEY verification_documents_category_index (category),
  CONSTRAINT verification_documents_application_id_foreign
    FOREIGN KEY (application_id) REFERENCES estate_verification_applications(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS estates (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  manager_user_id BIGINT UNSIGNED NOT NULL,
  verification_application_id BIGINT UNSIGNED NULL,
  name VARCHAR(190) NOT NULL,
  location VARCHAR(255) NOT NULL,
  description TEXT NULL,
  contact_email VARCHAR(190) NULL,
  contact_phone VARCHAR(40) NULL,
  status ENUM('draft', 'pending_review', 'approved', 'suspended', 'removed') NOT NULL DEFAULT 'draft',
  is_published TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY estates_verification_application_unique (verification_application_id),
  KEY estates_manager_user_id_index (manager_user_id),
  KEY estates_status_index (status),
  CONSTRAINT estates_manager_user_id_foreign
    FOREIGN KEY (manager_user_id) REFERENCES users(id)
    ON DELETE CASCADE,
  CONSTRAINT estates_verification_application_id_foreign
    FOREIGN KEY (verification_application_id) REFERENCES estate_verification_applications(id)
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS estate_documents (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  estate_id BIGINT UNSIGNED NOT NULL,
  category ENUM('plot_allocation_form', 'ownership_transfer_form', 'noc_issuance_form', 'other') NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  file_url TEXT NOT NULL,
  mime_type VARCHAR(120) NULL,
  file_size BIGINT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY estate_documents_estate_id_index (estate_id),
  CONSTRAINT estate_documents_estate_id_foreign
    FOREIGN KEY (estate_id) REFERENCES estates(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS properties (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  estate_id BIGINT UNSIGNED NOT NULL,
  property_identifier VARCHAR(120) NOT NULL,
  plot_number VARCHAR(120) NULL,
  property_type VARCHAR(120) NOT NULL,
  plot_size VARCHAR(120) NULL,
  price DECIMAL(15, 2) NOT NULL DEFAULT 0,
  description TEXT NULL,
  status ENUM('available', 'reserved', 'under_offer', 'sold', 'allocated', 'unavailable') NOT NULL DEFAULT 'available',
  buyer_user_id BIGINT UNSIGNED NULL,
  owner_user_id BIGINT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY properties_estate_identifier_unique (estate_id, property_identifier),
  KEY properties_estate_id_index (estate_id),
  KEY properties_status_index (status),
  KEY properties_type_index (property_type),
  CONSTRAINT properties_estate_id_foreign
    FOREIGN KEY (estate_id) REFERENCES estates(id)
    ON DELETE CASCADE,
  CONSTRAINT properties_buyer_user_id_foreign
    FOREIGN KEY (buyer_user_id) REFERENCES users(id)
    ON DELETE SET NULL,
  CONSTRAINT properties_owner_user_id_foreign
    FOREIGN KEY (owner_user_id) REFERENCES users(id)
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS property_documents (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  property_id BIGINT UNSIGNED NOT NULL,
  category ENUM('image', 'title_document', 'allocation_document', 'other') NOT NULL DEFAULT 'other',
  file_name VARCHAR(255) NOT NULL,
  file_url TEXT NOT NULL,
  mime_type VARCHAR(120) NULL,
  file_size BIGINT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY property_documents_property_id_index (property_id),
  CONSTRAINT property_documents_property_id_foreign
    FOREIGN KEY (property_id) REFERENCES properties(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS property_status_history (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  property_id BIGINT UNSIGNED NOT NULL,
  previous_status VARCHAR(40) NULL,
  next_status VARCHAR(40) NOT NULL,
  changed_by BIGINT UNSIGNED NOT NULL,
  note TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY property_status_history_property_id_index (property_id),
  CONSTRAINT property_status_history_property_id_foreign
    FOREIGN KEY (property_id) REFERENCES properties(id)
    ON DELETE CASCADE,
  CONSTRAINT property_status_history_changed_by_foreign
    FOREIGN KEY (changed_by) REFERENCES users(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
