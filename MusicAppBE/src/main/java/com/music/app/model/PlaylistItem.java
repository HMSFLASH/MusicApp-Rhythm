package com.music.app.model;

import jakarta.persistence.*;

import org.hibernate.annotations.NotFound;
import org.hibernate.annotations.NotFoundAction;

import lombok.*;

@Entity
@Table(
        name = "playlist_items",
        uniqueConstraints = @UniqueConstraint(columnNames = {"playlist_id", "music_library_id"}))
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PlaylistItem {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private String id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "playlist_id", nullable = false)
    private Playlist playlist;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "music_library_id", nullable = false)
    @NotFound(action = NotFoundAction.IGNORE)
    private MusicLibrary musicLibrary;

    @Column(nullable = false)
    @Builder.Default
    private Integer position = 0;
}
