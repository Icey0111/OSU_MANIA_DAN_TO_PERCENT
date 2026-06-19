-- Defense-in-depth constraints for values normally validated by the API.
ALTER TABLE votes
    DROP CONSTRAINT IF EXISTS votes_dan_level_check,
    DROP CONSTRAINT IF EXISTS votes_tier_check;

ALTER TABLE votes
    ADD CONSTRAINT votes_dan_level_check CHECK (
        dan_level IN ('1','2','3','4','5','6','7','8','9','10','α','β','γ','δ','ε','ζ','η')
    ),
    ADD CONSTRAINT votes_tier_check CHECK (tier IN ('low','mid','high'));

ALTER TABLE beatmaps
    DROP CONSTRAINT IF EXISTS beatmaps_total_votes_check;
ALTER TABLE beatmaps
    ADD CONSTRAINT beatmaps_total_votes_check CHECK (total_votes >= 0);
