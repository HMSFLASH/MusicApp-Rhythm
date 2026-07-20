package com.music.app.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import com.music.app.model.Favorite;

@Repository
public interface FavoriteRepository extends JpaRepository<Favorite, String> {
    List<Favorite> findByUserId(String userId);

    @Query("SELECT f FROM Favorite f JOIN FETCH f.musicLibrary WHERE f.user.id = :userId")
    List<Favorite> findByUserIdWithMusicLibrary(@Param("userId") String userId);

    Optional<Favorite> findByUserIdAndMusicLibraryId(String userId, String musicLibraryId);

    boolean existsByUserIdAndMusicLibraryId(String userId, String musicLibraryId);

    @Modifying
    @Query(
            value =
                    "INSERT IGNORE INTO favorites (id, user_id, music_library_id, created_at) VALUES (:id, :userId, :musicLibraryId, CURRENT_TIMESTAMP)",
            nativeQuery = true)
    int insertIgnore(
            @Param("id") String id, @Param("userId") String userId, @Param("musicLibraryId") String musicLibraryId);

    @Transactional
    void deleteByUserIdAndMusicLibraryId(String userId, String musicLibraryId);
}
