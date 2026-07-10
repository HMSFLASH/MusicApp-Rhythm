package com.music.app.repository;

import com.music.app.model.MusicLibrary;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface MusicLibraryRepository extends JpaRepository<MusicLibrary, String> {
    List<MusicLibrary> findBySourceType(String sourceType);
    List<MusicLibrary> findByUserIdAndSourceType(String userId, String sourceType);

    List<MusicLibrary> findByUserId(String userId);
    java.util.Optional<MusicLibrary> findByIdAndUserId(String id, String userId);
    java.util.Optional<MusicLibrary> findByDriveFileIdAndUserId(String driveFileId, String userId);
    java.util.Optional<MusicLibrary> findByDriveFileId(String driveFileId);
}
