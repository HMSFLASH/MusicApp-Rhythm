package com.music.app.model;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "music_library", indexes = {
    @Index(name = "idx_user_id", columnList = "user_id"),
    @Index(name = "idx_drive_file_id", columnList = "drive_file_id"),
    @Index(name = "idx_name", columnList = "name")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class MusicLibrary {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** Tên gốc của file */
    private String name;

    /** Tiêu đề bài hát (metadata) */
    private String title;

    /** Nghệ sĩ */
    private String artist;

    /** Album */
    private String album;

    /** Thể loại */
    private String genre;

    /** URL hình bìa */
    @Column(name = "image_url", columnDefinition = "TEXT")
    private String imageUrl;

    /** Thời lượng (giây) */
    @Column(name = "duration_seconds")
    private Long durationSeconds;

    @Column(name = "drive_file_id")
    private String driveFileId;

    @Column(name = "source_type")
    private String sourceType; // "TELEGRAM" or "DRIVE"

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id")
    private User user;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;
}
