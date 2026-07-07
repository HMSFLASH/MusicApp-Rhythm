package com.music.app.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.music.app.dto.ApiResponse;
import com.music.app.dto.BackupDataDto;
import com.music.app.dto.BackupRequest;
import com.music.app.dto.MusicItemDto;
import com.music.app.dto.PlaylistDto;
import com.music.app.exception.AppException;
import com.music.app.exception.ErrorCode;
import com.music.app.model.MusicLibrary;
import com.music.app.model.Playlist;
import com.music.app.model.PlaylistItem;
import com.music.app.model.User;
import com.music.app.model.Favorite;
import com.music.app.repository.MusicLibraryRepository;
import com.music.app.repository.PlaylistRepository;
import com.music.app.repository.UserRepository;
import com.music.app.repository.FavoriteRepository;
import com.music.app.service.GoogleDriveService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.*;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;

import java.security.Principal;
import java.util.List;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/backup")
@RequiredArgsConstructor
@Slf4j
public class BackupController {

    private final PlaylistRepository playlistRepository;
    private final MusicLibraryRepository musicLibraryRepository;
    private final UserRepository userRepository;
    private final FavoriteRepository favoriteRepository;
    private final GoogleDriveService googleDriveService;
    private final ObjectMapper objectMapper = new ObjectMapper()
        .registerModule(new com.fasterxml.jackson.datatype.jsr310.JavaTimeModule())
        .disable(com.fasterxml.jackson.databind.SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);

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

    private PlaylistDto toDto(Playlist p) {
        List<MusicItemDto> tracks = p.getItems().stream()
                .map(i -> libToDto(i.getMusicLibrary()))
                .collect(Collectors.toList());

        return PlaylistDto.builder()
                .id(p.getId())
                .name(p.getName())
                .description(p.getDescription())
                .imageUrl(p.getImageUrl())
                .trackCount(p.getItems().size())
                .createdAt(p.getCreatedAt())
                .tracks(tracks)
                .build();
    }

    @PostMapping("/drive")
    public ApiResponse<String> backupToDrive(@RequestBody BackupRequest request, Principal principal) {
        Long userId = extractUserId(principal);
        if (userId == null) throw new AppException(ErrorCode.UNAUTHENTICATED);

        User user = userRepository.findById(userId).orElseThrow(() -> new AppException(ErrorCode.UNAUTHENTICATED));
        if (user.getRefreshToken() == null) {
            throw new AppException(ErrorCode.DRIVE_NOT_LINKED);
        }

        try {
            // Fetch all playlists
            List<Playlist> playlists = playlistRepository.findByUserIdOrderByCreatedAtDesc(userId);
            List<PlaylistDto> playlistDtos = playlists.stream().map(this::toDto).collect(Collectors.toList());

            // Fetch all favorites
            List<Favorite> favorites = favoriteRepository.findByUserId(userId);
            List<MusicItemDto> favoriteDtos = favorites.stream()
                .map(f -> libToDto(f.getMusicLibrary()))
                .collect(Collectors.toList());

            BackupDataDto backupData = new BackupDataDto();
            backupData.setConfig(request.getConfig());
            backupData.setPlaylists(playlistDtos);
            backupData.setFavorites(favoriteDtos);

            String jsonData = objectMapper.writeValueAsString(backupData);
            
            googleDriveService.uploadJsonFile(jsonData, "musicapp_backup.json", user.getRefreshToken());

            return ApiResponse.<String>builder()
                    .result("Backup successful")
                    .build();
        } catch (Exception e) {
            log.error("Backup failed", e);
            throw new AppException(ErrorCode.BACKUP_FAILED);
        }
    }

