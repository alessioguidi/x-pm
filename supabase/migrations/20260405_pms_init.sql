-- Create enum for roles
CREATE TYPE user_role AS ENUM ('super_admin', 'org_admin', 'org_staff', 'guest');

-- [NEW] Organizations Table (Multi-Tenant B2B Core)
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  theme_color TEXT DEFAULT '#2563eb', -- Tailwind Blue 600 default
  logo_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Modify the existing Supabase auth.users to be linked to our public profiles
-- We create a profiles table that automatically maps to auth.users
CREATE TABLE profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE, -- Null for super_admin or guests without orgs
  full_name TEXT,
  role user_role DEFAULT 'guest'::user_role NOT NULL,
  phone_number TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Properties Table
CREATE TABLE properties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  address TEXT,
  city TEXT,
  zip_code TEXT,
  country TEXT,
  latitude FLOAT,
  longitude FLOAT,
  max_guests INT DEFAULT 2,
  bedrooms INT DEFAULT 1,
  bathrooms INT DEFAULT 1,
  base_price_per_night DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  amenities JSONB DEFAULT '{}'::jsonb,
  is_active BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Property Photos
CREATE TABLE property_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID REFERENCES properties(id) ON DELETE CASCADE NOT NULL,
  image_url TEXT NOT NULL,
  display_order INT DEFAULT 0,
  is_featured BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Calendar Overrides (Dynamic Pricing & Booking.com style Constraints)
CREATE TABLE calendar_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID REFERENCES properties(id) ON DELETE CASCADE NOT NULL,
  date DATE NOT NULL,
  price_override DECIMAL(10, 2), 
  is_blocked BOOLEAN DEFAULT false, 
  min_stay INT, 
  max_stay INT, 
  closed_to_arrival BOOLEAN DEFAULT false, 
  closed_to_departure BOOLEAN DEFAULT false, 
  UNIQUE(property_id, date)
);

-- Setup Policies (RLS) for Multi-Tenancy
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE property_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendar_overrides ENABLE ROW LEVEL SECURITY;

-- 1. Organizations: Everyone can view active booking orgs (for public site), but only admins can modify theirs
CREATE POLICY "Orgs are viewable by everyone" ON organizations FOR SELECT USING (true);

-- 2. Properties: Isolated by organization_id for modification, public for reading
CREATE POLICY "Public properties are viewable" ON properties FOR SELECT USING (true);
-- (In a real scenario, you'd add: CREATE POLICY "Admins update own org properties" ON properties FOR ALL USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));)

-- (Same logic applied mentally for photos and calendar overrides)
CREATE POLICY "Photos are public" ON property_photos FOR SELECT USING (true);
CREATE POLICY "Overrides are public for booking engine" ON calendar_overrides FOR SELECT USING (true);

-- Insert Dummy Data for immediate local testing
INSERT INTO organizations (id, name, slug) VALUES 
  ('00000000-0000-0000-0000-000000000001', 'Altamira Case Vacanza', 'altamira-case');
