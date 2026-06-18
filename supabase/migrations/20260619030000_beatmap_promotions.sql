-- Atomically promote a checksum-addressed local revision to an official osu!
-- beatmap while preserving votes and an immutable audit trail.
ALTER TABLE beatmaps
    ADD COLUMN IF NOT EXISTS official_file_checksum CHAR(32);

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

CREATE INDEX IF NOT EXISTS idx_beatmap_promotion_audits_local
    ON beatmap_promotion_audits(local_beatmap_id);
CREATE INDEX IF NOT EXISTS idx_beatmap_promotion_audits_official
    ON beatmap_promotion_audits(official_beatmap_id);

ALTER TABLE beatmap_promotion_audits DISABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION promote_local_beatmap(
    p_local_beatmap_id INTEGER,
    p_official_beatmap_id INTEGER,
    p_beatmapset_id INTEGER,
    p_artist TEXT,
    p_title TEXT,
    p_version TEXT,
    p_creator TEXT,
    p_official_file_checksum TEXT,
    p_promoted_by INTEGER,
    p_match_method TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_local beatmaps%ROWTYPE;
    v_target beatmaps%ROWTYPE;
    v_target_id INTEGER;
    v_local_votes INTEGER;
    v_duplicate_votes INTEGER;
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM users WHERE id = p_promoted_by AND is_admin = TRUE
    ) THEN
        RAISE EXCEPTION 'Admin access required';
    END IF;

    SELECT * INTO v_local
    FROM beatmaps
    WHERE id = p_local_beatmap_id
    FOR UPDATE;

    IF NOT FOUND OR v_local.source_type <> 'local' THEN
        RAISE EXCEPTION 'Local beatmap not found';
    END IF;

    SELECT * INTO v_target
    FROM beatmaps
    WHERE osu_beatmap_id = p_official_beatmap_id
    FOR UPDATE;

    SELECT COUNT(*) INTO v_local_votes
    FROM votes WHERE beatmap_id = v_local.id;

    IF v_target.id IS NOT NULL THEN
        SELECT COUNT(*) INTO v_duplicate_votes
        FROM votes local_vote
        JOIN votes official_vote ON official_vote.user_id = local_vote.user_id
        WHERE local_vote.beatmap_id = v_local.id
          AND official_vote.beatmap_id = v_target.id;

        INSERT INTO votes (user_id, beatmap_id, dan_level, tier, created_at, updated_at)
        SELECT user_id, v_target.id, dan_level, tier, created_at, updated_at
        FROM votes
        WHERE beatmap_id = v_local.id
        ON CONFLICT (user_id, beatmap_id) DO UPDATE
        SET dan_level = EXCLUDED.dan_level,
            tier = EXCLUDED.tier,
            created_at = EXCLUDED.created_at,
            updated_at = EXCLUDED.updated_at
        WHERE votes.updated_at < EXCLUDED.updated_at;

        UPDATE beatmaps
        SET beatmapset_id = p_beatmapset_id,
            artist = p_artist,
            title = p_title,
            version = p_version,
            creator = p_creator,
            official_file_checksum = p_official_file_checksum,
            updated_at = NOW()
        WHERE id = v_target.id;
        v_target_id := v_target.id;
    ELSE
        v_duplicate_votes := 0;
        UPDATE beatmaps
        SET source_type = 'osu',
            osu_beatmap_id = p_official_beatmap_id,
            beatmapset_id = p_beatmapset_id,
            file_checksum = NULL,
            checksum_algorithm = NULL,
            official_file_checksum = p_official_file_checksum,
            artist = p_artist,
            title = p_title,
            version = p_version,
            creator = p_creator,
            updated_at = NOW()
        WHERE id = v_local.id;
        v_target_id := v_local.id;
    END IF;

    INSERT INTO beatmap_promotion_audits (
        local_beatmap_id, official_beatmap_id, target_beatmap_id, promoted_by,
        local_file_checksum, official_file_checksum, local_snapshot,
        official_snapshot, match_method, moved_votes, duplicate_votes
    ) VALUES (
        v_local.id, p_official_beatmap_id, v_target_id, p_promoted_by,
        v_local.file_checksum, p_official_file_checksum,
        jsonb_build_object(
            'artist', v_local.artist, 'title', v_local.title,
            'version', v_local.version, 'creator', v_local.creator,
            'checksum', v_local.file_checksum
        ),
        jsonb_build_object(
            'artist', p_artist, 'title', p_title, 'version', p_version,
            'creator', p_creator, 'osu_beatmap_id', p_official_beatmap_id,
            'beatmapset_id', p_beatmapset_id, 'checksum', p_official_file_checksum
        ),
        p_match_method, v_local_votes, v_duplicate_votes
    );

    IF v_target.id IS NOT NULL THEN
        DELETE FROM beatmaps WHERE id = v_local.id;
    END IF;

    UPDATE beatmaps
    SET total_votes = (SELECT COUNT(*) FROM votes WHERE beatmap_id = v_target_id),
        updated_at = NOW()
    WHERE id = v_target_id;

    RETURN jsonb_build_object(
        'target_beatmap_id', v_target_id,
        'moved_votes', v_local_votes,
        'duplicate_votes', v_duplicate_votes
    );
END;
$$;

REVOKE ALL ON FUNCTION promote_local_beatmap(
    INTEGER, INTEGER, INTEGER, TEXT, TEXT, TEXT, TEXT, TEXT, INTEGER, TEXT
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION promote_local_beatmap(
    INTEGER, INTEGER, INTEGER, TEXT, TEXT, TEXT, TEXT, TEXT, INTEGER, TEXT
) TO service_role;
