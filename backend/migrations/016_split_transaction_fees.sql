INSERT IGNORE INTO platform_settings (setting_key, setting_value) VALUES
  ('buyer_transaction_fee_percent', '2.20'),
  ('seller_commission_percent', '1.50');

-- Visitor access remains a flat ₦50 deduction; remove any earlier ₦20,000 value.
INSERT INTO platform_settings (setting_key, setting_value)
VALUES ('guest_pass_fee', '50.00')
ON DUPLICATE KEY UPDATE setting_value = '50.00';

ALTER TABLE payment_transactions
  ADD COLUMN base_amount DECIMAL(15, 2) NULL AFTER amount,
  ADD COLUMN buyer_fee_amount DECIMAL(15, 2) NOT NULL DEFAULT 0 AFTER base_amount,
  ADD COLUMN buyer_fee_percent DECIMAL(5, 2) NOT NULL DEFAULT 2.20 AFTER buyer_fee_amount,
  ADD COLUMN seller_commission_amount DECIMAL(15, 2) NOT NULL DEFAULT 0 AFTER commission_amount,
  ADD COLUMN seller_commission_percent DECIMAL(5, 2) NOT NULL DEFAULT 1.50 AFTER seller_commission_amount;

UPDATE payment_transactions
SET base_amount = amount,
    buyer_fee_amount = 0,
    buyer_fee_percent = 0,
    seller_commission_amount = commission_amount,
    seller_commission_percent = commission_percent
WHERE base_amount IS NULL;
