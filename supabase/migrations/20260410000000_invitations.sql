-- Tabella per gestire inviti utenti
CREATE TABLE IF NOT EXISTS invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  name TEXT,
  role TEXT DEFAULT 'org_staff',
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  invited_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  token TEXT UNIQUE NOT NULL,
  status TEXT DEFAULT 'pending',
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view invitation by token" ON invitations;
CREATE POLICY "Anyone can view invitation by token"
  ON invitations FOR SELECT
  USING (token IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated can insert invitations" ON invitations;
CREATE POLICY "Authenticated can insert invitations"
  ON invitations FOR INSERT
  TO authenticated
  WITH CHECK (true);