-- Stripe transactions registry: every payment link / pre-auth created via the admin panel
CREATE TABLE IF NOT EXISTS stripe_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    property_id UUID REFERENCES properties(id) ON DELETE CASCADE,
    booking_id UUID REFERENCES bookings(id) ON DELETE CASCADE,
    payment_intent_id TEXT,
    guest_name TEXT,
    guest_email TEXT,
    amount NUMERIC(10,2) NOT NULL,
    reason TEXT,
    capture_method TEXT NOT NULL DEFAULT 'automatic',
    status TEXT NOT NULL DEFAULT 'pending',
    payment_link TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    paid_at TIMESTAMP WITH TIME ZONE
);

ALTER TABLE stripe_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage organization stripe transactions" ON stripe_transactions
    FOR ALL USING (
        organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())
    );

CREATE INDEX IF NOT EXISTS stripe_transactions_organization_idx ON stripe_transactions (organization_id);
CREATE INDEX IF NOT EXISTS stripe_transactions_booking_idx ON stripe_transactions (booking_id);
CREATE INDEX IF NOT EXISTS stripe_transactions_pi_idx ON stripe_transactions (payment_intent_id);
