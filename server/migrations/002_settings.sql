CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL) WITHOUT ROWID;
-- keys: 'google.refresh_token' (AES-256-GCM, base64), 'google.email', 'drive.root_folder',
--       'drive.folder.<universityCode>'
