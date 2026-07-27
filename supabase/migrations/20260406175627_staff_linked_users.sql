ALTER TABLE staff_members
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES profiles(id) ON DELETE SET NULL UNIQUE;

-- Create a helper function safely mapping an auth user to a staff resource.
CREATE OR REPLACE FUNCTION ensure_staff_for_user()
RETURNS TRIGGER AS $$
BEGIN
    -- Only for admin or managers making a profile
    IF NEW.role IN ('super_admin', 'org_admin', 'org_staff') THEN
        INSERT INTO staff_members (organization_id, name, role, user_id)
        VALUES (NEW.organization_id, NEW.full_name, NEW.role::text, NEW.id)
        ON CONFLICT (user_id) DO UPDATE SET name = EXCLUDED.name, role = EXCLUDED.role;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger su profiles per allineare chi entra
DROP TRIGGER IF EXISTS trigger_ensure_staff_for_user ON profiles;
CREATE TRIGGER trigger_ensure_staff_for_user
AFTER INSERT OR UPDATE OF full_name, role ON profiles
FOR EACH ROW
EXECUTE FUNCTION ensure_staff_for_user();

-- Trigger retroattivo rapido per agganciare chi esiste
INSERT INTO staff_members (organization_id, name, role, user_id)
SELECT organization_id, full_name, role::text, id
FROM profiles
WHERE role IN ('super_admin', 'org_admin', 'org_staff')
ON CONFLICT (user_id) DO NOTHING;
