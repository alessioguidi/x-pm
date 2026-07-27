-- RLS Dev Patch per modulo Staff e Ledger per sviluppo in locale/demo

-- Staff Members
DROP POLICY IF EXISTS "Allow dev anon insert" ON staff_members;
DROP POLICY IF EXISTS "Allow dev anon update" ON staff_members;
DROP POLICY IF EXISTS "Allow dev anon delete" ON staff_members;

CREATE POLICY "Allow dev anon insert" ON staff_members FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow dev anon update" ON staff_members FOR UPDATE USING (true);
CREATE POLICY "Allow dev anon delete" ON staff_members FOR DELETE USING (true);

-- Cash Transactions
DROP POLICY IF EXISTS "Allow dev anon insert" ON cash_transactions;
DROP POLICY IF EXISTS "Allow dev anon update" ON cash_transactions;
DROP POLICY IF EXISTS "Allow dev anon delete" ON cash_transactions;

CREATE POLICY "Allow dev anon insert" ON cash_transactions FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow dev anon update" ON cash_transactions FOR UPDATE USING (true);
CREATE POLICY "Allow dev anon delete" ON cash_transactions FOR DELETE USING (true);
