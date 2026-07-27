-- Colonne mancanti per la tabella campaigns
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS platform TEXT DEFAULT 'both';
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS auto_availability BOOLEAN DEFAULT false;
