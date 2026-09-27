CREATE TABLE IF NOT EXISTS admin_audit (
  audit_id TEXT PRIMARY KEY,
  admin_telegram_id INTEGER NOT NULL,
  target_user_id TEXT REFERENCES users(id),
  action TEXT NOT NULL,
  before_json TEXT NOT NULL DEFAULT '{}',
  after_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS admin_audit_created_idx ON admin_audit(created_at DESC);
CREATE INDEX IF NOT EXISTS admin_audit_target_idx ON admin_audit(target_user_id, created_at DESC);
