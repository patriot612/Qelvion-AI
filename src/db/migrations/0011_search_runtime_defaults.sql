INSERT OR IGNORE INTO config (key, value_json, updated_at) VALUES
  ('search.enabled', 'true', datetime('now')),
  ('search.language', '"all"', datetime('now')),
  ('search.safesearch', '1', datetime('now')),
  ('search.time_range', 'null', datetime('now'));
