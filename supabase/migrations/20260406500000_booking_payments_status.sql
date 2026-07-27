-- Estensione dei pagamenti: Scheduled Payments & Staff Assignment

ALTER TABLE booking_payments 
ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'completed';

ALTER TABLE booking_payments 
ADD COLUMN IF NOT EXISTS staff_member_id UUID REFERENCES staff_members(id) ON DELETE SET NULL;

COMMENT ON COLUMN booking_payments.status IS 'Stato del pagamento: scheduled (= da incassare) oppure completed';
COMMENT ON COLUMN booking_payments.staff_member_id IS 'Membro dello staff assegnato al recupero/incasso di questo pagamento (es. check-in)';
