-- Campaign Analytics: track opens, clicks, aggregate stats

-- Add tracking columns to campaign_recipients
ALTER TABLE campaign_recipients ADD COLUMN IF NOT EXISTS opened_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE campaign_recipients ADD COLUMN IF NOT EXISTS clicked_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE campaign_recipients ADD COLUMN IF NOT EXISTS clicks_count INTEGER DEFAULT 0;

-- Add aggregate stats to campaigns
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS stats_sent INTEGER DEFAULT 0;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS stats_failed INTEGER DEFAULT 0;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS stats_opened INTEGER DEFAULT 0;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS stats_clicked INTEGER DEFAULT 0;
