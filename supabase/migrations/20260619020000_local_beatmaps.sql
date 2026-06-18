-- Adds checksum-addressed local/unsubmitted beatmaps without changing existing
-- official beatmap IDs or vote foreign keys.
ALTER TABLE beatmaps
    ALTER COLUMN osu_beatmap_id DROP NOT NULL,
    ALTER COLUMN beatmapset_id DROP NOT NULL;

ALTER TABLE beatmaps
    ADD COLUMN IF NOT EXISTS source_type VARCHAR(8) NOT NULL DEFAULT 'osu',
    ADD COLUMN IF NOT EXISTS file_checksum CHAR(32),
    ADD COLUMN IF NOT EXISTS checksum_algorithm VARCHAR(8),
    ADD COLUMN IF NOT EXISTS mode SMALLINT NOT NULL DEFAULT 3;

ALTER TABLE beatmaps
    DROP CONSTRAINT IF EXISTS beatmaps_source_identity_check;

ALTER TABLE beatmaps
    ADD CONSTRAINT beatmaps_source_identity_check CHECK (
        (
            source_type = 'osu'
            AND osu_beatmap_id IS NOT NULL
            AND osu_beatmap_id > 0
            AND beatmapset_id IS NOT NULL
            AND beatmapset_id > 0
            AND file_checksum IS NULL
            AND checksum_algorithm IS NULL
        )
        OR
        (
            source_type = 'local'
            AND osu_beatmap_id IS NULL
            AND beatmapset_id IS NULL
            AND file_checksum ~ '^[0-9a-f]{32}$'
            AND checksum_algorithm = 'md5'
        )
    );

CREATE UNIQUE INDEX IF NOT EXISTS idx_beatmaps_file_checksum
    ON beatmaps(file_checksum);

CREATE INDEX IF NOT EXISTS idx_beatmaps_source_type
    ON beatmaps(source_type);

