-- Add dashboard_layout JSONB column to profiles for per-user widget layout persistence
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS dashboard_layout JSONB DEFAULT NULL;
