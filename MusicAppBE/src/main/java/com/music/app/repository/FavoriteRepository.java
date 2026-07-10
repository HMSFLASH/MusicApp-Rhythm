package com.music.app.repository;

import com.music.app.model.Favorite;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

@Repository
public interface FavoriteRepository extends JpaRepository<Favorite, String> {
    List<Favorite> findByUserId(String userId);
    
    @Query("SELECT f FROM Favorite f JOIN FETCH f.musicLibrary WHERE f.user.id = :userId")
    List<Favorite> findByUserIdWithMusicLibrary(@Param("userId") String userId);

    Optional<Favorite> findByUserIdAndMusicLibraryId(String userId, String musicLibraryId);
    boolean existsByUserIdAndMusicLibraryId(String userId, String musicLibraryId);
    
    @Transactional
    void deleteByUserIdAndMusicLibraryId(String userId, String musicLibraryId);
}
