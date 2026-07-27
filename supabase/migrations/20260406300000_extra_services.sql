-- Aggiunta supporto tariffario dei servizi extra flessibili

ALTER TABLE properties 
ADD COLUMN IF NOT EXISTS extra_services jsonb DEFAULT '[]'::jsonb;

ALTER TABLE bookings 
ADD COLUMN IF NOT EXISTS extra_services jsonb DEFAULT '[]'::jsonb;

-- Assicuriamoci che l'admin ne abbia i permessi lato DB (opzionale, ma default è già così)
COMMENT ON COLUMN properties.extra_services IS 'Tariffario e Catalogo servizi extra. Formato: [{ "name": "Kit", "price": 10 }]';

COMMENT ON COLUMN bookings.extra_services IS 'Servizi extra scelti per questa prenotazione. Formato includerà anche qta e total';

-- Creazione tabella per la Prima Nota dei rimesse/pagamenti cliente
CREATE TABLE IF NOT EXISTS booking_payments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    booking_id UUID REFERENCES bookings(id) ON DELETE CASCADE,
    amount NUMERIC(10, 2) NOT NULL,
    payment_method TEXT NOT NULL, -- Bonifico, Carta di Credito, POS, Contanti
    reason TEXT NOT NULL, -- Caparra, Saldo, Servizi Extra, Altro
    date TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    notes TEXT
);

ALTER TABLE booking_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage booking payments" ON booking_payments
    FOR ALL USING (booking_id IN (
        SELECT id FROM bookings WHERE organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())
    ));

