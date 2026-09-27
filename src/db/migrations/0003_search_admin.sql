INSERT OR IGNORE INTO config (key, value_json, updated_at) VALUES
  ('search.results_limit', '5', datetime('now')),
  ('search.timeout_ms', '10000', datetime('now')),
  ('search.editor_model', 'null', datetime('now')),
  ('chat.model', 'null', datetime('now'));
