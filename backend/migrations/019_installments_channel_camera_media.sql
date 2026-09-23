-- 1) Purchase channel: every sale records whether the buyer completed the deal
-- fully in-app (online) or physically at the office (in_office), so offline
-- exceptions can be tracked without skewing online reporting.
ALTER TABLE sales
  ADD COLUMN channel ENUM('online', 'in_office') NOT NULL DEFAULT 'online' AFTER payment_status;

-- 2) Camera-only anti-fraud rule (client directive 11a.3): property photos and
-- videos must be captured live through the app's camera. We store provenance on
-- each media row so the backend can enforce and later audit the constraint.
ALTER TABLE property_documents
  MODIFY COLUMN category ENUM('image', 'video', 'title_document', 'allocation_document', 'deed_of_assignment', 'other') NOT NULL DEFAULT 'other',
  ADD COLUMN capture_source VARCHAR(20) NULL AFTER file_size,
  ADD COLUMN captured_at DATETIME NULL AFTER capture_source,
  ADD COLUMN media_kind VARCHAR(10) NULL AFTER captured_at;

-- 3) Installment plans: a paid/active sale can be split into a schedule of
-- equal monthly installments. The plan belongs to the sale; payment of each
-- installment goes through the same Paystack split flow as the full price.
CREATE TABLE IF NOT EXISTS installment_plans (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  sale_id BIGINT UNSIGNED NOT NULL,
  estate_id BIGINT UNSIGNED NOT NULL,
  buyer_id BIGINT UNSIGNED NOT NULL,
  total_amount DECIMAL(15, 2) NOT NULL,
  installment_count INT NOT NULL,
  amount_per_installment DECIMAL(15, 2) NOT NULL,
  status ENUM('active', 'completed', 'cancelled') NOT NULL DEFAULT 'active',
  created_by BIGINT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY installment_plans_sale_index (sale_id),
  KEY installment_plans_estate_index (estate_id),
  CONSTRAINT installment_plans_sale_foreign
    FOREIGN KEY (sale_id) REFERENCES sales (id) ON DELETE CASCADE,
  CONSTRAINT installment_plans_estate_foreign
    FOREIGN KEY (estate_id) REFERENCES estates (id) ON DELETE CASCADE,
  CONSTRAINT installment_plans_buyer_foreign
    FOREIGN KEY (buyer_id) REFERENCES buyers (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS installments (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  plan_id BIGINT UNSIGNED NOT NULL,
  due_date DATE NOT NULL,
  amount DECIMAL(15, 2) NOT NULL,
  status ENUM('pending', 'paid', 'overdue', 'cancelled') NOT NULL DEFAULT 'pending',
  payment_transaction_id BIGINT UNSIGNED NULL,
  paid_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY installments_plan_index (plan_id),
  KEY installments_plan_status_index (plan_id, status),
  CONSTRAINT installments_plan_foreign
    FOREIGN KEY (plan_id) REFERENCES installment_plans (id) ON DELETE CASCADE,
  CONSTRAINT installments_payment_transaction_foreign
    FOREIGN KEY (payment_transaction_id) REFERENCES payment_transactions (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;