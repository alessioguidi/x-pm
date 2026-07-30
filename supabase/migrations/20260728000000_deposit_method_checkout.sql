-- Add deposit method and checkout checklist to properties
ALTER TABLE properties ADD COLUMN IF NOT EXISTS deposit_method TEXT NOT NULL DEFAULT 'cash';
ALTER TABLE properties ADD COLUMN IF NOT EXISTS checkout_checklist JSONB NOT NULL DEFAULT '[]'::jsonb;

-- Add stripe deposit tracking to bookings
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS deposit_status TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS stripe_payment_intent_id TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS checkout_video_url TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS checkout_submitted_at TIMESTAMPTZ;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS checkout_checklist JSONB;
