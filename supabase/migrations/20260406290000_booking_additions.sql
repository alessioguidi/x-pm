ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS security_deposit_amount NUMERIC(10, 2) DEFAULT 0;
