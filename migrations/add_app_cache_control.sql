-- ==========================================
-- Migration: app_cache_control for global cache invalidation
-- ==========================================
-- When an admin clicks "تحديث من قاعدة البيانات" in products, we set products_invalidated_at = now().
-- All clients (including store) check this before using cached products; if server timestamp is newer,
-- they skip cache and fetch fresh data.

CREATE TABLE IF NOT EXISTS app_cache_control (
  key text PRIMARY KEY,
  value timestamptz NOT NULL DEFAULT now()
);

INSERT INTO app_cache_control (key, value)
VALUES 
  ('products_invalidated_at', now()),
  ('customers_invalidated_at', now())
ON CONFLICT (key) DO NOTHING;

COMMENT ON TABLE app_cache_control IS 'Global cache invalidation timestamps. products_invalidated_at and customers_invalidated_at are bumped when admin refreshes so all users get fresh data on next load.';
