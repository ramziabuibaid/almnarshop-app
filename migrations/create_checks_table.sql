-- Create checks table for returned cheques
CREATE TABLE IF NOT EXISTS checks (
  check_id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL REFERENCES customers(customer_id) ON DELETE CASCADE,
  amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  image_front TEXT,
  image_back TEXT,
  return_date DATE,
  status TEXT CHECK (status IN ('مع الشركة','في البنك','في المحل','سلم للزبون ولد يدفع','سلم للزبون وتم تسديد القيمة')),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_checks_customer_id ON checks(customer_id);
CREATE INDEX IF NOT EXISTS idx_checks_status ON checks(status);


