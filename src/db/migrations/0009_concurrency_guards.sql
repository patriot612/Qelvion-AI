ALTER TABLE users ADD COLUMN point_reservation_token TEXT;
ALTER TABLE dialogs ADD COLUMN turn_lock_token TEXT;
ALTER TABLE dialogs ADD COLUMN turn_lock_expires_at TEXT;
