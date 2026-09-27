CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  telegram_user_id INTEGER NOT NULL UNIQUE,
  language TEXT NOT NULL DEFAULT 'ru',
  status TEXT NOT NULL DEFAULT 'active',
  balance_points INTEGER NOT NULL DEFAULT 0 CHECK (balance_points >= 0),
  daily_points_granted INTEGER NOT NULL DEFAULT 50 CHECK (daily_points_granted >= 0),
  daily_points_remaining INTEGER NOT NULL DEFAULT 50 CHECK (daily_points_remaining >= 0),
  daily_points_reset_at TEXT NOT NULL,
  subscription_status TEXT NOT NULL DEFAULT 'free',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS operations (
  operation_id TEXT PRIMARY KEY,
  request_id TEXT NOT NULL UNIQUE,
  user_id TEXT NOT NULL REFERENCES users(id),
  type TEXT NOT NULL,
  status TEXT NOT NULL,
  provider TEXT,
  model TEXT,
  cost INTEGER NOT NULL DEFAULT 0 CHECK (cost >= 0),
  reserved_points INTEGER NOT NULL DEFAULT 0 CHECK (reserved_points >= 0),
  attempt INTEGER NOT NULL DEFAULT 0 CHECK (attempt >= 0),
  created_at TEXT NOT NULL,
  started_at TEXT,
  finished_at TEXT,
  error_code TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS operations_user_created_idx ON operations(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS operations_status_idx ON operations(status);

CREATE TABLE IF NOT EXISTS point_ledger (
  entry_id TEXT PRIMARY KEY,
  operation_id TEXT REFERENCES operations(operation_id),
  user_id TEXT NOT NULL REFERENCES users(id),
  kind TEXT NOT NULL,
  amount INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  metadata_json TEXT NOT NULL DEFAULT '{}'
);
CREATE UNIQUE INDEX IF NOT EXISTS point_ledger_operation_kind_idx ON point_ledger(operation_id, kind);
CREATE INDEX IF NOT EXISTS point_ledger_user_created_idx ON point_ledger(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS processed_updates (
  update_id INTEGER PRIMARY KEY,
  processed_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS dialogs (
  dialog_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  title TEXT NOT NULL,
  is_archived INTEGER NOT NULL DEFAULT 0 CHECK (is_archived IN (0,1)),
  message_count INTEGER NOT NULL DEFAULT 0 CHECK (message_count >= 0),
  archived_at TEXT,
  expires_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS dialogs_user_active_idx ON dialogs(user_id, is_archived, updated_at DESC);

CREATE TABLE IF NOT EXISTS dialog_messages (
  message_id TEXT PRIMARY KEY,
  dialog_id TEXT NOT NULL REFERENCES dialogs(dialog_id),
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS dialog_messages_dialog_idx ON dialog_messages(dialog_id, created_at);

CREATE TABLE IF NOT EXISTS config (
  key TEXT PRIMARY KEY,
  value_json TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS models (
  key TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  provider TEXT NOT NULL,
  provider_model_id TEXT NOT NULL,
  capabilities_json TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0,1)),
  access_level TEXT NOT NULL DEFAULT 'daily',
  point_cost INTEGER NOT NULL DEFAULT 0 CHECK (point_cost >= 0),
  config_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS roles (
  key TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  prompt TEXT NOT NULL,
  point_cost INTEGER NOT NULL DEFAULT 0 CHECK (point_cost >= 0),
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0,1)),
  config_json TEXT NOT NULL DEFAULT '{}',
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS tariffs (
  key TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  daily_points INTEGER NOT NULL DEFAULT 50 CHECK (daily_points >= 0),
  active_dialog_limit INTEGER NOT NULL DEFAULT 5 CHECK (active_dialog_limit >= 0),
  archived_dialog_limit INTEGER NOT NULL DEFAULT 15 CHECK (archived_dialog_limit >= 0),
  archive_ttl_hours INTEGER NOT NULL DEFAULT 24 CHECK (archive_ttl_hours > 0),
  message_limit_per_dialog INTEGER NOT NULL DEFAULT 50 CHECK (message_limit_per_dialog > 0),
  config_json TEXT NOT NULL DEFAULT '{}',
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS payments (
  payment_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  provider TEXT NOT NULL,
  provider_payment_id TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL,
  amount_points INTEGER NOT NULL DEFAULT 0 CHECK (amount_points >= 0),
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
