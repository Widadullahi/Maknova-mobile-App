CREATE TABLE IF NOT EXISTS platform_settings (
  setting_key VARCHAR(80) NOT NULL,
  setting_value VARCHAR(255) NOT NULL,
  updated_by BIGINT UNSIGNED NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (setting_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT IGNORE INTO platform_settings (setting_key, setting_value) VALUES ('commission_percent', '2.00');

CREATE TABLE IF NOT EXISTS payment_transactions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  sale_id BIGINT UNSIGNED NOT NULL,
  estate_id BIGINT UNSIGNED NOT NULL,
  buyer_id BIGINT UNSIGNED NOT NULL,
  reference VARCHAR(120) NOT NULL,
  amount DECIMAL(15, 2) NOT NULL,
  commission_amount DECIMAL(15, 2) NOT NULL DEFAULT 0,
  commission_percent DECIMAL(5, 2) NOT NULL DEFAULT 2.00,
  status ENUM('initialized', 'success', 'failed') NOT NULL DEFAULT 'initialized',
  channel VARCHAR(40) NULL,
  authorization_url TEXT NULL,
  gateway_response TEXT NULL,
  created_by BIGINT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY payment_transactions_reference_unique (reference),
  KEY payment_transactions_sale_id_index (sale_id),
  KEY payment_transactions_estate_id_index (estate_id),
  CONSTRAINT payment_transactions_sale_id_foreign
    FOREIGN KEY (sale_id) REFERENCES sales (id) ON DELETE CASCADE,
  CONSTRAINT payment_transactions_estate_id_foreign
    FOREIGN KEY (estate_id) REFERENCES estates (id) ON DELETE CASCADE,
  CONSTRAINT payment_transactions_buyer_id_foreign
    FOREIGN KEY (buyer_id) REFERENCES buyers (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS payment_events (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  transaction_reference VARCHAR(120) NOT NULL,
  event_type VARCHAR(80) NOT NULL,
  payload JSON NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY payment_events_reference_event_unique (transaction_reference, event_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
