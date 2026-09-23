INSERT IGNORE INTO platform_settings (setting_key, setting_value) VALUES ('guest_pass_fee', '50.00');

CREATE TABLE IF NOT EXISTS wallets (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  balance DECIMAL(15, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY wallets_user_id_unique (user_id),
  CONSTRAINT wallets_user_id_foreign
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS wallet_transactions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  wallet_id BIGINT UNSIGNED NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  type ENUM('topup', 'guest_pass_fee', 'refund', 'adjustment') NOT NULL,
  -- gross_amount/fee_amount are only meaningful for 'topup' (what the resident
  -- paid via Paystack vs the platform 2 percent cut). net_amount is what
  -- actually moved the wallet balance: positive for a credit (topup, refund),
  -- negative for a debit (guest_pass_fee).
  gross_amount DECIMAL(15, 2) NULL,
  fee_amount DECIMAL(15, 2) NULL,
  net_amount DECIMAL(15, 2) NOT NULL,
  reference VARCHAR(120) NULL,
  status ENUM('pending', 'success', 'failed') NOT NULL DEFAULT 'success',
  visitor_pass_id BIGINT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY wallet_transactions_reference_unique (reference),
  KEY wallet_transactions_wallet_id_index (wallet_id),
  KEY wallet_transactions_user_id_index (user_id),
  CONSTRAINT wallet_transactions_wallet_id_foreign
    FOREIGN KEY (wallet_id) REFERENCES wallets(id)
    ON DELETE CASCADE,
  CONSTRAINT wallet_transactions_user_id_foreign
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE,
  CONSTRAINT wallet_transactions_visitor_pass_id_foreign
    FOREIGN KEY (visitor_pass_id) REFERENCES visitor_passes(id)
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Gates document generation/signing for fee-liable form templates (Plot
-- Allocation Form, Ownership Transfer Form): a form_submission for one of
-- those templates may only be created once a matching row here is 'success'
-- and not yet consumed (submission_id IS NULL).
CREATE TABLE IF NOT EXISTS document_generation_payments (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  template_code VARCHAR(80) NOT NULL,
  property_id BIGINT UNSIGNED NOT NULL,
  estate_id BIGINT UNSIGNED NULL,
  amount DECIMAL(15, 2) NOT NULL,
  commission_percent DECIMAL(5, 2) NOT NULL,
  reference VARCHAR(120) NOT NULL,
  status ENUM('pending', 'success', 'failed') NOT NULL DEFAULT 'pending',
  submission_id BIGINT UNSIGNED NULL,
  created_by BIGINT UNSIGNED NOT NULL,
  paid_at TIMESTAMP NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY document_generation_payments_reference_unique (reference),
  KEY document_generation_payments_property_id_index (property_id),
  KEY document_generation_payments_status_index (status),
  CONSTRAINT document_generation_payments_property_id_foreign
    FOREIGN KEY (property_id) REFERENCES properties(id)
    ON DELETE CASCADE,
  CONSTRAINT document_generation_payments_estate_id_foreign
    FOREIGN KEY (estate_id) REFERENCES estates(id)
    ON DELETE SET NULL,
  CONSTRAINT document_generation_payments_submission_id_foreign
    FOREIGN KEY (submission_id) REFERENCES form_submissions(id)
    ON DELETE SET NULL,
  CONSTRAINT document_generation_payments_created_by_foreign
    FOREIGN KEY (created_by) REFERENCES users(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
