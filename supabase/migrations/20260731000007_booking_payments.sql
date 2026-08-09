-- Prima Nota pagamenti del cliente per prenotazione (caparra, cauzione, pulizie, tassa di soggiorno, saldi...)
CREATE TABLE IF NOT EXISTS booking_payments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    booking_id UUID REFERENCES bookings(id) ON DELETE CASCADE,
    amount NUMERIC(10, 2) NOT NULL,
    payment_method TEXT NOT NULL,
    reason TEXT NOT NULL,
    date TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    notes TEXT,
    status VARCHAR(50) DEFAULT 'scheduled',
    staff_member_id UUID REFERENCES staff_members(id) ON DELETE SET NULL
);

COMMENT ON COLUMN booking_payments.status IS 'Stato del pagamento: scheduled (= da incassare) oppure completed';

ALTER TABLE booking_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage booking payments" ON booking_payments
    FOR ALL USING (booking_id IN (
        SELECT id FROM bookings WHERE organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())
    ));

-- Backfill: crea le voci programmate per le prenotazioni esistenti
INSERT INTO booking_payments (booking_id, amount, payment_method, reason, date, notes, status)
SELECT b.id, b.down_payment, 'Bonifico', 'Caparra', COALESCE(b.deposit_date, b.created_at), 'Caparra da versare anticipatamente', 'scheduled'
FROM bookings b
WHERE b.down_payment > 0
  AND COALESCE(b.deposit_paid, false) = false
  AND NOT EXISTS (SELECT 1 FROM booking_payments p WHERE p.booking_id = b.id AND p.reason = 'Caparra' AND p.status = 'scheduled');

INSERT INTO booking_payments (booking_id, amount, payment_method, reason, date, notes, status)
SELECT b.id, b.security_deposit, 'Contante', 'Cauzione Danni', b.check_in_date, 'Cauzione danni - cash all''arrivo', 'scheduled'
FROM bookings b
JOIN properties pr ON pr.id = b.property_id
WHERE b.security_deposit > 0
  AND COALESCE(pr.deposit_method, 'cash') <> 'stripe'
  AND NOT EXISTS (SELECT 1 FROM booking_payments p WHERE p.booking_id = b.id AND p.reason = 'Cauzione Danni' AND p.status = 'scheduled');

INSERT INTO booking_payments (booking_id, amount, payment_method, reason, date, notes, status)
SELECT b.id, b.city_tax, 'Contante', 'Tassa Soggiorno', b.check_in_date, 'Tassa di soggiorno', 'scheduled'
FROM bookings b
WHERE b.city_tax > 0
  AND NOT EXISTS (SELECT 1 FROM booking_payments p WHERE p.booking_id = b.id AND p.reason = 'Tassa Soggiorno' AND p.status = 'scheduled');

INSERT INTO booking_payments (booking_id, amount, payment_method, reason, date, notes, status)
SELECT b.id, b.cleaning_fee, 'Contante', 'Pulizie', b.check_in_date, 'Spese pulizie', 'scheduled'
FROM bookings b
WHERE b.cleaning_fee > 0
  AND NOT EXISTS (SELECT 1 FROM booking_payments p WHERE p.booking_id = b.id AND p.reason = 'Pulizie' AND p.status = 'scheduled');
