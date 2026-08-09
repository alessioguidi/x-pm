-- Codice cassetta di sicurezza (key locker) per self check-in
ALTER TABLE properties
ADD COLUMN IF NOT EXISTS key_locker_code TEXT;
