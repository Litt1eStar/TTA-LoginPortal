CREATE TABLE video_confirmations (university_id INTEGER NOT NULL, drive_file_id TEXT NOT NULL, created_at INTEGER NOT NULL, PRIMARY KEY (university_id, drive_file_id)) WITHOUT ROWID;
