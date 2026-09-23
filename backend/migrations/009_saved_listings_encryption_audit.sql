CREATE TABLE IF NOT EXISTS saved_listings (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  property_id BIGINT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY saved_listings_user_property_unique (user_id, property_id),
  KEY saved_listings_user_id_index (user_id),
  KEY saved_listings_property_id_index (property_id),
  CONSTRAINT saved_listings_user_id_foreign
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE,
  CONSTRAINT saved_listings_property_id_foreign
    FOREIGN KEY (property_id) REFERENCES properties(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE property_documents ADD COLUMN encrypted_payload LONGTEXT NULL AFTER file_url;
ALTER TABLE property_documents ADD COLUMN encryption_context VARCHAR(120) NULL AFTER encrypted_payload;
ALTER TABLE estate_reports ADD COLUMN encrypted_payload LONGTEXT NULL AFTER attachment_url;
ALTER TABLE maintenance_requests ADD COLUMN encrypted_payload LONGTEXT NULL AFTER attachment_url;
