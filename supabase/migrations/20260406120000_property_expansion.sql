ALTER TABLE properties 
ADD COLUMN house_rules JSONB DEFAULT '{}'::jsonb,
ADD COLUMN safety_features JSONB DEFAULT '{}'::jsonb,
ADD COLUMN cancellation_policy TEXT,
ADD COLUMN check_in_instructions TEXT,
ADD COLUMN check_in_method TEXT,
ADD COLUMN wifi_info JSONB DEFAULT '{}'::jsonb,
ADD COLUMN house_manual TEXT;
