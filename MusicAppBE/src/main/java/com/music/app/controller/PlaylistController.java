package com.music.app.controller;

import com.music.app.dto.CreatePlaylistRequest;
import com.music.app.dto.MusicItemDto;
import com.music.app.dto.PlaylistDto;
import com.music.app.model.MusicLibrary;
import com.music.app.model.Playlist;
import com.music.app.model.PlaylistItem;
import com.music.app.model.User;
import com.music.app.repository.MusicLibraryRepository;
import com.music.app.repository.PlaylistRepository;
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
@RequestMapping("/api/playlists")
@RequiredArgsConstructor
@Slf4j
public class PlaylistController {

    private final PlaylistRepository playlistRepository;
    private final MusicLibraryRepository musicLibraryRepository;
    private final UserRepository userRepository;

    private Long extractUserId(Principal principal) {
        if (!(principal instanceof JwtAuthenticationToken)) return null;
        String uid = ((JwtAuthenticationToken) principal).getToken().getClaimAsString("userId");
        return uid != null ? Long.valueOf(uid) : null;
    }

    private MusicItemDto libToDto(MusicLibrary lib) {
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

    private PlaylistDto toDto(Playlist p, boolean includeTracks) {
        List<MusicItemDto> tracks = includeTracks
                ? p.getItems().stream().map(i -> libToDto(i.getMusicLibrary())).collect(Collectors.toList())
                : null;

        return PlaylistDto.builder()
                .id(p.getId())
                .name(p.getName())
                .description(p.getDescription())
                .imageUrl(p.getImageUrl())
                .trackCount(p.getTrackCount() != null ? p.getTrackCount() : 0)
                .createdAt(p.getCreatedAt())
                .tracks(tracks)
                .build();
    }

    /** GET /api/playlists — Lấy danh sách playlist của user */
    @GetMapping
    public ResponseEntity<List<PlaylistDto>> getPlaylists(Principal principal) {
        Long userId = extractUserId(principal);
        if (userId == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();

        List<PlaylistDto> result = playlistRepository.findByUserIdOrderByCreatedAtDesc(userId)
                .stream().map(p -> toDto(p, false)).collect(Collectors.toList());

        return ResponseEntity.ok(result);
    }

    /** GET /api/playlists/{id} — Chi tiết playlist (kèm tracks) */
    @GetMapping("/{id}")
    public ResponseEntity<PlaylistDto> getPlaylist(@PathVariable Long id, Principal principal) {
        Long userId = extractUserId(principal);
        if (userId == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();

        return playlistRepository.findByIdAndUserIdWithItems(id, userId)
                .map(p -> ResponseEntity.ok(toDto(p, true)))
                .orElse(ResponseEntity.notFound().build());
    }

    /** POST /api/playlists — Tạo playlist mới */
    @PostMapping
    public ResponseEntity<PlaylistDto> createPlaylist(@RequestBody CreatePlaylistRequest req, Principal principal) {
        Long userId = extractUserId(principal);
        if (userId == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();

        User user = userRepository.findById(userId).orElse(null);
        if (user == null) return ResponseEntity.status(HttpStatus.FORBIDDEN).build();

        Playlist playlist = Playlist.builder()
                .name(req.getName())
                .description(req.getDescription())
                .imageUrl(req.getImageUrl())
                .user(user)
                .build();

        playlist = playlistRepository.save(playlist);
        return ResponseEntity.status(HttpStatus.CREATED).body(toDto(playlist, true));
    }

    /** PUT /api/playlists/{id} — Sửa tên/mô tả playlist */
    @PutMapping("/{id}")
    public ResponseEntity<PlaylistDto> updatePlaylist(@PathVariable Long id,
                                                       @RequestBody CreatePlaylistRequest req,
                                                       Principal principal) {
        Long userId = extractUserId(principal);
        if (userId == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();

        return playlistRepository.findByIdAndUserId(id, userId).map(p -> {
            if (req.getName() != null) p.setName(req.getName());
            if (req.getDescription() != null) p.setDescription(req.getDescription());
            if (req.getImageUrl() != null) p.setImageUrl(req.getImageUrl());
            return ResponseEntity.ok(toDto(playlistRepository.save(p), false));
        }).orElse(ResponseEntity.notFound().build());
    }

    /** DELETE /api/playlists/{id} — Xóa playlist */
    @DeleteMapping("/{id}")
    public ResponseEntity<?> deletePlaylist(@PathVariable Long id, Principal principal) {
        Long userId = extractUserId(principal);
        if (userId == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();

        return playlistRepository.findByIdAndUserId(id, userId).map(p -> {
            playlistRepository.delete(p);
            return ResponseEntity.ok("Deleted");
        }).orElse(ResponseEntity.notFound().build());
    }

    /** POST /api/playlists/{id}/tracks/{trackId} — Thêm track vào playlist */
    @PostMapping("/{id}/tracks/{trackId}")
    public ResponseEntity<?> addTrack(@PathVariable Long id, @PathVariable String trackId, @RequestParam(required = false) String name, Principal principal) {
        Long userId = extractUserId(principal);
        if (userId == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();

        return playlistRepository.findByIdAndUserId(id, userId).map(p -> {
            MusicLibrary lib = null;
            if (trackId.matches("\\d+")) {
                lib = musicLibraryRepository.findById(Long.valueOf(trackId)).orElse(null);
            } else {
                lib = musicLibraryRepository.findByDriveFileId(trackId).orElse(null);
                if (lib == null) {
                    User user = userRepository.findById(userId).orElse(null);
                    lib = musicLibraryRepository.save(MusicLibrary.builder()
                            .name(name != null ? name : "Drive File")
                            .driveFileId(trackId)
                            .sourceType("DRIVE")
                            .user(user)
                            .build());
                }
            }
            if (lib == null) return ResponseEntity.notFound().<String>build();

            final Long finalLibId = lib.getId();
            boolean exists = p.getItems().stream()
                    .anyMatch(i -> i.getMusicLibrary().getId().equals(finalLibId));
            if (exists) return ResponseEntity.ok("Already in playlist");

            int pos = p.getItems().size();
            PlaylistItem item = PlaylistItem.builder()
                    .playlist(p).musicLibrary(lib).position(pos).build();
            p.getItems().add(item);
            playlistRepository.save(p);
            return ResponseEntity.status(HttpStatus.CREATED).body("Added");
        }).orElse(ResponseEntity.notFound().build());
    }

    /** DELETE /api/playlists/{id}/tracks/{trackId} — Xóa track khỏi playlist */
    @DeleteMapping("/{id}/tracks/{trackId}")
    public ResponseEntity<?> removeTrack(@PathVariable Long id, @PathVariable String trackId, Principal principal) {
        Long userId = extractUserId(principal);
        if (userId == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();

        return playlistRepository.findByIdAndUserId(id, userId).map(p -> {
            if (trackId.matches("\\d+")) {
                p.getItems().removeIf(i -> i.getMusicLibrary().getId().equals(Long.valueOf(trackId)));
            } else {
                p.getItems().removeIf(i -> trackId.equals(i.getMusicLibrary().getDriveFileId()));
            }
            // Re-assign positions
            for (int i = 0; i < p.getItems().size(); i++) {
                p.getItems().get(i).setPosition(i);
            }
            playlistRepository.save(p);
            return ResponseEntity.ok("Removed");
        }).orElse(ResponseEntity.notFound().build());
    }
}
