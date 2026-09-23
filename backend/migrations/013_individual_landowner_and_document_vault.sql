ALTER TABLE estate_verification_applications
  ADD COLUMN applicant_type ENUM('estate_developer', 'individual_landowner') NOT NULL DEFAULT 'estate_developer' AFTER user_id,
  ADD COLUMN village_name VARCHAR(190) NULL AFTER estate_location,
  ADD COLUMN parties_involved TEXT NULL AFTER village_name,
  ADD COLUMN listing_price DECIMAL(15, 2) NULL AFTER parties_involved;

ALTER TABLE verification_documents
  MODIFY COLUMN category ENUM(
    'government_planning_approval',
    'land_title',
    'certificate_of_occupancy',
    'deed_of_assignment',
    'survey_plan',
    'estate_development_approval',
    'other_title_document',
    'purchase_receipt',
    'sworn_affidavit',
    'tax_receipt',
    'building_approval',
    'utility_bill',
    'chieftaincy_allocation_letter'
  ) NOT NULL;

ALTER TABLE property_documents
  MODIFY COLUMN category ENUM('image', 'title_document', 'allocation_document', 'deed_of_assignment', 'other') NOT NULL DEFAULT 'other';
