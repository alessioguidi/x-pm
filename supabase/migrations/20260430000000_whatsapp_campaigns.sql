-- WhatsApp Campaigns support

-- Add channel column to campaigns (social = existing behavior, whatsapp = new)
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS channel TEXT DEFAULT 'social';

-- Create campaign_recipients table for WhatsApp contacts
CREATE TABLE IF NOT EXISTS campaign_recipients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE NOT NULL,
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  status TEXT DEFAULT 'pending',
  error_message TEXT DEFAULT NULL,
  sent_at TIMESTAMPTZ DEFAULT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_campaign_recipients_campaign ON campaign_recipients(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_recipients_status ON campaign_recipients(status);

-- RLS
ALTER TABLE campaign_recipients ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "campaign_recipients_select" ON campaign_recipients;
CREATE POLICY "campaign_recipients_select" ON campaign_recipients FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "campaign_recipients_insert" ON campaign_recipients;
CREATE POLICY "campaign_recipients_insert" ON campaign_recipients FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "campaign_recipients_update" ON campaign_recipients;
CREATE POLICY "campaign_recipients_update" ON campaign_recipients FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "campaign_recipients_delete" ON campaign_recipients;
CREATE POLICY "campaign_recipients_delete" ON campaign_recipients FOR DELETE TO authenticated USING (true);

-- Add Evolution API columns to organizations (per-org override)
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS evolution_api_url TEXT DEFAULT NULL;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS evolution_api_key TEXT DEFAULT NULL;
