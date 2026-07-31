ALTER TABLE properties
  ADD COLUMN IF NOT EXISTS guide_restaurants JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS guide_attractions JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS guide_notes TEXT,
  ADD COLUMN IF NOT EXISTS useful_numbers JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS portal_expires_days INT DEFAULT 7;
