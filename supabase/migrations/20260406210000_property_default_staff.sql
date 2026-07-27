-- Aggiunta delle mansioni di default agli Immobili

ALTER TABLE properties
ADD COLUMN IF NOT EXISTS default_checkin_staff_id UUID REFERENCES staff_members(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS default_checkout_staff_id UUID REFERENCES staff_members(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS default_cleaning_staff_id UUID REFERENCES staff_members(id) ON DELETE SET NULL;