    @GetMapping("/drive")
    public ApiResponse<java.util.Map<String, Object>> restoreFromDrive(Principal principal) {
        Long userId = extractUserId(principal);
        if (userId == null) throw new AppException(ErrorCode.UNAUTHENTICATED);

        User user = userRepository.findById(userId).orElseThrow(() -> new AppException(ErrorCode.UNAUTHENTICATED));
        if (user.getRefreshToken() == null) {
            throw new AppException(ErrorCode.DRIVE_NOT_LINKED);
        }

        try {
            String jsonData = googleDriveService.downloadJsonFile("musicapp_backup.json", user.getRefreshToken());
            if (jsonData == null) {
                throw new AppException(ErrorCode.BACKUP_NOT_FOUND);
            }

            BackupDataDto backupData = objectMapper.readValue(jsonData, BackupDataDto.class);

            // Restore playlists
            if (backupData.getPlaylists() != null) {
                // Delete existing playlists
                List<Playlist> existing = playlistRepository.findByUserIdOrderByCreatedAtDesc(userId);
                playlistRepository.deleteAll(existing);

                // Create new ones
                for (PlaylistDto pDto : backupData.getPlaylists()) {
                    Playlist playlist = Playlist.builder()
                            .name(pDto.getName())
                            .description(pDto.getDescription())
                            .imageUrl(pDto.getImageUrl())
                            .user(user)
                            .build();

                    playlist = playlistRepository.save(playlist);

                    if (pDto.getTracks() != null) {
                        for (int i = 0; i < pDto.getTracks().size(); i++) {
                            MusicItemDto trackDto = pDto.getTracks().get(i);
                            String trackIdStr = trackDto.getId();
                            if (trackIdStr == null) continue;
                            
                            MusicLibrary lib = null;
                            if (trackIdStr.matches("\\d+")) {
                                lib = musicLibraryRepository.findById(Long.valueOf(trackIdStr)).orElse(null);
                            } else {
                                lib = musicLibraryRepository.findByDriveFileId(trackIdStr).orElse(null);
                                if (lib == null) {
                                    lib = musicLibraryRepository.save(MusicLibrary.builder()
                                            .name(trackDto.getTitle() != null ? trackDto.getTitle() : "Drive File")
                                            .driveFileId(trackIdStr)
                                            .sourceType("DRIVE")
                                            .user(user)
                                            .build());
                                }
                            }
                            if (lib != null) {
                                PlaylistItem item = PlaylistItem.builder()
                                        .playlist(playlist)
                                        .musicLibrary(lib)
                                        .position(i)
                                        .build();
                                playlist.getItems().add(item);
                            }
                        }
                    }
                    playlistRepository.save(playlist);
                }
            }

            // Restore favorites
            if (backupData.getFavorites() != null) {
                // Delete existing favorites
                List<Favorite> existingFavorites = favoriteRepository.findByUserId(userId);
                favoriteRepository.deleteAll(existingFavorites);

                // Create new ones
                for (MusicItemDto trackDto : backupData.getFavorites()) {
                    String trackIdStr = trackDto.getId();
                    if (trackIdStr == null) continue;

                    MusicLibrary lib = null;
                    if (trackIdStr.matches("\\d+")) {
                        lib = musicLibraryRepository.findById(Long.valueOf(trackIdStr)).orElse(null);
                    } else {
                        lib = musicLibraryRepository.findByDriveFileId(trackIdStr).orElse(null);
                        if (lib == null) {
                            lib = musicLibraryRepository.save(MusicLibrary.builder()
                                    .name(trackDto.getTitle() != null ? trackDto.getTitle() : "Drive File")
                                    .driveFileId(trackIdStr)
                                    .sourceType("DRIVE")
                                    .user(user)
                                    .build());
                        }
                    }

                    if (lib != null) {
                        Favorite fav = Favorite.builder()
                                .user(user)
                                .musicLibrary(lib)
                                .build();
                        favoriteRepository.save(fav);
                    }
                }
            }

            return ApiResponse.<java.util.Map<String, Object>>builder()
                    .result(backupData.getConfig())
                    .build();
        } catch (AppException e) {
            throw e;
        } catch (Exception e) {
            log.error("Restore failed", e);
            throw new AppException(ErrorCode.RESTORE_FAILED);
        }
    }
}
