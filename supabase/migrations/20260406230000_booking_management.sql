-- Aggiunge campi per l'app di messaggistica e staff task
ALTER TABLE organizations
ADD COLUMN IF NOT EXISTS template_booking_confirmed TEXT DEFAULT '<h3>Prenotazione Confermata</h3><p>Ciao {{guest_name}}, ti confermiamo la prenotazione dal {{check_in_date}} al {{check_out_date}}.</p>',
ADD COLUMN IF NOT EXISTS template_booking_cancelled TEXT DEFAULT '<h3>Prenotazione Annullata</h3><p>Ciao {{guest_name}}, la tua prenotazione è stata annullata.</p>',
ADD COLUMN IF NOT EXISTS smtp_config JSONB DEFAULT '{}'::jsonb;

ALTER TABLE bookings
ADD COLUMN IF NOT EXISTS checkin_staff_id UUID REFERENCES staff_members(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS checkout_staff_id UUID REFERENCES staff_members(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS cleaning_staff_id UUID REFERENCES staff_members(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS requires_linens BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS staff_notes TEXT;

CREATE TABLE IF NOT EXISTS booking_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id UUID REFERENCES bookings(id) ON DELETE CASCADE,
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    sender_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound', 'internal')),
    channel TEXT NOT NULL CHECK (channel IN ('internal', 'whatsapp', 'email', 'system')),
    content TEXT NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE booking_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org Admins can manage booking messages" ON booking_messages
FOR ALL TO authenticated
USING (
  organization_id IN (
    SELECT organization_id FROM profiles WHERE id = auth.uid()
  )
)
WITH CHECK (
  organization_id IN (
    SELECT organization_id FROM profiles WHERE id = auth.uid()
  )
);
