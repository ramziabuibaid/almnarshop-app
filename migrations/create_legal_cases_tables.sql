-- Create legal_cases table
CREATE TABLE IF NOT EXISTS legal_cases (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    case_number VARCHAR(255) NOT NULL,
    customer_id TEXT NOT NULL REFERENCES customers(customer_id) ON DELETE CASCADE,
    total_amount DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    status VARCHAR(50) NOT NULL DEFAULT 'Active',
    notes TEXT,
    created_by UUID REFERENCES admin_users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_legal_cases_customer_id ON legal_cases(customer_id);
CREATE INDEX IF NOT EXISTS idx_legal_cases_case_number ON legal_cases(case_number);

-- Create legal_case_payments table
CREATE TABLE IF NOT EXISTS legal_case_payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    legal_case_id UUID NOT NULL REFERENCES legal_cases(id) ON DELETE CASCADE,
    amount DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
    notes TEXT,
    created_by UUID REFERENCES admin_users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Add index for payments
CREATE INDEX IF NOT EXISTS idx_legal_case_payments_case_id ON legal_case_payments(legal_case_id);

-- Update timestamp trigger for legal_cases
CREATE OR REPLACE FUNCTION update_legal_cases_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS trg_update_legal_cases_updated_at ON legal_cases;
CREATE TRIGGER trg_update_legal_cases_updated_at
    BEFORE UPDATE ON legal_cases
    FOR EACH ROW
    EXECUTE FUNCTION update_legal_cases_updated_at();
