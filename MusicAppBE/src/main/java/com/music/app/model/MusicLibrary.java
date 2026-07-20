package com.music.app.model;

import java.time.LocalDateTime;

import jakarta.persistence.*;

import org.hibernate.annotations.CreationTimestamp;

import lombok.*;

@Entity
@Table(
        name = "music_library",
        indexes = {
            @Index(name = "idx_user_id", columnList = "user_id"),
            @Index(name = "idx_drive_file_id", columnList = "drive_file_id"),
            @Index(name = "idx_name", columnList = "name")
        },
        uniqueConstraints =
                @UniqueConstraint(
                        name = "uk_music_library_user_drive_file",
                        columnNames = {"user_id", "drive_file_id"}))
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class MusicLibrary {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private String id;

    /** Tên gốc của file */
    private String name;

    @Column(name = "drive_file_id")
    private String driveFileId;

    @Column(name = "source_type")
    private String sourceType;

    @Builder.Default
    @Column(name = "play_count", nullable = false)
    private Long playCount = 0L;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id")
    private User user;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;
}
