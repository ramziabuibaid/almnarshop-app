-- Add username and password_hash fields to customers table for login credentials
-- Only users with accountant permission can set/change these credentials

ALTER TABLE customers 
ADD COLUMN IF NOT EXISTS username TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS password_hash TEXT;

-- Create index on username for faster lookups
CREATE INDEX IF NOT EXISTS idx_customers_username ON customers(username) WHERE username IS NOT NULL;

-- Add comment
COMMENT ON COLUMN customers.username IS 'Username for customer login (set by accountant only)';
COMMENT ON COLUMN customers.password_hash IS 'Hashed password for customer login (set by accountant only)';
