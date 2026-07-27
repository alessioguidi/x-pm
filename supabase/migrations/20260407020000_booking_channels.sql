-- ============================================================
-- Portali di prenotazione con commissioni e cedolare secca
-- ============================================================

-- Tabella canali/portali per organizzazione
CREATE TABLE IF NOT EXISTS booking_channels (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  commission_pct  NUMERIC(5,2) DEFAULT 0,   -- % commissione portale (es. 25)
  tax_pct         NUMERIC(5,2) DEFAULT 0,   -- % cedolare secca (es. 26)
  is_active       BOOLEAN DEFAULT true,
  created_at      TIMESTAMPTZ DEFAULT now()
);

-- Campi sulla prenotazione
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS channel_id        UUID REFERENCES booking_channels(id),
  ADD COLUMN IF NOT EXISTS commission_amount NUMERIC(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tax_amount        NUMERIC(10,2) DEFAULT 0;

-- Aggiungo tipi e date alle tabelle finanziarie
ALTER TABLE booking_payments
  ADD COLUMN IF NOT EXISTS payment_date DATE;

ALTER TABLE cash_transactions
  ADD COLUMN IF NOT EXISTS transaction_type TEXT;

-- Indice per ricerche per organizzazione
CREATE INDEX IF NOT EXISTS idx_booking_channels_org ON booking_channels(organization_id);
