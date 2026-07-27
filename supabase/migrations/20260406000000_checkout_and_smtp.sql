-- Add SMTP configuration to organizations
ALTER TABLE organizations ADD COLUMN smtp_host TEXT;
ALTER TABLE organizations ADD COLUMN smtp_port INT DEFAULT 465;
ALTER TABLE organizations ADD COLUMN smtp_user TEXT;
ALTER TABLE organizations ADD COLUMN smtp_pass TEXT;
ALTER TABLE organizations ADD COLUMN smtp_from_email TEXT;

-- Create Bookings Table
CREATE TABLE bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  property_id UUID REFERENCES properties(id) ON DELETE CASCADE NOT NULL,
  guest_id UUID REFERENCES auth.users(id) ON DELETE SET NULL, -- Can be null if we fail to map, but ideally linked to the created auth user
  guest_name TEXT NOT NULL,
  guest_email TEXT NOT NULL,
  guest_phone TEXT,
  check_in_date DATE NOT NULL,
  check_out_date DATE NOT NULL,
  nights INT NOT NULL,
  guests_count INT DEFAULT 1,
  pets_count INT DEFAULT 0,
  total_price DECIMAL(10, 2) NOT NULL,
  status TEXT DEFAULT 'pending' NOT NULL, -- pending, confirmed, cancelled
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- RLS per bookings
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;

-- Admins can see their organization's bookings
CREATE POLICY "Admins view own org bookings" ON bookings 
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid() AND role IN ('org_admin', 'super_admin')
    )
  );

-- Guests can view their own bookings
CREATE POLICY "Guests view own bookings" ON bookings 
  FOR SELECT USING (
    guest_id = auth.uid()
  );

-- Anyone can insert a booking (since guests might be newly created or unauthenticated at the moment of submission)
-- In a real app we might restrict this via the API route using service_role, but for ease:
CREATE POLICY "Anyone can insert booking" ON bookings 
  FOR INSERT WITH CHECK (true);

-- Admins can update their organization's bookings
CREATE POLICY "Admins update own org bookings" ON bookings 
  FOR UPDATE USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid() AND role IN ('org_admin', 'super_admin')
    )
  );
