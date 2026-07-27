ALTER TABLE public.organizations 
ADD COLUMN IF NOT EXISTS allowed_payment_methods JSONB DEFAULT '["Contante all''arrivo", "Bonifico anticipato", "Bonifico Istantaneo in loco", "Pos / Carta di Credito in loco"]'::jsonb;
