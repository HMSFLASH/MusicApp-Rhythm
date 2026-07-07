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
public interface FavoriteRepository extends JpaRepository<Favorite, Long> {
    List<Favorite> findByUserId(Long userId);
    
    @Query("SELECT f FROM Favorite f JOIN FETCH f.musicLibrary WHERE f.user.id = :userId")
    List<Favorite> findByUserIdWithMusicLibrary(@Param("userId") Long userId);

    Optional<Favorite> findByUserIdAndMusicLibraryId(Long userId, Long musicLibraryId);
    boolean existsByUserIdAndMusicLibraryId(Long userId, Long musicLibraryId);
    
    @Transactional
    void deleteByUserIdAndMusicLibraryId(Long userId, Long musicLibraryId);
}
