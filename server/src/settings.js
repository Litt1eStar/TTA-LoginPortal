// Small key/value store in the `settings` table (migration 002).

export function getSetting(db, key) {
  return db.prepare('SELECT value FROM settings WHERE key = ?').get(key)?.value ?? null;
}

export function setSetting(db, key, value) {
  db.prepare(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
  ).run(key, String(value));
}

export function deleteSetting(db, key) {
  db.prepare('DELETE FROM settings WHERE key = ?').run(key);
}

// Values of every key that starts with `prefix`.
export function listSettings(db, prefix) {
  return db.prepare("SELECT value FROM settings WHERE substr(key, 1, length(?)) = ?")
    .all(prefix, prefix)
    .map(r => r.value);
}

export function deleteSettingsLike(db, prefix) {
  db.prepare('DELETE FROM settings WHERE substr(key, 1, length(?)) = ?').run(prefix, prefix);
}
