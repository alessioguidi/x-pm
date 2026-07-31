ALTER TABLE properties ADD COLUMN IF NOT EXISTS notification_emails TEXT[] DEFAULT '{}'::text[];
