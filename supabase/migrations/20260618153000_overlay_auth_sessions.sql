-- Enables browser-to-tosu:// login synchronization.
CREATE TABLE IF NOT EXISTS overlay_auth_sessions (
    installation_hash CHAR(64) PRIMARY KEY,
    token TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_overlay_auth_sessions_expires
    ON overlay_auth_sessions(expires_at);

ALTER TABLE overlay_auth_sessions DISABLE ROW LEVEL SECURITY;
