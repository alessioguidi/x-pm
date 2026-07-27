-- Aggiunta percentuale caparra sull'immobile (deposit_percentage)

ALTER TABLE properties 
ADD COLUMN IF NOT EXISTS deposit_percentage NUMERIC(5, 2) DEFAULT 0;

COMMENT ON COLUMN properties.deposit_percentage IS 'Percentuale del valore del soggiorno da richiedere come caparra anticipata (es. 30 per 30%)';
