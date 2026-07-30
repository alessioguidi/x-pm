ALTER TABLE organizations ADD COLUMN IF NOT EXISTS cover_photos TEXT[] DEFAULT '{}'::TEXT[];
