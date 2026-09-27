-- Validate runtime configuration at the D1 boundary so malformed Admin writes
-- cannot poison Search/Chat selection or runtime limits.

CREATE TRIGGER IF NOT EXISTS config_runtime_validation_insert
BEFORE INSERT ON config
BEGIN
  SELECT CASE
    WHEN NEW.key = 'search.price'
      AND (json_type(NEW.value_json) <> 'integer' OR json_extract(NEW.value_json, '$') < 0)
      THEN RAISE(ABORT, 'Invalid search.price')
  END;

  SELECT CASE
    WHEN NEW.key = 'search.results_limit'
      AND (json_type(NEW.value_json) <> 'integer' OR json_extract(NEW.value_json, '$') < 1 OR json_extract(NEW.value_json, '$') > 20)
      THEN RAISE(ABORT, 'Invalid search.results_limit')
  END;

  SELECT CASE
    WHEN NEW.key = 'search.timeout_ms'
      AND (json_type(NEW.value_json) <> 'integer' OR json_extract(NEW.value_json, '$') < 5000 OR json_extract(NEW.value_json, '$') > 26000)
      THEN RAISE(ABORT, 'Invalid search.timeout_ms')
  END;

  SELECT CASE
    WHEN NEW.key = 'search.enabled'
      AND json_type(NEW.value_json) NOT IN ('true', 'false')
      THEN RAISE(ABORT, 'Invalid search.enabled')
  END;

  SELECT CASE
    WHEN NEW.key = 'search.language'
      AND (json_type(NEW.value_json) <> 'text' OR length(json_extract(NEW.value_json, '$')) = 0 OR length(json_extract(NEW.value_json, '$')) > 32)
      THEN RAISE(ABORT, 'Invalid search.language')
  END;

  SELECT CASE
    WHEN NEW.key = 'search.safesearch'
      AND (json_type(NEW.value_json) <> 'integer' OR json_extract(NEW.value_json, '$') < 0 OR json_extract(NEW.value_json, '$') > 2)
      THEN RAISE(ABORT, 'Invalid search.safesearch')
  END;

  SELECT CASE
    WHEN NEW.key = 'search.time_range'
      AND NOT (
        json_type(NEW.value_json) = 'null'
        OR (json_type(NEW.value_json) = 'text' AND length(json_extract(NEW.value_json, '$')) BETWEEN 1 AND 16)
      )
      THEN RAISE(ABORT, 'Invalid search.time_range')
  END;

  SELECT CASE
    WHEN NEW.key IN ('search.editor_model', 'chat.model')
      AND NOT EXISTS (
        SELECT 1
        FROM models AS m
        WHERE m.key = json_extract(NEW.value_json, '$')
          AND m.active = 1
          AND EXISTS (
            SELECT 1
            FROM json_each(m.capabilities_json) AS capability
            WHERE capability.value = CASE
              WHEN NEW.key = 'search.editor_model' THEN 'search-editor'
              ELSE 'chat'
            END
          )
      )
      THEN RAISE(ABORT, 'Invalid configured model')
  END;
END;

CREATE TRIGGER IF NOT EXISTS config_runtime_validation_update
BEFORE UPDATE OF value_json ON config
BEGIN
  SELECT CASE
    WHEN NEW.key = 'search.price'
      AND (json_type(NEW.value_json) <> 'integer' OR json_extract(NEW.value_json, '$') < 0)
      THEN RAISE(ABORT, 'Invalid search.price')
  END;

  SELECT CASE
    WHEN NEW.key = 'search.results_limit'
      AND (json_type(NEW.value_json) <> 'integer' OR json_extract(NEW.value_json, '$') < 1 OR json_extract(NEW.value_json, '$') > 20)
      THEN RAISE(ABORT, 'Invalid search.results_limit')
  END;

  SELECT CASE
    WHEN NEW.key = 'search.timeout_ms'
      AND (json_type(NEW.value_json) <> 'integer' OR json_extract(NEW.value_json, '$') < 5000 OR json_extract(NEW.value_json, '$') > 26000)
      THEN RAISE(ABORT, 'Invalid search.timeout_ms')
  END;

  SELECT CASE
    WHEN NEW.key = 'search.enabled'
      AND json_type(NEW.value_json) NOT IN ('true', 'false')
      THEN RAISE(ABORT, 'Invalid search.enabled')
  END;

  SELECT CASE
    WHEN NEW.key = 'search.language'
      AND (json_type(NEW.value_json) <> 'text' OR length(json_extract(NEW.value_json, '$')) = 0 OR length(json_extract(NEW.value_json, '$')) > 32)
      THEN RAISE(ABORT, 'Invalid search.language')
  END;

  SELECT CASE
    WHEN NEW.key = 'search.safesearch'
      AND (json_type(NEW.value_json) <> 'integer' OR json_extract(NEW.value_json, '$') < 0 OR json_extract(NEW.value_json, '$') > 2)
      THEN RAISE(ABORT, 'Invalid search.safesearch')
  END;

  SELECT CASE
    WHEN NEW.key = 'search.time_range'
      AND NOT (
        json_type(NEW.value_json) = 'null'
        OR (json_type(NEW.value_json) = 'text' AND length(json_extract(NEW.value_json, '$')) BETWEEN 1 AND 16)
      )
      THEN RAISE(ABORT, 'Invalid search.time_range')
  END;

  SELECT CASE
    WHEN NEW.key IN ('search.editor_model', 'chat.model')
      AND NOT EXISTS (
        SELECT 1
        FROM models AS m
        WHERE m.key = json_extract(NEW.value_json, '$')
          AND m.active = 1
          AND EXISTS (
            SELECT 1
            FROM json_each(m.capabilities_json) AS capability
            WHERE capability.value = CASE
              WHEN NEW.key = 'search.editor_model' THEN 'search-editor'
              ELSE 'chat'
            END
          )
      )
      THEN RAISE(ABORT, 'Invalid configured model')
  END;
END;
