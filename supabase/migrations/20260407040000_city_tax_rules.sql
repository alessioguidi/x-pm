-- Add parametric city tax rules to properties table

ALTER TABLE properties
ADD COLUMN IF NOT EXISTS city_tax_max_nights INT DEFAULT 10,
ADD COLUMN IF NOT EXISTS city_tax_child_age INT DEFAULT 11;
