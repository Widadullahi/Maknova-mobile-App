CREATE TABLE IF NOT EXISTS support_tickets (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  estate_id BIGINT UNSIGNED NULL,
  reporter_user_id BIGINT UNSIGNED NULL,
  assigned_to BIGINT UNSIGNED NULL,
  subject VARCHAR(180) NOT NULL,
  category VARCHAR(80) NOT NULL DEFAULT 'general',
  priority ENUM('low', 'medium', 'high', 'urgent') NOT NULL DEFAULT 'medium',
  status ENUM('open', 'assigned', 'in_progress', 'resolved', 'closed') NOT NULL DEFAULT 'open',
  description TEXT NOT NULL,
  admin_note TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY support_tickets_estate_id_index (estate_id),
  KEY support_tickets_status_index (status),
  KEY support_tickets_priority_index (priority),
  CONSTRAINT support_tickets_estate_id_foreign
    FOREIGN KEY (estate_id) REFERENCES estates(id)
    ON DELETE SET NULL,
  CONSTRAINT support_tickets_reporter_user_id_foreign
    FOREIGN KEY (reporter_user_id) REFERENCES users(id)
    ON DELETE SET NULL,
  CONSTRAINT support_tickets_assigned_to_foreign
    FOREIGN KEY (assigned_to) REFERENCES users(id)
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
