CREATE TABLE IF NOT EXISTS events (
 id TEXT PRIMARY KEY, occurred INTEGER NOT NULL, day TEXT NOT NULL, kind TEXT NOT NULL,
 path TEXT NOT NULL, previous_path TEXT NOT NULL, visit TEXT NOT NULL,
 label TEXT NOT NULL DEFAULT '', value REAL NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS events_time ON events(occurred);
CREATE INDEX IF NOT EXISTS events_visit_kind ON events(visit,kind);
CREATE TABLE IF NOT EXISTS visits (
 id TEXT PRIMARY KEY, first_seen INTEGER NOT NULL, last_seen INTEGER NOT NULL,
 active_until INTEGER NOT NULL, entry_path TEXT NOT NULL, current_path TEXT NOT NULL,
 source TEXT NOT NULL, campaign TEXT NOT NULL, device TEXT NOT NULL, browser TEXT NOT NULL,
 os TEXT NOT NULL, viewport TEXT NOT NULL, screen TEXT NOT NULL, locale TEXT NOT NULL,
 mode TEXT NOT NULL, engaged_ms INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS visits_time ON visits(first_seen);
CREATE INDEX IF NOT EXISTS visits_active ON visits(active_until);
CREATE TABLE IF NOT EXISTS admin_sessions (token_hash TEXT PRIMARY KEY, expires INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS auth_attempts (key TEXT PRIMARY KEY, count INTEGER NOT NULL, expires INTEGER NOT NULL);
