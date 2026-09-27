-- Prevent model changes from invalidating the currently configured
-- Chat/Search model selectors.

CREATE TRIGGER IF NOT EXISTS model_runtime_config_guard_update
BEFORE UPDATE OF active, capabilities_json ON models
WHEN
  (
    EXISTS (
      SELECT 1
      FROM config AS c
      WHERE c.key = 'chat.model'
        AND json_valid(c.value_json) = 1
        AND json_extract(c.value_json, '$') = OLD.key
    )
    AND (
      NEW.active <> 1
      OR NOT EXISTS (
        SELECT 1
        FROM json_each(NEW.capabilities_json) AS capability
        WHERE capability.value = 'chat'
      )
    )
  )
  OR
  (
    EXISTS (
      SELECT 1
      FROM config AS c
      WHERE c.key = 'search.editor_model'
        AND json_valid(c.value_json) = 1
        AND json_extract(c.value_json, '$') = OLD.key
    )
    AND (
      NEW.active <> 1
      OR NOT EXISTS (
        SELECT 1
        FROM json_each(NEW.capabilities_json) AS capability
        WHERE capability.value = 'search-editor'
      )
    )
  )
BEGIN
  SELECT RAISE(ABORT, 'Model change would invalidate active runtime configuration');
END;

CREATE TRIGGER IF NOT EXISTS model_runtime_config_guard_delete
BEFORE DELETE ON models
WHEN EXISTS (
  SELECT 1
  FROM config AS c
  WHERE c.key IN ('chat.model', 'search.editor_model')
    AND json_valid(c.value_json) = 1
    AND json_extract(c.value_json, '$') = OLD.key
)
BEGIN
  SELECT RAISE(ABORT, 'Model delete would invalidate active runtime configuration');
END;
