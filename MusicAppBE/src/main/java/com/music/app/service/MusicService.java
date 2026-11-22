package com.music.app.service;

import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;

import org.springframework.stereotype.Service;

import com.google.api.services.drive.model.File;
import com.music.app.dto.MusicItemDto;
import com.music.app.dto.RegisterDriveUploadRequest;
import com.music.app.exception.AppException;
import com.music.app.exception.ErrorCode;
import com.music.app.model.MusicLibrary;
import com.music.app.model.User;
import com.music.app.repository.MusicLibraryRepository;
import com.music.app.repository.UserRepository;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Service
@RequiredArgsConstructor
@Slf4j
public class MusicService {

    private final MusicLibraryRepository musicLibraryRepository;
    private final GoogleDriveService googleDriveService;
    private final UserRepository userRepository;

    @PersistenceContext
    private EntityManager entityManager;

    public MusicItemDto toDto(MusicLibrary lib) {
        return MusicItemDto.builder()
                .id(lib.getId().toString())
                .name(lib.getName())
                .sourceType(lib.getSourceType())
                .driveFileId(lib.getDriveFileId())
                .playCount(lib.getPlayCount() == null ? 0L : lib.getPlayCount())
                .build();
    }

    public List<MusicItemDto> listMusic(String userId) {
        return musicLibraryRepository.findByUserId(userId).stream()
                .map(this::toDto)
                .collect(Collectors.toList());
    }

    @org.springframework.transaction.annotation.Transactional
    public MusicItemDto recordPlay(String id, String userId) {
        int updated = musicLibraryRepository.incrementPlayCount(id, userId);
        if (updated == 0) {
            throw new AppException(ErrorCode.NOT_FOUND);
        }
        MusicLibrary lib = musicLibraryRepository
                .findByIdAndUserId(id, userId)
                .orElseThrow(() -> new AppException(ErrorCode.NOT_FOUND));
        return toDto(lib);
    }

    @org.springframework.transaction.annotation.Transactional
    public List<MusicItemDto> syncWithDrive(String userId) {
        User user = userRepository.findById(userId).orElseThrow(() -> new AppException(ErrorCode.USER_NOT_EXISTED));
        if (user.getRefreshToken() == null) {
            return listMusic(userId);
        }

        try {
            List<File> driveFiles = googleDriveService.listFiles(user.getRefreshToken());
            if (driveFiles == null) {
                driveFiles = List.of();
            }
            Set<String> driveFileIds = driveFiles.stream().map(File::getId).collect(Collectors.toSet());

            List<MusicLibrary> dbFiles = musicLibraryRepository.findByUserId(userId);
            List<MusicLibrary> toDelete = dbFiles.stream()
                    .filter(lib -> "DRIVE".equals(lib.getSourceType())
                            && lib.getDriveFileId() != null
                            && !driveFileIds.contains(lib.getDriveFileId()))
                    .collect(Collectors.toList());

            if (!toDelete.isEmpty()) {
                List<String> idsToDelete =
                        toDelete.stream().map(MusicLibrary::getId).collect(Collectors.toList());
                entityManager
                        .createQuery("DELETE FROM PlaylistItem p WHERE p.musicLibrary.id IN :ids")
                        .setParameter("ids", idsToDelete)
                        .executeUpdate();
                entityManager
                        .createQuery("DELETE FROM Favorite f WHERE f.musicLibrary.id IN :ids")
                        .setParameter("ids", idsToDelete)
                        .executeUpdate();

                try {
                    entityManager
                            .createQuery("DELETE FROM MusicLibrary m WHERE m.id IN :ids")
                            .setParameter("ids", idsToDelete)
                            .executeUpdate();
                } catch (Exception e) {
                    log.warn("Concurrent delete encountered for MusicLibrary, ignoring: {}", e.getMessage());
                }

                log.info("Synced with Drive: deleted {} missing files from DB for user {}", toDelete.size(), userId);
            }

            // Return updated list
            return listMusic(userId);
        } catch (Exception e) {
            log.error("Failed to sync with drive", e);
            String msg = e.getMessage();
            if (msg != null && (msg.contains("invalid_grant") || msg.contains("Token has been expired"))) {
                userRepository.findById(userId).ifPresent(u -> {
                    u.setRefreshToken(null);
                    userRepository.save(u);
                });
                throw new AppException(
                        ErrorCode.DRIVE_NOT_LINKED,
                        "Phiên kết nối Google Drive đã hết hạn hoặc bị thu hồi. Vui lòng kết nối lại.");
            }
            return listMusic(userId); // fallback to db list
        }
    }

