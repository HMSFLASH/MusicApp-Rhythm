package com.music.app.controller;

import com.music.app.dto.MusicItemDto;
import com.music.app.model.Favorite;
import com.music.app.model.MusicLibrary;
import com.music.app.model.User;
import com.music.app.repository.FavoriteRepository;
import com.music.app.repository.MusicLibraryRepository;
import com.music.app.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;
import java.util.List;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/favorites")
@RequiredArgsConstructor
@Slf4j
public class FavoriteController {

    private final FavoriteRepository favoriteRepository;
    private final MusicLibraryRepository musicLibraryRepository;
    private final UserRepository userRepository;

    private Long extractUserId(Principal principal) {
        if (!(principal instanceof JwtAuthenticationToken)) return null;
        String uid = ((JwtAuthenticationToken) principal).getToken().getClaimAsString("userId");
        return uid != null ? Long.valueOf(uid) : null;
    }

    private MusicItemDto toDto(MusicLibrary lib) {
        return MusicItemDto.builder()
                .id(lib.getId().toString())
                .name(lib.getName())
                .title(lib.getTitle())
                .artist(lib.getArtist())
                .album(lib.getAlbum())
                .genre(lib.getGenre())
                .imageUrl(lib.getImageUrl())
                .durationSeconds(lib.getDurationSeconds())
                .sourceType(lib.getSourceType())
                .build();
    }

    /** GET /api/favorites — Lấy danh sách yêu thích của user */
    @GetMapping
    public ResponseEntity<List<MusicItemDto>> getFavorites(Principal principal) {
        Long userId = extractUserId(principal);
        if (userId == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();

        List<MusicItemDto> result = favoriteRepository.findByUserIdWithMusicLibrary(userId).stream()
                .map(fav -> toDto(fav.getMusicLibrary()))
                .collect(Collectors.toList());

        return ResponseEntity.ok(result);
    }

    /** POST /api/favorites/{trackId} — Thêm vào yêu thích */
    @PostMapping("/{trackId}")
    public ResponseEntity<?> addFavorite(@PathVariable Long trackId, Principal principal) {
        Long userId = extractUserId(principal);
        if (userId == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();

        if (favoriteRepository.existsByUserIdAndMusicLibraryId(userId, trackId)) {
            return ResponseEntity.ok("Already in favorites");
        }

        User user = userRepository.findById(userId).orElse(null);
        MusicLibrary lib = musicLibraryRepository.findById(trackId).orElse(null);
        if (user == null || lib == null) return ResponseEntity.notFound().build();

        favoriteRepository.save(Favorite.builder().user(user).musicLibrary(lib).build());
        return ResponseEntity.status(HttpStatus.CREATED).body("Added to favorites");
    }

    /** DELETE /api/favorites/{trackId} — Xóa khỏi yêu thích */
    @DeleteMapping("/{trackId}")
    public ResponseEntity<?> removeFavorite(@PathVariable Long trackId, Principal principal) {
        Long userId = extractUserId(principal);
        if (userId == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();

        favoriteRepository.deleteByUserIdAndMusicLibraryId(userId, trackId);
        return ResponseEntity.ok("Removed from favorites");
    }

    /** GET /api/favorites/check/{trackId} — Kiểm tra đã yêu thích chưa */
    @GetMapping("/check/{trackId}")
    public ResponseEntity<Boolean> checkFavorite(@PathVariable Long trackId, Principal principal) {
        Long userId = extractUserId(principal);
        if (userId == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();

        return ResponseEntity.ok(favoriteRepository.existsByUserIdAndMusicLibraryId(userId, trackId));
    }
}
