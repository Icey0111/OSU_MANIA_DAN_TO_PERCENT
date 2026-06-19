-- osu!mania Dan Voting System - Database Schema
-- Run this in Supabase SQL Editor to create tables

-- Users table: stores authenticated osu! players
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    osu_id INTEGER UNIQUE NOT NULL,
    osu_username VARCHAR(64) NOT NULL,
    avatar_url VARCHAR(256),
    is_admin BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_login_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_users_osu_id ON users(osu_id);

-- Beatmaps table: stores beatmap difficulty metadata
CREATE TABLE IF NOT EXISTS beatmaps (
    id SERIAL PRIMARY KEY,
    osu_beatmap_id INTEGER UNIQUE,
    beatmapset_id INTEGER,
    source_type VARCHAR(8) NOT NULL DEFAULT 'osu',
    file_checksum CHAR(32) UNIQUE,
    checksum_algorithm VARCHAR(8),
    official_file_checksum CHAR(32),
    mode SMALLINT NOT NULL DEFAULT 3,
    artist VARCHAR(256) NOT NULL,
    title VARCHAR(256) NOT NULL,
    version VARCHAR(256) NOT NULL,
    creator VARCHAR(64) NOT NULL,
    total_votes INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT beatmaps_source_identity_check CHECK (
        (
            source_type = 'osu'
            AND osu_beatmap_id IS NOT NULL AND osu_beatmap_id > 0
            AND beatmapset_id IS NOT NULL AND beatmapset_id > 0
            AND file_checksum IS NULL AND checksum_algorithm IS NULL
        )
        OR
        (
            source_type = 'local'
            AND osu_beatmap_id IS NULL AND beatmapset_id IS NULL
            AND file_checksum ~ '^[0-9a-f]{32}$'
            AND checksum_algorithm = 'md5'
        )
    )
);

CREATE INDEX idx_beatmaps_osu_id ON beatmaps(osu_beatmap_id);
CREATE INDEX idx_beatmaps_beatmapset ON beatmaps(beatmapset_id);
CREATE INDEX idx_beatmaps_source_type ON beatmaps(source_type);

-- Votes table: individual user votes, one per user per beatmap
CREATE TABLE IF NOT EXISTS votes (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    beatmap_id INTEGER NOT NULL REFERENCES beatmaps(id) ON DELETE CASCADE,
    dan_level VARCHAR(3) NOT NULL,
    tier VARCHAR(4) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, beatmap_id)
);

CREATE INDEX idx_votes_user_beatmap ON votes(user_id, beatmap_id);
CREATE INDEX idx_votes_beatmap ON votes(beatmap_id);
CREATE INDEX idx_votes_dan ON votes(beatmap_id, dan_level);

-- Short-lived browser-to-in-game login handoff. Browser localStorage and the
-- tosu:// renderer are isolated, so the renderer claims a token using a
-- per-installation 256-bit secret embedded by scripts/sync-overlay.js.
CREATE TABLE IF NOT EXISTS overlay_auth_sessions (
    installation_hash CHAR(64) PRIMARY KEY,
    token TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_overlay_auth_sessions_expires ON overlay_auth_sessions(expires_at);

-- ====== RLS: Disable for all tables ======
-- Auth is handled at the API route level (custom JWT), not via Supabase RLS
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE beatmaps DISABLE ROW LEVEL SECURITY;
ALTER TABLE votes DISABLE ROW LEVEL SECURITY;
ALTER TABLE overlay_auth_sessions DISABLE ROW LEVEL SECURITY;

-- Local-to-official promotions are performed by the transactional
-- promote_local_beatmap function in the Supabase migrations.
CREATE TABLE IF NOT EXISTS beatmap_promotion_audits (
    id BIGSERIAL PRIMARY KEY,
    local_beatmap_id INTEGER NOT NULL,
    official_beatmap_id INTEGER NOT NULL,
    target_beatmap_id INTEGER REFERENCES beatmaps(id) ON DELETE SET NULL,
    promoted_by INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    local_file_checksum CHAR(32) NOT NULL,
    official_file_checksum CHAR(32),
    local_snapshot JSONB NOT NULL,
    official_snapshot JSONB NOT NULL,
    match_method VARCHAR(32) NOT NULL,
    moved_votes INTEGER NOT NULL,
    duplicate_votes INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE beatmap_promotion_audits DISABLE ROW LEVEL SECURITY;

-- Trigger function: update beatmaps.total_votes when votes change
CREATE OR REPLACE FUNCTION update_beatmap_total_votes()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE beatmaps SET total_votes = total_votes + 1, updated_at = NOW()
        WHERE id = NEW.beatmap_id;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE beatmaps SET total_votes = total_votes - 1, updated_at = NOW()
        WHERE id = OLD.beatmap_id;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_total_votes ON votes;
CREATE TRIGGER trigger_update_total_votes
    AFTER INSERT OR DELETE ON votes
    FOR EACH ROW
    EXECUTE FUNCTION update_beatmap_total_votes();

-- The database-level confidence guard is defined in
-- supabase/migrations/20260619040000_vote_confidence_guard.sql.
