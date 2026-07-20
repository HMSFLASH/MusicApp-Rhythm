package com.music.app.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import com.music.app.model.PlaylistItem;

@Repository
public interface PlaylistItemRepository extends JpaRepository<PlaylistItem, String> {

    @Modifying
    @Query("DELETE FROM PlaylistItem pi WHERE pi.playlist.id = :playlistId AND pi.musicLibrary.id = :musicLibraryId")
    void deleteByPlaylistIdAndMusicLibraryId(String playlistId, String musicLibraryId);

    @Modifying
    @Query(
            "DELETE FROM PlaylistItem pi WHERE pi.playlist.id = :playlistId AND pi.musicLibrary.driveFileId = :driveFileId")
    void deleteByPlaylistIdAndDriveFileId(String playlistId, String driveFileId);

    boolean existsByPlaylistIdAndMusicLibraryId(String playlistId, String musicLibraryId);

    @Query("SELECT COALESCE(MAX(pi.position), -1) FROM PlaylistItem pi WHERE pi.playlist.id = :playlistId")
    int getMaxPosition(String playlistId);
}
