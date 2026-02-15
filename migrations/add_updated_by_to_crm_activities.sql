-- Migration: Add updated_by to crm_activities for audit trail
-- Ensures every status change (تم الدفع، إعادة جدولة، أرشفة) is attributed to the employee who performed it.

-- Add updated_by column (stores admin_users.id as TEXT for compatibility with existing created_by)
ALTER TABLE crm_activities
  ADD COLUMN IF NOT EXISTS updated_by TEXT;

-- Optional: index for filtering/audit by employee
CREATE INDEX IF NOT EXISTS idx_crm_activities_updated_by ON crm_activities(updated_by);
CREATE INDEX IF NOT EXISTS idx_crm_activities_created_by ON crm_activities(created_by);

COMMENT ON COLUMN crm_activities.updated_by IS 'Admin user ID who last updated status (e.g. Fulfilled, Archived)';
