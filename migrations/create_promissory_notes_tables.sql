-- Create promissory_notes table
-- Changed id to TEXT to support custom sequential IDs (e.g. PN-0001-123) similar to checks
CREATE TABLE IF NOT EXISTS promissory_notes (
  id TEXT PRIMARY KEY, 
  customer_id TEXT NOT NULL REFERENCES customers(customer_id) ON DELETE CASCADE,
  total_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  issue_date DATE DEFAULT CURRENT_DATE,
  notes TEXT,
  status TEXT CHECK (status IN ('Active', 'Completed', 'Defaulted')) DEFAULT 'Active',
  image_url TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create promissory_note_installments table
CREATE TABLE IF NOT EXISTS promissory_note_installments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  promissory_note_id TEXT NOT NULL REFERENCES promissory_notes(id) ON DELETE CASCADE, -- Changed to TEXT
  amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  due_date DATE NOT NULL,
  status TEXT CHECK (status IN ('Pending', 'Paid', 'Late', 'Partially Paid')) DEFAULT 'Pending',
  payment_date DATE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_promissory_notes_customer_id ON promissory_notes(customer_id);
CREATE INDEX IF NOT EXISTS idx_promissory_notes_status ON promissory_notes(status);
CREATE INDEX IF NOT EXISTS idx_promissory_note_installments_note_id ON promissory_note_installments(promissory_note_id);
CREATE INDEX IF NOT EXISTS idx_promissory_note_installments_due_date ON promissory_note_installments(due_date);
CREATE INDEX IF NOT EXISTS idx_promissory_note_installments_status ON promissory_note_installments(status);

-- Triggers for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_promissory_notes_updated_at ON promissory_notes;
CREATE TRIGGER update_promissory_notes_updated_at
    BEFORE UPDATE ON promissory_notes
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_promissory_note_installments_updated_at ON promissory_note_installments;
CREATE TRIGGER update_promissory_note_installments_updated_at
    BEFORE UPDATE ON promissory_note_installments
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
