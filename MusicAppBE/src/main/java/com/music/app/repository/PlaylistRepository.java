package com.music.app.repository;

import com.music.app.model.Playlist;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface PlaylistRepository extends JpaRepository<Playlist, Long> {
    List<Playlist> findByUserIdOrderByCreatedAtDesc(Long userId);
    
    Optional<Playlist> findByIdAndUserId(Long id, Long userId);

    @Query("SELECT p FROM Playlist p LEFT JOIN FETCH p.items i LEFT JOIN FETCH i.musicLibrary WHERE p.id = :id AND p.user.id = :userId")
    Optional<Playlist> findByIdAndUserIdWithItems(@Param("id") Long id, @Param("userId") Long userId);
}
