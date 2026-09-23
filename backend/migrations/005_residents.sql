CREATE TABLE IF NOT EXISTS residents (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  estate_id BIGINT UNSIGNED NOT NULL,
  property_id BIGINT UNSIGNED NULL,
  user_id BIGINT UNSIGNED NULL,
  full_name VARCHAR(160) NOT NULL,
  phone VARCHAR(40) NULL,
  email VARCHAR(190) NULL,
  identity_type VARCHAR(80) NULL,
  identity_number VARCHAR(120) NULL,
  status ENUM('pending', 'verified', 'active', 'suspended', 'moved_out') NOT NULL DEFAULT 'pending',
  note TEXT NULL,
  created_by BIGINT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY residents_estate_id_index (estate_id),
  KEY residents_property_id_index (property_id),
  KEY residents_status_index (status),
  CONSTRAINT residents_estate_id_foreign
    FOREIGN KEY (estate_id) REFERENCES estates(id)
    ON DELETE CASCADE,
  CONSTRAINT residents_property_id_foreign
    FOREIGN KEY (property_id) REFERENCES properties(id)
    ON DELETE SET NULL,
  CONSTRAINT residents_user_id_foreign
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE SET NULL,
  CONSTRAINT residents_created_by_foreign
    FOREIGN KEY (created_by) REFERENCES users(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
