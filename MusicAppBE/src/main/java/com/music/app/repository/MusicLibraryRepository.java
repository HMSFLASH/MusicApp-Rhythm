package com.music.app.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.music.app.model.MusicLibrary;

@Repository
public interface MusicLibraryRepository extends JpaRepository<MusicLibrary, String> {
    List<MusicLibrary> findBySourceType(String sourceType);

    List<MusicLibrary> findByUserIdAndSourceType(String userId, String sourceType);

    List<MusicLibrary> findByUserId(String userId);

    java.util.Optional<MusicLibrary> findByIdAndUserId(String id, String userId);

    java.util.Optional<MusicLibrary> findByDriveFileIdAndUserId(String driveFileId, String userId);

    java.util.Optional<MusicLibrary> findByDriveFileId(String driveFileId);
}
