-- Enforce the confidence boundary at the database layer. The API performs the
-- same check for a friendly response, while this trigger closes concurrency
-- and non-standard-client gaps.
CREATE OR REPLACE FUNCTION enforce_vote_confidence_range()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_total INTEGER := 0;
    v_leader_votes INTEGER := 0;
    v_runner_up_votes INTEGER := 0;
    v_leader_order INTEGER;
    v_vote_order INTEGER;
BEGIN
    IF current_setting('app.bypass_vote_confidence', TRUE) = 'on' THEN
        RETURN NEW;
    END IF;

    WITH rank_counts AS (
        SELECT
            dan_level,
            COUNT(*)::INTEGER AS vote_count,
            CASE dan_level
                WHEN '1' THEN 1 WHEN '2' THEN 2 WHEN '3' THEN 3
                WHEN '4' THEN 4 WHEN '5' THEN 5 WHEN '6' THEN 6
                WHEN '7' THEN 7 WHEN '8' THEN 8 WHEN '9' THEN 9
                WHEN '10' THEN 10 WHEN 'α' THEN 11 WHEN 'β' THEN 12
                WHEN 'γ' THEN 13 WHEN 'δ' THEN 14 WHEN 'ε' THEN 15
                WHEN 'ζ' THEN 16 WHEN 'η' THEN 17
            END AS rank_order
        FROM votes
        WHERE beatmap_id = NEW.beatmap_id
          AND user_id <> NEW.user_id
        GROUP BY dan_level
    ), ranked AS (
        SELECT *, ROW_NUMBER() OVER (ORDER BY vote_count DESC, rank_order ASC) AS position
        FROM rank_counts
    )
    SELECT
        COALESCE(SUM(vote_count), 0)::INTEGER,
        COALESCE(MAX(vote_count) FILTER (WHERE position = 1), 0),
        COALESCE(MAX(vote_count) FILTER (WHERE position = 2), 0),
        MAX(rank_order) FILTER (WHERE position = 1)
    INTO v_total, v_leader_votes, v_runner_up_votes, v_leader_order
    FROM ranked;

    IF v_total >= 20
       AND v_leader_votes >= 12
       AND v_leader_votes::NUMERIC / v_total >= 0.60
       AND (v_runner_up_votes = 0 OR v_leader_votes::NUMERIC / v_runner_up_votes >= 2.0)
    THEN
        v_vote_order := CASE NEW.dan_level
            WHEN '1' THEN 1 WHEN '2' THEN 2 WHEN '3' THEN 3
            WHEN '4' THEN 4 WHEN '5' THEN 5 WHEN '6' THEN 6
            WHEN '7' THEN 7 WHEN '8' THEN 8 WHEN '9' THEN 9
            WHEN '10' THEN 10 WHEN 'α' THEN 11 WHEN 'β' THEN 12
            WHEN 'γ' THEN 13 WHEN 'δ' THEN 14 WHEN 'ε' THEN 15
            WHEN 'ζ' THEN 16 WHEN 'η' THEN 17
        END;
        IF v_vote_order IS NULL OR ABS(v_vote_order - v_leader_order) > 1 THEN
            RAISE EXCEPTION 'vote_outside_confidence_range'
                USING ERRCODE = '23514';
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_enforce_vote_confidence ON votes;
CREATE TRIGGER trigger_enforce_vote_confidence
    BEFORE INSERT OR UPDATE OF dan_level, beatmap_id, user_id ON votes
    FOR EACH ROW
    EXECUTE FUNCTION enforce_vote_confidence_range();
