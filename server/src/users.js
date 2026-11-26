// Reads directly from SQLite so out-of-band updates (e.g. `npm run seed` or admin SQL)
// take effect immediately without stale in-memory sessionVersion / disabled state.

export function clearUserCache() {
  // kept for backward compatibility with tests and callers
}

export function getUserAuth(db, id) {
  const row = db.prepare(`
    SELECT u.id, u.username, u.name, u.role, u.university_id, u.session_version, u.disabled,
           un.name AS university_name, un.code AS university_code
    FROM users u LEFT JOIN universities un ON un.id = u.university_id
    WHERE u.id = ?`).get(id);
  if (!row) return null;
  return {
    user: {
      id: row.id,
      username: row.username,
      name: row.name,
      role: row.role === 1 ? 'admin' : 'coordinator',
      universityId: row.university_id ?? null,
      university: row.university_name ?? null,
      universityCode: row.university_code ?? null
    },
    sessionVersion: row.session_version,
    disabled: row.disabled === 1
  };
}

export function getUserById(db, id) {
  return getUserAuth(db, id)?.user ?? null;
}

export function getUserByUsername(db, username) {
  return db.prepare('SELECT * FROM users WHERE username = ?').get(username);
}

export function bumpSessionVersion(db, id) {
  db.prepare('UPDATE users SET session_version = session_version + 1 WHERE id = ?').run(id);
  clearUserCache();
}

// Shape sent to the browser
export function toClientUser(user) {
  return {
    username: user.username,
    name: user.name,
    university: user.university,
    universityCode: user.universityCode ?? null,
    role: user.role
  };
}
