-- Migration: Modulo Staff, Tasks e Cash Ledger

CREATE TABLE IF NOT EXISTS staff_members (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'cleaner', -- cleaner, reception, maintenance
    magic_token UUID UNIQUE DEFAULT gen_random_uuid(),
    phone_number TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE staff_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their organization staff" ON staff_members
    FOR SELECT USING (organization_id IN (
        SELECT organization_id FROM profiles WHERE id = auth.uid()
    ));

CREATE POLICY "Users can manage their organization staff" ON staff_members
    FOR ALL USING (organization_id IN (
        SELECT organization_id FROM profiles WHERE id = auth.uid()
    ));


CREATE TABLE IF NOT EXISTS tasks (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    property_id UUID REFERENCES properties(id) ON DELETE CASCADE,
    staff_member_id UUID REFERENCES staff_members(id) ON DELETE SET NULL,
    task_date DATE NOT NULL,
    task_type TEXT NOT NULL, -- cleaning, checkin, checkout, maintenance
    status TEXT NOT NULL DEFAULT 'pending', -- pending, completed, issue
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage organization tasks" ON tasks
    FOR ALL USING (organization_id IN (
        SELECT organization_id FROM profiles WHERE id = auth.uid()
    ));


CREATE TABLE IF NOT EXISTS cash_transactions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    property_id UUID REFERENCES properties(id) ON DELETE CASCADE,
    staff_member_id UUID REFERENCES staff_members(id) ON DELETE CASCADE,
    amount NUMERIC(10, 2) NOT NULL,
    transaction_type TEXT NOT NULL, -- deposit_collection, stay_balance, expense, deposit_return, manager_handover
    status TEXT NOT NULL DEFAULT 'pending', -- pending (da accettare da parte dello staff), confirmed
    category TEXT, -- toilet_paper, fruit, damage_retention, generic
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE cash_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage organization transactions" ON cash_transactions
    FOR ALL USING (organization_id IN (
        SELECT organization_id FROM profiles WHERE id = auth.uid()
    ));

-- Create policy for public access where the staff token matches
-- As staff are unauthenticated guests hitting a specific URL with their token
-- we must allow them to READ/UPDATE tasks and transactions assigned to them
CREATE POLICY "Staff can view their own profile based on token" ON staff_members
    FOR SELECT USING (
        magic_token::text = current_setting('request.headers', true)::json->>'x-magic-token'
    );

CREATE POLICY "Staff can view their own tasks based on token" ON tasks
    FOR SELECT USING (
        staff_member_id IN (SELECT id FROM staff_members WHERE magic_token::text = current_setting('request.headers', true)::json->>'x-magic-token')
    );

CREATE POLICY "Staff can update their own tasks based on token" ON tasks
    FOR UPDATE USING (
        staff_member_id IN (SELECT id FROM staff_members WHERE magic_token::text = current_setting('request.headers', true)::json->>'x-magic-token')
    );

CREATE POLICY "Staff can view their own transactions based on token" ON cash_transactions
    FOR SELECT USING (
        staff_member_id IN (SELECT id FROM staff_members WHERE magic_token::text = current_setting('request.headers', true)::json->>'x-magic-token')
    );

CREATE POLICY "Staff can insert their own transactions based on token" ON cash_transactions
    FOR INSERT WITH CHECK (
        staff_member_id IN (SELECT id FROM staff_members WHERE magic_token::text = current_setting('request.headers', true)::json->>'x-magic-token')
    );

CREATE POLICY "Staff can update their own transactions based on token" ON cash_transactions
    FOR UPDATE USING (
        staff_member_id IN (SELECT id FROM staff_members WHERE magic_token::text = current_setting('request.headers', true)::json->>'x-magic-token')
    );

-- Nota: il passaggio dell'intestazione (headers) 'x-magic-token' avverrà tramite il client Supabase.
