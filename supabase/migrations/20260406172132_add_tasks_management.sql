-- 1. Create `activity_types` table
CREATE TABLE IF NOT EXISTS activity_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    color TEXT DEFAULT 'bg-gray-100 text-gray-800',
    is_system BOOLEAN DEFAULT FALSE
);

-- Turn on RLS for activity_types
ALTER TABLE activity_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their organization activity types"
    ON activity_types FOR SELECT
    USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can insert activity types"
    ON activity_types FOR INSERT
    WITH CHECK (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can update activity types"
    ON activity_types FOR UPDATE
    USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can delete non-system activity types"
    ON activity_types FOR DELETE
    USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()) AND is_system = FALSE);


-- 2. Create `tasks_log` table (we name it tasks_log to avoid reserved words if any)
CREATE TABLE IF NOT EXISTS tasks_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    
    activity_type_id UUID REFERENCES activity_types(id) ON DELETE CASCADE,
    property_id UUID REFERENCES properties(id) ON DELETE SET NULL,
    staff_member_id UUID REFERENCES staff_members(id) ON DELETE SET NULL,
    booking_id UUID REFERENCES bookings(id) ON DELETE CASCADE,
    
    virtual_id_reference TEXT, -- Ad es. "UUID-in" per non ricreare lo stesso check-in due volte
    
    scheduled_date DATE NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed')),
    completed_at TIMESTAMP WITH TIME ZONE,
    notes TEXT
);

-- Turn on RLS for tasks_log
ALTER TABLE tasks_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage organization tasks"
    ON tasks_log FOR ALL
    USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));

-- 3. Inserisci i 3 tipi di attività di sistema come predefiniti per chi ha un'organizzazione
DO $$
DECLARE
    org_id UUID;
BEGIN
    FOR org_id IN SELECT id FROM organizations LOOP
        INSERT INTO activity_types (organization_id, name, color, is_system)
        VALUES 
            (org_id, 'Check-in', 'bg-emerald-100 text-emerald-800 border-emerald-200', TRUE),
            (org_id, 'Check-out', 'bg-rose-100 text-rose-800 border-rose-200', TRUE),
            (org_id, 'Pulizie', 'bg-cyan-100 text-cyan-800 border-cyan-200', TRUE)
        ON CONFLICT DO NOTHING;
    END LOOP;
END $$;
