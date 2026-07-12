package com.music.app.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.music.app.dto.BackupDataDto;
import com.music.app.dto.MusicItemDto;
import com.music.app.dto.PlaylistDto;
import com.music.app.exception.AppException;
import com.music.app.exception.ErrorCode;
import com.music.app.model.Favorite;
import com.music.app.model.MusicLibrary;
import com.music.app.model.Playlist;
import com.music.app.model.PlaylistItem;
import com.music.app.model.User;
import com.music.app.repository.FavoriteRepository;
import com.music.app.repository.MusicLibraryRepository;
import com.music.app.repository.PlaylistRepository;
import com.music.app.repository.UserRepository;

import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

import org.hibernate.ObjectNotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class BackupService {

    private final PlaylistRepository playlistRepository;
    private final MusicLibraryRepository musicLibraryRepository;
    private final UserRepository userRepository;
    private final FavoriteRepository favoriteRepository;
    private final GoogleDriveService googleDriveService;
    private final MusicService musicService;
    private final PlaylistService playlistService;

    private final ObjectMapper objectMapper = new ObjectMapper()
            .registerModule(new com.fasterxml.jackson.datatype.jsr310.JavaTimeModule())
            .disable(com.fasterxml.jackson.databind.SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);

    public void backupToDrive(Map<String, Object> config, Map<String, Object> idbData, String userId) throws org.hibernate.FetchNotFoundException {
        User user = userRepository.findById(userId).orElseThrow(() -> new AppException(ErrorCode.UNAUTHENTICATED));
        if (user.getRefreshToken() == null) {
            throw new AppException(ErrorCode.DRIVE_NOT_LINKED);
        }

        try {
            List<Playlist> playlists = playlistRepository.findByUserIdWithItemsOrderByCreatedAtDesc(userId);
            List<PlaylistDto> playlistDtos = playlists.stream().map(p -> playlistService.toDto(p, true))
                    .collect(Collectors.toList());

            List<Favorite> favorites = favoriteRepository.findByUserIdWithMusicLibrary(userId);
            List<MusicItemDto> favoriteDtos = new java.util.ArrayList<>();
            for (Favorite f : favorites) {
                try {
                    if (f.getMusicLibrary() != null) {
                        favoriteDtos.add(musicService.toDto(f.getMusicLibrary()));
                    }
                } catch (ObjectNotFoundException | EntityNotFoundException e) {
                    // Ignore orphaned favorite
                }
            }

            List<MusicLibrary> libraries = musicLibraryRepository.findByUserId(userId);
            List<MusicItemDto> libraryDtos = libraries.stream()
                    .map(musicService::toDto)
                    .collect(Collectors.toList());

            BackupDataDto backupData = new BackupDataDto();
            backupData.setConfig(config);
            backupData.setIdbData(idbData);
            backupData.setPlaylists(playlistDtos);
            backupData.setFavorites(favoriteDtos);
            backupData.setLibrary(libraryDtos);

            String jsonData = objectMapper.writeValueAsString(backupData);

            googleDriveService.uploadJsonFile(jsonData, "musicapp_backup.json", user.getRefreshToken());
        } catch (Exception e) {
            log.error("Backup failed", e);
            throw new AppException(ErrorCode.BACKUP_FAILED);
        }
    }

    @Transactional
    public Map<String, Object> restoreFromDrive(String userId) {
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

            if (backupData.getLibrary() != null) {
                for (MusicItemDto trackDto : backupData.getLibrary()) {
                    resolveOwnedDriveTrack(trackDto, user);
                }
            }

            if (backupData.getPlaylists() != null) {
                List<Playlist> existing = playlistRepository.findByUserIdOrderByCreatedAtDesc(userId);
                playlistRepository.deleteAll(existing);

                for (PlaylistDto pDto : backupData.getPlaylists()) {
                    Playlist playlist = Playlist.builder()
                            .name(pDto.getName())
                            .imageUrl(pDto.getImageUrl())
                            .user(user)
                            .build();

                    playlist = playlistRepository.save(playlist);

                    if (pDto.getTracks() != null) {
                        for (int i = 0; i < pDto.getTracks().size(); i++) {
                            MusicItemDto trackDto = pDto.getTracks().get(i);
                            MusicLibrary lib = resolveOwnedDriveTrack(trackDto, user);
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

            if (backupData.getFavorites() != null) {
                List<Favorite> existingFavorites = favoriteRepository.findByUserId(userId);
                favoriteRepository.deleteAllInBatch(existingFavorites);
                favoriteRepository.flush();

                for (MusicItemDto trackDto : backupData.getFavorites()) {
                    MusicLibrary lib = resolveOwnedDriveTrack(trackDto, user);

                    if (lib != null) {
                        favoriteRepository.insertIgnore(UUID.randomUUID().toString(), userId, lib.getId());
                    }
                }
            }

            Map<String, Object> restoredPayload = new java.util.HashMap<>();
            restoredPayload.put("config", backupData.getConfig());
            restoredPayload.put("idbData", backupData.getIdbData());
            return restoredPayload;
        } catch (AppException e) {
            throw e;
        } catch (Exception e) {
            log.error("Restore failed", e);
            throw new AppException(ErrorCode.RESTORE_FAILED);
        }
    }

    private MusicLibrary resolveOwnedDriveTrack(MusicItemDto trackDto, User user) {
        String driveFileId = trackDto.getDriveFileId();
        if (driveFileId == null || driveFileId.isBlank()) {
            return null;
        }
        MusicLibrary lib = musicLibraryRepository.findByDriveFileIdAndUserId(driveFileId, user.getId())
                .orElseGet(() -> MusicLibrary.builder().driveFileId(driveFileId).sourceType("DRIVE").user(user).build());
        lib.setName(trackDto.getName() != null ? trackDto.getName()
                : (trackDto.getTitle() != null ? trackDto.getTitle() : "Drive File"));
        lib.setTitle(trackDto.getTitle());
        lib.setArtist(trackDto.getArtist());
        lib.setAlbum(trackDto.getAlbum());
        lib.setGenre(trackDto.getGenre());
        lib.setImageUrl(trackDto.getImageUrl());
        lib.setLyrics(trackDto.getLyrics());
        lib.setDurationSeconds(trackDto.getDurationSeconds());
        if (trackDto.getPlayCount() != null) {
            lib.setPlayCount(trackDto.getPlayCount());
        }
        return musicLibraryRepository.save(lib);
    }
}
