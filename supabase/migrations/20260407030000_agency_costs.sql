-- Add direct agency costs for robust profit calculation

-- 1. Updates to bookings
ALTER TABLE bookings
ADD COLUMN IF NOT EXISTS staff_cost DECIMAL(10, 2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS services_cost DECIMAL(10, 2) DEFAULT 0.00;

-- 2. Updates to staff members for automatic cost deduction
ALTER TABLE staff_members
ADD COLUMN IF NOT EXISTS cost_per_service DECIMAL(10, 2) DEFAULT 0.00;

-- Extra services 'cost' field does not need SQL DDL because extra_services is a JSONB array on properties, 
-- we will just save `{ name: string, price: number, cost_price: number }` in the JSON.
