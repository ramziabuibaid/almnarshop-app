-- Create store_settings table
CREATE TABLE IF NOT EXISTS store_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  description TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_by TEXT
);

-- Turn on RLS
ALTER TABLE store_settings ENABLE ROW LEVEL SECURITY;

-- Allow read access to everyone (public settings)
CREATE POLICY "Allow public read access" ON store_settings
  FOR SELECT USING (true);

-- Allow all access to authenticated users (admins) implies they have role='authenticated'
-- Adjust this policy based on your specific auth implementation if needed
CREATE POLICY "Allow full access to authenticated users" ON store_settings
  FOR ALL USING (auth.role() = 'authenticated');

-- Insert default working hours
INSERT INTO store_settings (key, value, description)
VALUES 
  ('working_hours', '"من الساعة 8:30 صباحاً - 6:00 مساءً"', 'Store working hours text')
ON CONFLICT (key) DO NOTHING;

-- Trigger for updated_at
DROP TRIGGER IF EXISTS update_store_settings_updated_at ON store_settings;
CREATE TRIGGER update_store_settings_updated_at BEFORE UPDATE ON store_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
