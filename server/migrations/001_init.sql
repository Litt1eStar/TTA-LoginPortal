CREATE TABLE universities (
  id   INTEGER PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL UNIQUE
);

CREATE TABLE users (
  id              INTEGER PRIMARY KEY,
  username        TEXT NOT NULL UNIQUE,
  password_hash   TEXT NOT NULL,
  name            TEXT NOT NULL,
  university_id   INTEGER REFERENCES universities(id),
  role            INTEGER NOT NULL DEFAULT 0,
  session_version INTEGER NOT NULL DEFAULT 0,
  disabled        INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE submissions (
  university_id INTEGER NOT NULL REFERENCES universities(id),
  entry_key     TEXT    NOT NULL,
  status        INTEGER NOT NULL DEFAULT 0,
  data          TEXT    NOT NULL DEFAULT '{}',
  version       INTEGER NOT NULL DEFAULT 1,
  draft_at      INTEGER,
  submitted_at  INTEGER,
  hash          TEXT,
  PRIMARY KEY (university_id, entry_key)
) WITHOUT ROWID;

CREATE TABLE files (
  id            INTEGER PRIMARY KEY,
  university_id INTEGER NOT NULL,
  entry_key     TEXT    NOT NULL,
  kind          INTEGER NOT NULL,
  sha256        TEXT    NOT NULL,
  size          INTEGER NOT NULL,
  mime          TEXT    NOT NULL,
  original_name TEXT    NOT NULL,
  uploaded_by   INTEGER NOT NULL REFERENCES users(id),
  created_at    INTEGER NOT NULL,
  FOREIGN KEY (university_id, entry_key) REFERENCES submissions(university_id, entry_key)
);
CREATE INDEX files_by_entry ON files(university_id, entry_key);
