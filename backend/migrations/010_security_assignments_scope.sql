CREATE TABLE IF NOT EXISTS security_assignments (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  estate_id BIGINT UNSIGNED NOT NULL,
  gate_name VARCHAR(120) NULL,
  status ENUM('active', 'suspended') NOT NULL DEFAULT 'active',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY security_assignments_user_estate_gate_unique (user_id, estate_id, gate_name),
  KEY security_assignments_user_id_index (user_id),
  KEY security_assignments_estate_id_index (estate_id),
  CONSTRAINT security_assignments_user_id_foreign
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE,
  CONSTRAINT security_assignments_estate_id_foreign
    FOREIGN KEY (estate_id) REFERENCES estates(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
