ALTER TABLE processed_updates ADD COLUMN status TEXT NOT NULL DEFAULT 'completed';
CREATE INDEX IF NOT EXISTS processed_updates_status_idx ON processed_updates(status);
