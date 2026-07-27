-- Marketing Campaigns for scheduled social media posts

CREATE TABLE IF NOT EXISTS campaigns (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  property_id     UUID REFERENCES properties(id) ON DELETE SET NULL,
  name            TEXT NOT NULL,
  description     TEXT DEFAULT '',
  text_content    TEXT DEFAULT '',
  media_urls      JSONB DEFAULT '[]',
  recurrence      TEXT NOT NULL DEFAULT 'weekly',
  day_of_week     INT DEFAULT NULL,
  day_of_month    INT DEFAULT NULL,
  time_of_day     TIME NOT NULL DEFAULT '21:00',
  start_date      DATE NOT NULL,
  end_date        DATE NOT NULL,
  is_active       BOOLEAN DEFAULT true,
  created_by      UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS campaign_posts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id     UUID REFERENCES campaigns(id) ON DELETE CASCADE,
  text_content    TEXT DEFAULT '',
  media_urls      JSONB DEFAULT '[]',
  scheduled_at    TIMESTAMPTZ NOT NULL,
  published_at    TIMESTAMPTZ DEFAULT NULL,
  status          TEXT DEFAULT 'scheduled',
  platform        TEXT DEFAULT 'both',
  platform_ids    JSONB DEFAULT '{}',
  error_message   TEXT DEFAULT NULL,
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_campaigns_org ON campaigns(organization_id);
CREATE INDEX IF NOT EXISTS idx_campaign_posts_campaign ON campaign_posts(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_posts_scheduled ON campaign_posts(status, scheduled_at);

-- Add property_id if table already exists
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS property_id UUID REFERENCES properties(id) ON DELETE SET NULL;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS auto_availability BOOLEAN DEFAULT false;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS platform TEXT DEFAULT 'both';

-- RLS policies
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_posts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "campaigns_select" ON campaigns;
CREATE POLICY "campaigns_select" ON campaigns FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "campaigns_insert" ON campaigns;
CREATE POLICY "campaigns_insert" ON campaigns FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "campaigns_update" ON campaigns;
CREATE POLICY "campaigns_update" ON campaigns FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "campaigns_delete" ON campaigns;
CREATE POLICY "campaigns_delete" ON campaigns FOR DELETE TO authenticated USING (true);

DROP POLICY IF EXISTS "campaign_posts_select" ON campaign_posts;
CREATE POLICY "campaign_posts_select" ON campaign_posts FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "campaign_posts_insert" ON campaign_posts;
CREATE POLICY "campaign_posts_insert" ON campaign_posts FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "campaign_posts_update" ON campaign_posts;
CREATE POLICY "campaign_posts_update" ON campaign_posts FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "campaign_posts_delete" ON campaign_posts;
CREATE POLICY "campaign_posts_delete" ON campaign_posts FOR DELETE TO authenticated USING (true);

-- Storage bucket for campaign media
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('campaign_media', 'campaign_media', true, 10485760, '{image/jpeg,image/png,image/webp,image/gif,video/mp4}')
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "campaign_media_select" ON storage.objects;
CREATE POLICY "campaign_media_select" ON storage.objects FOR SELECT USING (bucket_id = 'campaign_media');
DROP POLICY IF EXISTS "campaign_media_insert" ON storage.objects;
CREATE POLICY "campaign_media_insert" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'campaign_media');

-- Add social media token columns to organizations
ALTER TABLE organizations
ADD COLUMN IF NOT EXISTS facebook_page_token TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS facebook_user_token TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS instagram_account_id TEXT DEFAULT NULL;
