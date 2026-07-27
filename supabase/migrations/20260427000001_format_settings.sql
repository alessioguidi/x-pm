-- Add per-organization format settings
ALTER TABLE organizations
ADD COLUMN IF NOT EXISTS number_format TEXT DEFAULT 'it-IT',
ADD COLUMN IF NOT EXISTS date_format TEXT DEFAULT 'DD/MM/YYYY',
ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'EUR';
