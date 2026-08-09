-- Codici identificativi struttura: CIR (regionale) e CIN (nazionale, obbligatorio dal 2025)
ALTER TABLE properties
ADD COLUMN IF NOT EXISTS cir TEXT,
ADD COLUMN IF NOT EXISTS cin TEXT;
