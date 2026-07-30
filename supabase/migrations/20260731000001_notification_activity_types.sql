-- Seed system activity types for notification/link tasks
DO $$
DECLARE
    org_id UUID;
BEGIN
    FOR org_id IN SELECT id FROM organizations LOOP
        INSERT INTO activity_types (organization_id, name, color, is_system)
        VALUES 
            (org_id, 'Invio Link Check-in', 'bg-violet-100 text-violet-800 border-violet-300', TRUE),
            (org_id, 'Invio Link Cauzione', 'bg-amber-100 text-amber-800 border-amber-300', TRUE),
            (org_id, 'Invio Link Check-out', 'bg-indigo-100 text-indigo-800 border-indigo-300', TRUE)
        ON CONFLICT DO NOTHING;
    END LOOP;
END $$;
