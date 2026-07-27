-- Patch per consentire la manipolazione dei Profili Utente (RLS bypass limitato per dev)

DROP POLICY IF EXISTS "Allow users to read profiles" ON profiles;
DROP POLICY IF EXISTS "Allow users to update own profiles" ON profiles;
DROP POLICY IF EXISTS "Allow users to insert own profiles" ON profiles;

CREATE POLICY "Allow test anon select" ON profiles FOR SELECT USING (true);
CREATE POLICY "Allow test anon insert" ON profiles FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow test anon update" ON profiles FOR UPDATE USING (true);