    @org.springframework.transaction.annotation.Transactional
    public void deleteMusic(String id, String userId) {
        MusicLibrary lib = musicLibraryRepository
                .findByIdAndUserId(id, userId)
                .orElseThrow(() -> new AppException(ErrorCode.NOT_FOUND));

        entityManager
                .createQuery("DELETE FROM PlaylistItem p WHERE p.musicLibrary.id = :id")
                .setParameter("id", id)
                .executeUpdate();

        entityManager
                .createQuery("DELETE FROM Favorite f WHERE f.musicLibrary.id = :id")
                .setParameter("id", id)
                .executeUpdate();

        String refreshToken = lib.getUser() != null ? lib.getUser().getRefreshToken() : null;
        if ("DRIVE".equals(lib.getSourceType())
                && lib.getDriveFileId() != null
                && refreshToken != null
                && !refreshToken.isBlank()) {
            try {
                googleDriveService.deleteFile(lib.getDriveFileId(), refreshToken);
            } catch (Exception e) {
                log.error("Failed to delete file from Google Drive, proceeding to delete from DB anyway", e);
            }
        }

        musicLibraryRepository.delete(lib);
    }

    private boolean isSupportedAudioFile(String filename) {
        String lower = filename.toLowerCase(java.util.Locale.ROOT);
        return lower.endsWith(".mp3")
                || lower.endsWith(".m4a")
                || lower.endsWith(".flac")
                || lower.endsWith(".wav")
                || lower.endsWith(".ogg")
                || lower.endsWith(".opus")
                || lower.endsWith(".aac")
                || lower.endsWith(".wma");
    }

    public MusicItemDto registerDirectDriveUpload(RegisterDriveUploadRequest request, String userId) {
        if (request == null
                || request.getDriveFileId() == null
                || request.getDriveFileId().isBlank()) {
            throw new AppException(ErrorCode.INVALID_REQUEST, "Drive file id is required");
        }

        User user = userRepository.findById(userId).orElseThrow(() -> new AppException(ErrorCode.USER_NOT_EXISTED));

        if (user.getRefreshToken() == null) {
            throw new AppException(ErrorCode.FORBIDDEN, "User Google Drive not linked");
        }

        try {
            File driveFile = googleDriveService.getFileMetadata(request.getDriveFileId(), user.getRefreshToken());
            if (driveFile == null || Boolean.TRUE.equals(driveFile.getTrashed())) {
                throw new AppException(ErrorCode.NOT_FOUND, "Drive file not found");
            }

            String fileName = firstNonBlank(request.getFileName(), driveFile.getName(), "Unknown Audio");
            if (!isSupportedAudioFile(fileName)) {
                throw new AppException(ErrorCode.INVALID_REQUEST, "A supported audio file is required");
            }

            boolean exists = musicLibraryRepository.findByUserId(userId).stream()
                    .anyMatch(lib ->
                            request.getDriveFileId().equals(lib.getDriveFileId()) || fileName.equals(lib.getName()));
            if (exists) {
                throw new AppException(ErrorCode.DUPLICATE_FILE, "File already exists in library");
            }

            MusicLibrary lib = MusicLibrary.builder()
                    .name(fileName)
                    .sourceType("DRIVE")
                    .driveFileId(request.getDriveFileId())
                    .user(user)
                    .build();

            return toDto(musicLibraryRepository.save(lib));
        } catch (AppException exception) {
            throw exception;
        } catch (Exception exception) {
            log.error("Failed to register direct Drive upload", exception);
            String msg = exception.getMessage();
            if (msg != null && (msg.contains("invalid_grant") || msg.contains("Token has been expired"))) {
                userRepository.findById(userId).ifPresent(u -> {
                    u.setRefreshToken(null);
                    userRepository.save(u);
                });
                throw new AppException(
                        ErrorCode.DRIVE_NOT_LINKED,
                        "Phiên kết nối Google Drive đã hết hạn hoặc bị thu hồi. Vui lòng kết nối lại.");
            }
            throw new AppException(ErrorCode.UNCATEGORIZED_EXCEPTION, "Failed to register Drive upload");
        }
    }

    public Map<String, String> getDriveUploadSession(String userId) {
        return Map.of(
                "accessToken", getDriveToken(userId),
                "folderName", googleDriveService.getFolderName());
    }

    private String firstNonBlank(String... values) {
        for (String value : values) {
            if (value != null && !value.isBlank()) {
                return value;
            }
        }
        return null;
    }

    public String getDriveToken(String userId) {
        try {
            User user = userRepository.findById(userId).orElseThrow(() -> new AppException(ErrorCode.USER_NOT_EXISTED));
            if (user.getRefreshToken() == null) {
                throw new AppException(ErrorCode.FORBIDDEN, "User Google Drive not linked");
            }
            return googleDriveService.getAccessToken(user.getRefreshToken());
        } catch (AppException exception) {
            throw exception;
        } catch (Exception exception) {
            log.error("Failed to obtain Google Drive access token", exception);
            String msg = exception.getMessage();
            if (msg != null && (msg.contains("invalid_grant") || msg.contains("Token has been expired"))) {
                userRepository.findById(userId).ifPresent(u -> {
                    u.setRefreshToken(null);
                    userRepository.save(u);
                });
                throw new AppException(
                        ErrorCode.DRIVE_NOT_LINKED,
                        "Phiên kết nối Google Drive đã hết hạn hoặc bị thu hồi. Vui lòng kết nối lại.");
            }
            throw new AppException(ErrorCode.UNCATEGORIZED_EXCEPTION, "Failed to connect to Google Drive");
        }
    }
}
