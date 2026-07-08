package com.music.app.repository;

import com.music.app.model.PlaylistItem;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

@Repository
public interface PlaylistItemRepository extends JpaRepository<PlaylistItem, Long> {

    @Modifying
    @Query("DELETE FROM PlaylistItem pi WHERE pi.playlist.id = :playlistId AND pi.musicLibrary.id = :musicLibraryId")
    void deleteByPlaylistIdAndMusicLibraryId(Long playlistId, Long musicLibraryId);

    @Modifying
    @Query("DELETE FROM PlaylistItem pi WHERE pi.playlist.id = :playlistId AND pi.musicLibrary.driveFileId = :driveFileId")
    void deleteByPlaylistIdAndDriveFileId(Long playlistId, String driveFileId);

    boolean existsByPlaylistIdAndMusicLibraryId(Long playlistId, Long musicLibraryId);

    @Query("SELECT COALESCE(MAX(pi.position), -1) FROM PlaylistItem pi WHERE pi.playlist.id = :playlistId")
    int getMaxPosition(Long playlistId);
}
