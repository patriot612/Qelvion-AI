ALTER TABLE users ADD COLUMN pending_task_type TEXT CHECK (pending_task_type IN ('image','document','audio','voice'));
