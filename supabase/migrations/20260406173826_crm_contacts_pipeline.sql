-- 1. Create Contacts Table
CREATE TABLE IF NOT EXISTS contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    
    first_name TEXT NOT NULL,
    last_name TEXT,
    email TEXT,
    phone TEXT,
    
    country TEXT,
    city TEXT,
    language TEXT,
    
    source TEXT DEFAULT 'manual', -- manual, booking_engine, facebook, etc.
    notes TEXT,

    UNIQUE(organization_id, email)
);

-- RLS for Contacts
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage organization contacts"
    ON contacts FOR ALL
    USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));

-- 2. Modify Bookings Table for CRM & Pipeline Setup
ALTER TABLE bookings ADD COLUMN contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL;

-- Relax Booking Constraints so it can act as a Lead/Opportunity
ALTER TABLE bookings ALTER COLUMN property_id DROP NOT NULL;
ALTER TABLE bookings ALTER COLUMN check_in_date DROP NOT NULL;
ALTER TABLE bookings ALTER COLUMN check_out_date DROP NOT NULL;
ALTER TABLE bookings ALTER COLUMN nights DROP NOT NULL;
ALTER TABLE bookings ALTER COLUMN total_price DROP NOT NULL;

-- Add a column to track Expected Probability (Optional for Pipeline)
ALTER TABLE bookings ADD COLUMN win_probability INT DEFAULT 10;

-- 3. Data Migration: Extract unique contacts from existing bookings
-- Note: existing bookings have `guest_name`, `guest_email`, `guest_phone`

-- Insert Contacts
INSERT INTO contacts (organization_id, first_name, email, phone, source)
SELECT DISTINCT 
    organization_id,
    guest_name, -- Putting full name in first_name for legacy
    guest_email,
    guest_phone,
    'legacy_booking'
FROM bookings
WHERE guest_email IS NOT NULL AND guest_email != ''
ON CONFLICT (organization_id, email) DO NOTHING;

-- Link Bookings to Contacts
UPDATE bookings b
SET contact_id = c.id
FROM contacts c
WHERE b.guest_email = c.email AND b.organization_id = c.organization_id;

-- 4. Pipeline Statuses
-- We don't have an ENUM type, `status` is TEXT. 
-- Old statuses: 'pending', 'confirmed', 'cancelled'
-- New (Pipeline) statuses: 'lead_new', 'lead_qualified', 'quote_sent', 'negotiation', 'closed_lost'
