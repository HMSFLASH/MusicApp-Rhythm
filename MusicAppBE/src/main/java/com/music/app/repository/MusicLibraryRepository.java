package com.music.app.repository;

import com.music.app.model.MusicLibrary;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface MusicLibraryRepository extends JpaRepository<MusicLibrary, Long> {
    List<MusicLibrary> findBySourceType(String sourceType);
    List<MusicLibrary> findByUserIdAndSourceType(Long userId, String sourceType);
    List<MusicLibrary> findByNameContainingIgnoreCase(String query);
    List<MusicLibrary> findByUserId(Long userId);
    java.util.Optional<MusicLibrary> findByDriveFileId(String driveFileId);
}
