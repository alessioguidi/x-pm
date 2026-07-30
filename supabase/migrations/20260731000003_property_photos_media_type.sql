ALTER TABLE property_photos ADD COLUMN IF NOT EXISTS media_type TEXT DEFAULT 'image';
