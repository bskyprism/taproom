-- Passkey credentials storage
-- Only one user (the deployer) can register, so we keep it simple

CREATE TABLE IF NOT EXISTS passkeys (
    id TEXT PRIMARY KEY,
    credential_id TEXT NOT NULL UNIQUE,
    public_key TEXT NOT NULL,  -- Base64 encoded
    counter INTEGER NOT NULL DEFAULT 0,
    device_type TEXT,  -- 'singleDevice' or 'multiDevice'
    backed_up INTEGER NOT NULL DEFAULT 0,
    transports TEXT,  -- JSON array of transports
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Sessions for authenticated requests
CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    passkey_id TEXT NOT NULL REFERENCES passkeys(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    expires_at TEXT NOT NULL
);

-- Index for session lookups and cleanup
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);