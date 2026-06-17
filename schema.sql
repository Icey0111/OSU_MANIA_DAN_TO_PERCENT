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
    osu_beatmap_id INTEGER UNIQUE NOT NULL,
    beatmapset_id INTEGER NOT NULL,
    artist VARCHAR(256) NOT NULL,
    title VARCHAR(256) NOT NULL,
    version VARCHAR(256) NOT NULL,
    creator VARCHAR(64) NOT NULL,
    total_votes INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_beatmaps_osu_id ON beatmaps(osu_beatmap_id);
CREATE INDEX idx_beatmaps_beatmapset ON beatmaps(beatmapset_id);

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
