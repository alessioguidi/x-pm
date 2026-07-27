CREATE OR REPLACE FUNCTION sync_booking_contact_id()
RETURNS TRIGGER AS $$
DECLARE
    found_contact_id UUID;
    split_name text[];
    f_name text;
    l_name text;
BEGIN
    -- Only act if contact_id is missing and guest email is present and not 'N/A'
    IF NEW.contact_id IS NULL AND (NEW.guest_email IS NOT NULL AND NEW.guest_email != 'N/A' AND NEW.guest_email != '') THEN
        -- Check if contact exists by email
        SELECT id INTO found_contact_id 
        FROM contacts 
        WHERE email = NEW.guest_email AND organization_id = NEW.organization_id 
        LIMIT 1;
        
        IF found_contact_id IS NOT NULL THEN
            NEW.contact_id := found_contact_id;
        ELSE
            -- Try to split name into first and last name for the CRM contact card
            split_name := regexp_split_to_array(trim(COALESCE(NEW.guest_name, 'Ospite')), '\s+');
            f_name := split_name[1];
            IF array_length(split_name, 1) > 1 THEN
                l_name := array_to_string(split_name[2:array_length(split_name, 1)], ' ');
            ELSE
                l_name := '';
            END IF;

            -- Create new contact in CRM
            INSERT INTO contacts (organization_id, first_name, last_name, email, phone)
            VALUES (
                NEW.organization_id, 
                f_name, 
                l_name, 
                NEW.guest_email, 
                CASE WHEN NEW.guest_phone = 'N/A' THEN NULL ELSE NEW.guest_phone END
            )
            RETURNING id INTO found_contact_id;
            
            NEW.contact_id := found_contact_id;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_sync_booking_contact_id ON bookings;
CREATE TRIGGER trigger_sync_booking_contact_id
BEFORE INSERT OR UPDATE ON bookings
FOR EACH ROW
EXECUTE FUNCTION sync_booking_contact_id();
