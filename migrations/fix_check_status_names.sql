-- Migration script to fix check status names in the database
-- This script:
-- 1. Drops the old CHECK constraint (to allow data updates)
-- 2. Updates "سلم للزبون ولد يدفع" to "سلم للزبون ولم يدفع"
-- 3. Updates "تم دفع القيمة" to "سلم للزبون وتم تسديد القيمة"
-- 4. Creates a new CHECK constraint with the correct status values

-- Step 1: Drop the old CHECK constraint to allow data updates
ALTER TABLE checks DROP CONSTRAINT IF EXISTS checks_status_check;

-- Step 2: Update status from "سلم للزبون ولد يدفع" to "سلم للزبون ولم يدفع"
UPDATE checks
SET status = 'سلم للزبون ولم يدفع'
WHERE status = 'سلم للزبون ولد يدفع';

-- Step 3: Update status from "تم دفع القيمة" to "سلم للزبون وتم تسديد القيمة"
UPDATE checks
SET status = 'سلم للزبون وتم تسديد القيمة'
WHERE status = 'تم دفع القيمة';

-- Step 4: Verify all current status values before creating constraint
-- This will show any unexpected status values that need to be handled
SELECT DISTINCT status, COUNT(*) as count
FROM checks
GROUP BY status
ORDER BY status;

-- Step 5: Create a new CHECK constraint with the correct status values
-- Note: This will fail if there are any rows with status values not in the list
ALTER TABLE checks 
ADD CONSTRAINT checks_status_check 
CHECK (status IN (
  'مع الشركة',
  'في البنك',
  'في المحل',
  'في المخزن',
  'سلم للزبون ولم يدفع',
  'سلم للزبون وتم تسديد القيمة'
));

-- Step 6: Final verification
SELECT status, COUNT(*) as count
FROM checks
GROUP BY status
ORDER BY status;
