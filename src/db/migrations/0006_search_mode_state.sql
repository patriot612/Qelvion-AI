ALTER TABLE users ADD COLUMN active_mode TEXT NOT NULL DEFAULT 'chat' CHECK (active_mode IN ('chat','search'));
