-- Bar settings table (singleton per bar)
CREATE TABLE IF NOT EXISTS bar_settings (
  bar_id TEXT PRIMARY KEY,
  no_table_mode BOOLEAN DEFAULT FALSE
);

-- Categories table (dynamic, replaces hardcoded getCategoryName)
CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  bar_id TEXT NOT NULL REFERENCES bar_settings(bar_id),
  name TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0,
  visible_in_no_table_mode BOOLEAN DEFAULT FALSE
);

-- Default bar settings
INSERT INTO bar_settings (bar_id, no_table_mode)
VALUES ('bar-02-pin', FALSE)
ON CONFLICT (bar_id) DO NOTHING;

-- Migrate existing categories from menu_items
INSERT INTO categories (id, bar_id, name, sort_order, visible_in_no_table_mode)
SELECT DISTINCT category_id, 'bar-02-pin',
  INITCAP(REPLACE(category_id, '-', ' ')),
  COALESCE((SELECT MIN(category_sort_order) FROM menu_items mi2 WHERE mi2.category_id = mi.category_id AND mi2.bar_id = 'bar-02-pin'), 0),
  CASE WHEN category_id IN ('bebidas', 'cervezas', 'tragos', 'vinos', 'sin-alcohol') THEN TRUE ELSE FALSE END
FROM menu_items mi
WHERE bar_id = 'bar-02-pin'
ON CONFLICT (id) DO NOTHING;

-- Enable RLS
ALTER TABLE bar_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

-- Policies: authenticated users can read, admin can write
CREATE POLICY "Authenticated read bar_settings" ON bar_settings
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated read categories" ON categories
  FOR SELECT USING (auth.role() = 'authenticated');
