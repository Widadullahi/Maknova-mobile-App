CREATE TABLE IF NOT EXISTS account_deletion_requests (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NULL,
  email VARCHAR(190) NOT NULL,
  full_name VARCHAR(160) NULL,
  reason VARCHAR(1000) NULL,
  status ENUM('pending', 'in_review', 'approved', 'rejected', 'completed') NOT NULL DEFAULT 'pending',
  requested_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  reviewed_at TIMESTAMP NULL,
  completed_at TIMESTAMP NULL,
  reviewed_by BIGINT UNSIGNED NULL,
  review_note VARCHAR(1000) NULL,
  requester_ip VARCHAR(45) NULL,
  PRIMARY KEY (id),
  KEY account_deletion_requests_user_id_index (user_id),
  KEY account_deletion_requests_status_index (status),
  KEY account_deletion_requests_email_index (email),
  CONSTRAINT account_deletion_requests_user_id_foreign
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT account_deletion_requests_reviewed_by_foreign
    FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
