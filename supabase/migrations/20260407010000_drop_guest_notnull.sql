-- Rimuove i vincoli NOT NULL dai campi flat legacy di bookings
-- I dati anagrafici ora vivono in contacts via contact_id FK
-- I campi guest_name/email/phone vengono mantenuti per retrocompatibilità ma non sono più obbligatori

ALTER TABLE bookings ALTER COLUMN guest_email DROP NOT NULL;
ALTER TABLE bookings ALTER COLUMN guest_name DROP NOT NULL;
ALTER TABLE bookings ALTER COLUMN guest_phone DROP NOT NULL;
