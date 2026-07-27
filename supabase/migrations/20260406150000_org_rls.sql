CREATE POLICY "Allow dev anon update" ON organizations FOR UPDATE USING (true) WITH CHECK (true);
