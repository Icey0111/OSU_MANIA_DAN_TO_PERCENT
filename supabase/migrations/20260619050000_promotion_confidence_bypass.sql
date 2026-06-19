-- Promotions preserve historical votes, including votes that predate the
-- confidence policy. Wrap the audited promotion RPC with a transaction-local
-- bypass; ordinary service-role writes cannot set this through the API.
DO $$
BEGIN
    IF to_regprocedure('promote_local_beatmap_preserving_history(integer,integer,integer,text,text,text,text,text,integer,text)') IS NULL THEN
        ALTER FUNCTION promote_local_beatmap(
            INTEGER, INTEGER, INTEGER, TEXT, TEXT, TEXT, TEXT, TEXT, INTEGER, TEXT
        ) RENAME TO promote_local_beatmap_preserving_history;
    END IF;
END;
$$;

REVOKE ALL ON FUNCTION promote_local_beatmap_preserving_history(
    INTEGER, INTEGER, INTEGER, TEXT, TEXT, TEXT, TEXT, TEXT, INTEGER, TEXT
) FROM PUBLIC, anon, authenticated, service_role;

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
    v_result JSONB;
BEGIN
    PERFORM set_config('app.bypass_vote_confidence', 'on', TRUE);
    SELECT promote_local_beatmap_preserving_history(
        p_local_beatmap_id,
        p_official_beatmap_id,
        p_beatmapset_id,
        p_artist,
        p_title,
        p_version,
        p_creator,
        p_official_file_checksum,
        p_promoted_by,
        p_match_method
    ) INTO v_result;
    PERFORM set_config('app.bypass_vote_confidence', 'off', TRUE);
    RETURN v_result;
EXCEPTION WHEN OTHERS THEN
    PERFORM set_config('app.bypass_vote_confidence', 'off', TRUE);
    RAISE;
END;
$$;

REVOKE ALL ON FUNCTION promote_local_beatmap(
    INTEGER, INTEGER, INTEGER, TEXT, TEXT, TEXT, TEXT, TEXT, INTEGER, TEXT
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION promote_local_beatmap(
    INTEGER, INTEGER, INTEGER, TEXT, TEXT, TEXT, TEXT, TEXT, INTEGER, TEXT
) TO service_role;
