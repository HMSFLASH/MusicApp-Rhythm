package com.music.app.service;

import com.google.api.services.drive.model.File;
import com.music.app.dto.MusicItemDto;
import com.music.app.exception.AppException;
import com.music.app.exception.ErrorCode;
import com.music.app.model.MusicLibrary;
import com.music.app.model.User;
import com.music.app.repository.MusicLibraryRepository;
import com.music.app.repository.UserRepository;

import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import org.jaudiotagger.audio.AudioFile;
import org.jaudiotagger.audio.AudioFileIO;
import org.jaudiotagger.tag.Tag;
import org.jaudiotagger.tag.FieldKey;
import java.io.FileInputStream;
import java.util.List;
import java.util.stream.Collectors;

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
                .title(lib.getTitle())
                .artist(lib.getArtist())
                .album(lib.getAlbum())
                .genre(lib.getGenre())
                .imageUrl(lib.getImageUrl())
                .lyrics(lib.getLyrics())
                .durationSeconds(lib.getDurationSeconds())
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

    public MusicItemDto updateMetadata(String id, MusicItemDto dto, String userId) {
        MusicLibrary lib = musicLibraryRepository.findByIdAndUserId(id, userId)
                .orElseThrow(() -> new AppException(ErrorCode.NOT_FOUND));

        if (dto.getTitle() != null)
            lib.setTitle(dto.getTitle());
        if (dto.getArtist() != null)
            lib.setArtist(dto.getArtist());
        if (dto.getAlbum() != null)
            lib.setAlbum(dto.getAlbum());
        if (dto.getGenre() != null)
            lib.setGenre(dto.getGenre());
        if (dto.getImageUrl() != null)
            lib.setImageUrl(dto.getImageUrl());
        if (dto.getLyrics() != null)
            lib.setLyrics(dto.getLyrics());
        if (dto.getDurationSeconds() != null)
            lib.setDurationSeconds(dto.getDurationSeconds());

        return toDto(musicLibraryRepository.save(lib));
    }

    @org.springframework.transaction.annotation.Transactional
    public MusicItemDto recordPlay(String id, String userId) {
        MusicLibrary lib = musicLibraryRepository.findByIdAndUserId(id, userId)
                .orElseThrow(() -> new AppException(ErrorCode.NOT_FOUND));
        lib.setPlayCount((lib.getPlayCount() == null ? 0L : lib.getPlayCount()) + 1);
        return toDto(lib);
    }

    public List<MusicItemDto> syncWithDrive(String userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_EXISTED));
        if (user.getRefreshToken() == null) {
            return listMusic(userId);
        }

        try {
            List<File> driveFiles = googleDriveService.listFiles(user.getRefreshToken());
            List<String> driveFileIds = driveFiles.stream()
                    .map(File::getId)
                    .collect(Collectors.toList());

            List<MusicLibrary> dbFiles = musicLibraryRepository.findByUserId(userId);
            List<MusicLibrary> toDelete = dbFiles.stream()
                    .filter(lib -> "DRIVE".equals(lib.getSourceType()) && lib.getDriveFileId() != null
                            && !driveFileIds.contains(lib.getDriveFileId()))
                    .collect(Collectors.toList());

            if (!toDelete.isEmpty()) {
                musicLibraryRepository.deleteAll(toDelete);
                log.info("Synced with Drive: deleted {} missing files from DB for user {}", toDelete.size(), userId);
            }

            // Return updated list
            return listMusic(userId);
        } catch (Exception e) {
            log.error("Failed to sync with drive", e);
            return listMusic(userId); // fallback to db list
        }
    }

    @org.springframework.transaction.annotation.Transactional
    public void deleteMusic(String id, String userId) {
        MusicLibrary lib = musicLibraryRepository.findByIdAndUserId(id, userId)
                .orElseThrow(() -> new AppException(ErrorCode.NOT_FOUND));

        // Fix logic error when deleting songs that are in favorites or playlists
        try {
            entityManager.createQuery("DELETE FROM PlaylistItem p WHERE p.musicLibrary.id = :id")
                    .setParameter("id", id)
                    .executeUpdate();

            entityManager.createQuery("DELETE FROM Favorite f WHERE f.musicLibrary.id = :id")
                    .setParameter("id", id)
                    .executeUpdate();
        } catch (Exception e) {
            log.error("Failed to delete related records for music id: {}", id, e);
        }

        if ("DRIVE".equals(lib.getSourceType()) && lib.getDriveFileId() != null) {
            try {
                googleDriveService.deleteFile(lib.getDriveFileId(), lib.getUser().getRefreshToken());
            } catch (Exception e) {
                log.error("Failed to delete file from Google Drive, proceeding to delete from DB anyway", e);
            }
        }

        musicLibraryRepository.delete(lib);
    }

    public MusicItemDto uploadToDrive(MultipartFile file, String title, String artist, String album, String genre,
            String imageUrl, String lyrics, String userId) {
        try {
            if (file.isEmpty() || file.getOriginalFilename() == null || !isSupportedAudioFile(file.getOriginalFilename())) {
                throw new AppException(ErrorCode.NOT_FOUND, "A supported non-empty audio file is required");
            }
            User user = userRepository.findById(userId)
                    .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_EXISTED));

            if (user.getRefreshToken() == null) {
                throw new AppException(ErrorCode.FORBIDDEN, "User Google Drive not linked");
            }

            String originalFilename = file.getOriginalFilename() != null ? file.getOriginalFilename() : "Unknown Audio";

            // Check for duplicates
            boolean exists = musicLibraryRepository.findByUserId(userId).stream()
                    .anyMatch(lib -> originalFilename.equals(lib.getName()));
            if (exists) {
                throw new AppException(ErrorCode.UNCATEGORIZED_EXCEPTION, "File already exists in library");
            }

            // Extract metadata via jaudiotagger
            String ext = ".tmp";
            if (originalFilename.lastIndexOf(".") != -1) {
                ext = originalFilename.substring(originalFilename.lastIndexOf("."));
            }
            java.io.File tempFile = java.io.File.createTempFile("musicapp_", ext);
            String driveFileId;
            try {
                java.nio.file.Files.copy(file.getInputStream(), tempFile.toPath(),
                        java.nio.file.StandardCopyOption.REPLACE_EXISTING);

                try {
                    if (originalFilename.toLowerCase().endsWith(".opus")) {
                        org.gagravarr.opus.OpusFile opusFile = new org.gagravarr.opus.OpusFile(tempFile);
                        org.gagravarr.opus.OpusTags tags = opusFile.getTags();
                        if (tags != null) {
                            if (title == null || title.isBlank())
                                title = tags.getTitle();
                            if (artist == null || artist.isBlank())
                                artist = tags.getArtist();
                            if (album == null || album.isBlank())
                                album = tags.getAlbum();
                            if (genre == null || genre.isBlank())
                                genre = tags.getGenre();

                            java.util.List<String> lyricsList = tags.getComments("LYRICS");
                            if (lyricsList == null || lyricsList.isEmpty())
                                lyricsList = tags.getComments("UNSYNCEDLYRICS");
                            if (lyricsList == null || lyricsList.isEmpty())
                                lyricsList = tags.getComments("UNSYNCED LYRICS");
                            if (lyricsList == null || lyricsList.isEmpty()) {
                                java.util.Map<String, java.util.List<String>> allComments = tags.getAllComments();
                                for (java.util.Map.Entry<String, java.util.List<String>> entry : allComments
                                        .entrySet()) {
                                    String id = entry.getKey().toUpperCase();
                                    if (id.contains("LYRICS") || id.equals("USLT") || id.equals("SYLT")) {
                                        lyricsList = entry.getValue();
                                        break;
                                    }
                                }
                            }
                            if (lyricsList != null && !lyricsList.isEmpty()) {
                                lyrics = lyricsList.get(0);
                                log.info("Extracted lyrics from Opus tags via vorbis-java-core, length: {}",
                                        lyrics.length());
                            } else {
                                log.info("No lyrics found in Opus tags");
                            }
                        }
                    } else {
                        AudioFile audioFile = AudioFileIO.read(tempFile);
                        Tag tag = audioFile.getTag();
                        if (tag != null) {
                            if (title == null || title.isBlank())
                                title = tag.getFirst(FieldKey.TITLE);
                            if (artist == null || artist.isBlank())
                                artist = tag.getFirst(FieldKey.ARTIST);
                            if (album == null || album.isBlank())
                                album = tag.getFirst(FieldKey.ALBUM);
                            if (genre == null || genre.isBlank())
                                genre = tag.getFirst(FieldKey.GENRE);

                            String tagLyrics = tag.getFirst(FieldKey.LYRICS);
                            if (tagLyrics == null || tagLyrics.isBlank()) {
                                try {
                                    tagLyrics = tag.getFirst("UNSYNCEDLYRICS");
                                } catch (Exception ex) {
                                }
                            }
                            if (tagLyrics == null || tagLyrics.isBlank()) {
                                try {
                                    tagLyrics = tag.getFirst("UNSYNCED LYRICS");
                                } catch (Exception ex) {
                                }
                            }
                            if (tagLyrics == null || tagLyrics.isBlank()) {
                                try {
                                    tagLyrics = tag.getFirst("USLT");
                                } catch (Exception ex) {
                                }
                            }
                            if (tagLyrics == null || tagLyrics.isBlank()) {
                                try {
                                    tagLyrics = tag.getFirst("SYLT");
                                } catch (Exception ex) {
                                }
                            }

                            if (tagLyrics == null || tagLyrics.isBlank()) {
                                java.util.Iterator<org.jaudiotagger.tag.TagField> fields = tag.getFields();
                                while (fields.hasNext()) {
                                    org.jaudiotagger.tag.TagField field = fields.next();
                                    String id = field.getId();
                                    String content = field.toString();

                                    log.info("=== METADATA TAG === ID: [{}], CONTENT length: {}, startsWith: [{}]",
                                            id,
                                            content == null ? 0 : content.length(),
                                            content != null && content.length() > 50
                                                    ? content.substring(0, 50).replace("\n", " ") + "..."
                                                    : (content != null ? content.replace("\n", " ") : "null"));

                                    String upperId = id.toUpperCase();
                                    if (content != null && content.contains("\n") && content.length() > 20) {
                                        tagLyrics = content;
                                        // Clean up Jaudiotagger's toString format like: ID="Lyrics..."
                                        if (tagLyrics.contains("=\"")) {
                                            tagLyrics = tagLyrics.substring(tagLyrics.indexOf("=\"") + 2);
                                            if (tagLyrics.endsWith("\""))
                                                tagLyrics = tagLyrics.substring(0, tagLyrics.length() - 1);
                                        }
                                        // Don't break, keep logging the rest!
                                    }
                                }
                            }

                            if (tagLyrics != null && !tagLyrics.isBlank()) {
                                lyrics = tagLyrics;
                                log.info("Extracted lyrics from file tags via jaudiotagger, length: {}",
                                        lyrics.length());
                            } else {
                                log.info("No lyrics found in file tags via jaudiotagger");
                            }
                        }
                    }
                } catch (Exception e) {
                    log.error("Failed to extract metadata", e);
                }

                try (FileInputStream is = new FileInputStream(tempFile)) {
                    driveFileId = googleDriveService.uploadAudioStream(is, tempFile.length(),
                            user.getRefreshToken(), originalFilename);
                }
            } finally {
                tempFile.delete();
            }

            MusicLibrary lib = MusicLibrary.builder()
                    .name(originalFilename)
                    .sourceType("DRIVE")
                    .driveFileId(driveFileId)
                    .title(title)
                    .artist(artist)
                    .album(album)
                    .genre(genre)
                    .imageUrl(imageUrl)
                    .lyrics(lyrics)
                    .user(user)
                    .build();

            return toDto(musicLibraryRepository.save(lib));
        } catch (AppException e) {
            throw e;
        } catch (Exception e) {
            log.error("Failed to upload file to drive", e);
            throw new AppException(ErrorCode.UNCATEGORIZED_EXCEPTION, "Failed to upload file to drive");
        }
    }

    private boolean isSupportedAudioFile(String filename) {
        String lower = filename.toLowerCase(java.util.Locale.ROOT);
        return lower.endsWith(".mp3") || lower.endsWith(".m4a") || lower.endsWith(".flac")
                || lower.endsWith(".wav") || lower.endsWith(".ogg") || lower.endsWith(".opus")
                || lower.endsWith(".aac") || lower.endsWith(".wma");
    }

    public String getDriveToken(String userId) {
        try {
            User user = userRepository.findById(userId)
                    .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_EXISTED));
            if (user.getRefreshToken() == null) {
                throw new AppException(ErrorCode.FORBIDDEN, "User Google Drive not linked");
            }
            return googleDriveService.getAccessToken(user.getRefreshToken());
        } catch (AppException exception) {
            throw exception;
        } catch (Exception exception) {
            log.error("Failed to obtain Google Drive access token", exception);
            throw new AppException(ErrorCode.UNCATEGORIZED_EXCEPTION, "Failed to connect to Google Drive");
        }
    }

}
