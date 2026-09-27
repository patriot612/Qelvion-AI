-- Safe additive hardening: increase only the original default timeout.
-- Do not overwrite an administrator-customized value.
UPDATE config
SET value_json = '30000', updated_at = datetime('now')
WHERE key = 'search.timeout_ms' AND value_json = '10000';
