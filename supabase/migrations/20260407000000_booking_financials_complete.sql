-- Migration: booking_financials_complete
-- Aggiunge tutte le voci finanziarie sulle prenotazioni e i default sulle properties

-- === PROPERTIES ===
ALTER TABLE properties ADD COLUMN IF NOT EXISTS city_tax_per_night NUMERIC(10,2) DEFAULT 2.00;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS pet_fee NUMERIC(10,2) DEFAULT 0;

-- === BOOKINGS ===
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS adults_count INTEGER DEFAULT 1;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS children_count INTEGER DEFAULT 0;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS pets_count INTEGER DEFAULT 0;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS base_price NUMERIC(10,2) DEFAULT 0;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS cleaning_fee NUMERIC(10,2) DEFAULT 0;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS pet_fee NUMERIC(10,2) DEFAULT 0;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS city_tax NUMERIC(10,2) DEFAULT 0;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS security_deposit NUMERIC(10,2) DEFAULT 0;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS down_payment NUMERIC(10,2) DEFAULT 0;

-- Migra vecchio campo
UPDATE bookings 
SET security_deposit = security_deposit_amount 
WHERE security_deposit_amount > 0 AND security_deposit = 0;

-- Migra guests_count → adults_count
UPDATE bookings 
SET adults_count = guests_count 
WHERE adults_count = 1 AND guests_count IS NOT NULL AND guests_count > 1;

COMMENT ON COLUMN properties.city_tax_per_night IS 'Tassa di soggiorno comunale (€/notte/adulto). Max 10 notti. Solo per >= 12 anni.';
COMMENT ON COLUMN bookings.city_tax IS 'Tassa soggiorno calcolata: city_tax_per_night * min(nights,10) * adults_count. Modificabile.';
COMMENT ON COLUMN bookings.security_deposit IS 'Cauzione danni: incassata in contanti all arrivo, restituita al checkout.';
COMMENT ON COLUMN bookings.down_payment IS 'Caparra anticipata: calcolata come % del totale soggiorno.';
