ALTER TABLE music_library
    ADD COLUMN play_count BIGINT NOT NULL DEFAULT 0;

CREATE INDEX idx_music_library_user_play_count
    ON music_library (user_id, play_count);
