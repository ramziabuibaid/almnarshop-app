-- Remove unused columns from customers
ALTER TABLE customers
  DROP COLUMN IF EXISTS ctype,
  DROP COLUMN IF EXISTS role;

