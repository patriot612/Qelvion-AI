INSERT OR IGNORE INTO config (key, value_json, updated_at) VALUES
  ('search.price', '3', datetime('now')),
  ('image.speed.fast', '0', datetime('now')),
  ('image.speed.standard', '2', datetime('now')),
  ('image.speed.long', '5', datetime('now')),
  ('image.template.default', '1', datetime('now')),
  ('dialog.free.active_limit', '5', datetime('now')),
  ('dialog.free.archived_limit', '15', datetime('now')),
  ('dialog.free.archive_ttl_hours', '24', datetime('now')),
  ('dialog.free.messages_per_dialog', '50', datetime('now')),
  ('daily.free.points', '50', datetime('now'));

INSERT OR IGNORE INTO tariffs (
  key, name, status, daily_points, active_dialog_limit, archived_dialog_limit,
  archive_ttl_hours, message_limit_per_dialog, config_json, updated_at
) VALUES (
  'free', 'Free', 'active', 50, 5, 15, 24, 50, '{}', datetime('now')
);

INSERT OR IGNORE INTO roles (key, name, prompt, point_cost, active, config_json, updated_at) VALUES
  ('writer', 'Писатель', 'Отвечай как внимательный автор: структурно, естественно и ясно.', 0, 1, '{}', datetime('now')),
  ('analyst', 'Аналитик', 'Отвечай как аналитик: выделяй факты, допущения, риски и выводы.', 0, 1, '{}', datetime('now')),
  ('teacher', 'Учитель', 'Объясняй пошагово и учитывай уровень подготовки собеседника.', 0, 1, '{}', datetime('now'));
