CREATE TABLE roles (
    id VARCHAR(36) NOT NULL,
    name VARCHAR(255) NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT uk_roles_name UNIQUE (name)
) ENGINE=InnoDB;

CREATE TABLE permissions (
    id VARCHAR(36) NOT NULL,
    name VARCHAR(255) NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT uk_permissions_name UNIQUE (name)
) ENGINE=InnoDB;

CREATE TABLE users (
    id VARCHAR(36) NOT NULL,
    google_id VARCHAR(255) NULL,
    username VARCHAR(255) NULL,
    password VARCHAR(255) NULL,
    email VARCHAR(255) NULL,
    refresh_token LONGTEXT NULL,
    full_name VARCHAR(255) NULL,
    avatar_url LONGTEXT NULL,
    auth_token_version INT NOT NULL DEFAULT 0,
    role_id VARCHAR(36) NULL,
    PRIMARY KEY (id),
    CONSTRAINT uk_users_google_id UNIQUE (google_id),
    CONSTRAINT uk_users_username UNIQUE (username),
    CONSTRAINT uk_users_email UNIQUE (email),
    CONSTRAINT fk_users_role FOREIGN KEY (role_id) REFERENCES roles (id)
) ENGINE=InnoDB;

CREATE TABLE role_permissions (
    role_id VARCHAR(36) NOT NULL,
    permission_id VARCHAR(36) NOT NULL,
    PRIMARY KEY (role_id, permission_id),
    CONSTRAINT fk_role_permissions_role FOREIGN KEY (role_id) REFERENCES roles (id),
    CONSTRAINT fk_role_permissions_permission FOREIGN KEY (permission_id) REFERENCES permissions (id)
) ENGINE=InnoDB;

CREATE TABLE music_library (
    id VARCHAR(36) NOT NULL,
    name VARCHAR(255) NULL,
    title VARCHAR(255) NULL,
    artist VARCHAR(255) NULL,
    album VARCHAR(255) NULL,
    genre VARCHAR(255) NULL,
    image_url LONGTEXT NULL,
    lyrics LONGTEXT NULL,
    duration_seconds BIGINT NULL,
    drive_file_id VARCHAR(255) NULL,
    source_type VARCHAR(32) NULL,
    user_id VARCHAR(36) NULL,
    created_at DATETIME(6) NULL,
    PRIMARY KEY (id),
    CONSTRAINT uk_music_library_user_drive_file UNIQUE (user_id, drive_file_id),
    KEY idx_user_id (user_id),
    KEY idx_drive_file_id (drive_file_id),
    KEY idx_name (name),
    CONSTRAINT fk_music_library_user FOREIGN KEY (user_id) REFERENCES users (id)
) ENGINE=InnoDB;

CREATE TABLE playlists (
    id VARCHAR(36) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description VARCHAR(255) NULL,
    image_url LONGTEXT NULL,
    user_id VARCHAR(36) NOT NULL,
    created_at DATETIME(6) NULL,
    PRIMARY KEY (id),
    KEY idx_playlists_user_id (user_id),
    CONSTRAINT fk_playlists_user FOREIGN KEY (user_id) REFERENCES users (id)
) ENGINE=InnoDB;

CREATE TABLE playlist_items (
    id VARCHAR(36) NOT NULL,
    playlist_id VARCHAR(36) NOT NULL,
    music_library_id VARCHAR(36) NOT NULL,
    position INT NOT NULL DEFAULT 0,
    PRIMARY KEY (id),
    CONSTRAINT uk_playlist_music UNIQUE (playlist_id, music_library_id),
    CONSTRAINT fk_playlist_items_playlist FOREIGN KEY (playlist_id) REFERENCES playlists (id) ON DELETE CASCADE,
    CONSTRAINT fk_playlist_items_music FOREIGN KEY (music_library_id) REFERENCES music_library (id)
) ENGINE=InnoDB;

CREATE TABLE favorites (
    id VARCHAR(36) NOT NULL,
    user_id VARCHAR(36) NOT NULL,
    music_library_id VARCHAR(36) NOT NULL,
    created_at DATETIME(6) NULL,
    PRIMARY KEY (id),
    CONSTRAINT uk_favorites_user_music UNIQUE (user_id, music_library_id),
    CONSTRAINT fk_favorites_user FOREIGN KEY (user_id) REFERENCES users (id),
    CONSTRAINT fk_favorites_music FOREIGN KEY (music_library_id) REFERENCES music_library (id)
) ENGINE=InnoDB;

CREATE TABLE password_reset_tokens (
    id VARCHAR(36) NOT NULL,
    token VARCHAR(255) NOT NULL,
    user_id VARCHAR(36) NOT NULL,
    expiry_date DATETIME(6) NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT uk_password_reset_token UNIQUE (token),
    KEY idx_password_reset_user (user_id),
    CONSTRAINT fk_password_reset_user FOREIGN KEY (user_id) REFERENCES users (id)
) ENGINE=InnoDB;

CREATE TABLE invalidated_tokens (
    id VARCHAR(255) NOT NULL,
    expiry_time DATETIME(6) NULL,
    PRIMARY KEY (id),
    KEY idx_invalidated_expiry (expiry_time)
) ENGINE=InnoDB;
