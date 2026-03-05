-- Create the article_guest_links table to manage temporary secure tokens for guest authors
CREATE TABLE IF NOT EXISTS article_guest_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token TEXT UNIQUE NOT NULL,
  author_name TEXT NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index the token for fast lookups
CREATE INDEX IF NOT EXISTS idx_guest_links_token ON article_guest_links(token);

-- Trigger to automatically update the updated_at timestamp
DROP TRIGGER IF EXISTS update_article_guest_links_updated_at ON article_guest_links;
CREATE TRIGGER update_article_guest_links_updated_at BEFORE UPDATE ON article_guest_links
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Modify the existing 'articles' table to support associating an article with a guest link
ALTER TABLE articles ADD COLUMN IF NOT EXISTS guest_link_id UUID REFERENCES article_guest_links(id) ON DELETE SET NULL;
ALTER TABLE articles ADD COLUMN IF NOT EXISTS author_name TEXT;
