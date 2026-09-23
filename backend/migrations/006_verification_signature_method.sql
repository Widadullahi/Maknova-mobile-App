ALTER TABLE estate_verification_applications
  ADD COLUMN signature_method ENUM('typed', 'drawn') NOT NULL DEFAULT 'typed' AFTER signature_text,
  ADD COLUMN signature_data LONGTEXT NULL AFTER signature_method;
