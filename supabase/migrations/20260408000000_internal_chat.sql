-- Chat interna staff
CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  name TEXT,
  is_group BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  last_message_at TIMESTAMP WITH TIME ZONE,
  last_message_preview TEXT
);

CREATE TABLE IF NOT EXISTS conversation_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE NOT NULL,
  profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  unread_count INT DEFAULT 0,
  last_read_at TIMESTAMP WITH TIME ZONE,
  UNIQUE(conversation_id, profile_id)
);

CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE NOT NULL,
  sender_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  content TEXT,
  message_type TEXT DEFAULT 'text'::text,
  media_url TEXT,
  media_size INT,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- Policies per conversations
CREATE POLICY "Org members can view own org conversations"
  ON conversations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM conversation_participants cp
      JOIN profiles p ON cp.profile_id = p.id
      WHERE cp.conversation_id = conversations.id
      AND p.id = auth.uid()
    )
  );

CREATE POLICY "Org members can create conversations"
  ON conversations FOR INSERT
  WITH CHECK (organization_id IN (
    SELECT organization_id FROM profiles WHERE id = auth.uid()
  ));

CREATE POLICY "Participants can update conversations"
  ON conversations FOR UPDATE
  USING (organization_id IN (
    SELECT organization_id FROM profiles WHERE id = auth.uid()
  ));

-- Policies per conversation_participants
CREATE POLICY "Staff can view their participation"
  ON conversation_participants FOR SELECT
  USING (profile_id = auth.uid());

CREATE POLICY "Staff can join conversations"
  ON conversation_participants FOR INSERT
  WITH CHECK (profile_id = auth.uid());

-- Policies per chat_messages
CREATE POLICY "Conversation participants can view messages"
  ON chat_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM conversation_participants cp
      WHERE cp.conversation_id = chat_messages.conversation_id
      AND cp.profile_id = auth.uid()
    )
  );

CREATE POLICY "Participants can send messages"
  ON chat_messages FOR INSERT
  WITH CHECK (
    sender_id = auth.uid()
    AND conversation_id IN (
      SELECT conversation_id FROM conversation_participants WHERE profile_id = auth.uid()
    )
  );

-- Trigger per aggiornare updated_at e last_message
CREATE OR REPLACE FUNCTION update_conversation_on_message()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE conversations
  SET
    updated_at = NOW(),
    last_message_at = NEW.created_at,
    last_message_preview = CASE WHEN NEW.content IS NOT NULL THEN LEFT(NEW.content, 100) ELSE '[media]' END
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_conversation ON chat_messages;
CREATE TRIGGER trigger_update_conversation
AFTER INSERT ON chat_messages
FOR EACH ROW EXECUTE FUNCTION update_conversation_on_message();

-- Trigger per unread count
CREATE OR REPLACE FUNCTION increment_unread_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE conversation_participants
  SET unread_count = unread_count + 1
  WHERE conversation_id = NEW.conversation_id
  AND profile_id != NEW.sender_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_increment_unread ON chat_messages;
CREATE TRIGGER trigger_increment_unread
AFTER INSERT ON chat_messages
FOR EACH ROW EXECUTE FUNCTION increment_unread_count();

-- Inizializza conversazione org per ogni nuova organizzazione
CREATE OR REPLACE FUNCTION create_org_conversation()
RETURNS TRIGGER AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM conversations WHERE organization_id = NEW.id) THEN
    INSERT INTO conversations (organization_id)
    VALUES (NEW.id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_create_org_conversation ON organizations;
CREATE TRIGGER trigger_create_org_conversation
AFTER INSERT ON organizations
FOR EACH ROW EXECUTE FUNCTION create_org_conversation();