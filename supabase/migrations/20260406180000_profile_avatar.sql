-- Aggiunta campi mancanti per il sistema Billing e Profile Avatar (Fase 16)

ALTER TABLE organizations 
ADD COLUMN IF NOT EXISTS plan TEXT DEFAULT 'premium';

ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS avatar_url TEXT;
