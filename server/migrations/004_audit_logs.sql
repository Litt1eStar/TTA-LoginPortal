CREATE TABLE audit_logs (
  id              INTEGER PRIMARY KEY,
  created_at      INTEGER NOT NULL,
  user_id         INTEGER REFERENCES users(id),
  username        TEXT    NOT NULL,
  user_role       TEXT    NOT NULL,
  university_id   INTEGER REFERENCES universities(id),
  university_code TEXT,
  action          TEXT    NOT NULL,
  entry_key       TEXT,
  target_id       TEXT,
  status          TEXT    NOT NULL DEFAULT 'ok',
  error_code      TEXT,
  ip              TEXT,
  user_agent      TEXT,
  summary         TEXT    NOT NULL,
  details         TEXT    NOT NULL DEFAULT '{}'
);

CREATE INDEX audit_logs_created_at ON audit_logs(created_at DESC, id DESC);
CREATE INDEX audit_logs_university ON audit_logs(university_id, created_at DESC);
CREATE INDEX audit_logs_action ON audit_logs(action, created_at DESC);
CREATE INDEX audit_logs_username ON audit_logs(username, created_at DESC);
