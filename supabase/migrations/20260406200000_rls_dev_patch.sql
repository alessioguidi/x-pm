-- Rendiamo lo script idempotente per evitare errori Supabase se le policy esistono già

-- Proprietà
DROP POLICY IF EXISTS "Allow dev anon insert" ON properties;
DROP POLICY IF EXISTS "Allow dev anon update" ON properties;
DROP POLICY IF EXISTS "Allow dev anon delete" ON properties;

CREATE POLICY "Allow dev anon insert" ON properties FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow dev anon update" ON properties FOR UPDATE USING (true);
CREATE POLICY "Allow dev anon delete" ON properties FOR DELETE USING (true);

-- Foto
DROP POLICY IF EXISTS "Allow dev anon insert" ON property_photos;
DROP POLICY IF EXISTS "Allow dev anon update" ON property_photos;
DROP POLICY IF EXISTS "Allow dev anon delete" ON property_photos;

CREATE POLICY "Allow dev anon insert" ON property_photos FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow dev anon update" ON property_photos FOR UPDATE USING (true);
CREATE POLICY "Allow dev anon delete" ON property_photos FOR DELETE USING (true);

-- Calendari / Vincoli
DROP POLICY IF EXISTS "Allow dev anon insert" ON calendar_overrides;
DROP POLICY IF EXISTS "Allow dev anon update" ON calendar_overrides;
DROP POLICY IF EXISTS "Allow dev anon delete" ON calendar_overrides;

CREATE POLICY "Allow dev anon insert" ON calendar_overrides FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow dev anon update" ON calendar_overrides FOR UPDATE USING (true);
CREATE POLICY "Allow dev anon delete" ON calendar_overrides FOR DELETE USING (true);
