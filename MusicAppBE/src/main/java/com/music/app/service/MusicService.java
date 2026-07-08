package com.music.app.service;

import com.music.app.dto.MusicItemDto;
import com.music.app.exception.AppException;
import com.music.app.exception.ErrorCode;
import com.music.app.model.MusicLibrary;
import com.music.app.model.User;
import com.music.app.repository.MusicLibraryRepository;
import com.music.app.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class MusicService {

    private final MusicLibraryRepository musicLibraryRepository;
    private final GoogleDriveService googleDriveService;
    private final UserRepository userRepository;

    public MusicItemDto toDto(MusicLibrary lib) {
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
                .driveFileId(lib.getDriveFileId())
                .build();
    }

    public List<MusicItemDto> listMusic(Long userId) {
        return musicLibraryRepository.findByUserId(userId).stream()
                .map(this::toDto)
                .collect(Collectors.toList());
    }

    public MusicItemDto updateMetadata(Long id, MusicItemDto dto, Long userId) {
        MusicLibrary lib = musicLibraryRepository.findById(id)
                .orElseThrow(() -> new AppException(ErrorCode.NOT_FOUND));
                
        if (!lib.getUser().getId().equals(userId)) {
            throw new AppException(ErrorCode.FORBIDDEN);
        }

        if (dto.getTitle() != null) lib.setTitle(dto.getTitle());
        if (dto.getArtist() != null) lib.setArtist(dto.getArtist());
        if (dto.getAlbum() != null) lib.setAlbum(dto.getAlbum());
        if (dto.getGenre() != null) lib.setGenre(dto.getGenre());
        if (dto.getImageUrl() != null) lib.setImageUrl(dto.getImageUrl());
        if (dto.getDurationSeconds() != null) lib.setDurationSeconds(dto.getDurationSeconds());

        return toDto(musicLibraryRepository.save(lib));
    }

    public MusicItemDto uploadToDrive(MultipartFile file, String title, String artist, String album, String genre, String imageUrl, Long userId) {
        try {
            User user = userRepository.findById(userId)
                    .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_EXISTED));
                    
            if (user.getRefreshToken() == null) {
                throw new AppException(ErrorCode.FORBIDDEN, "User Google Drive not linked");
            }

            String driveFileId = googleDriveService.uploadAudioStream(file.getInputStream(), file.getSize(), user.getRefreshToken(), file.getOriginalFilename());

            MusicLibrary lib = MusicLibrary.builder()
                    .name(file.getOriginalFilename() != null ? file.getOriginalFilename() : "Unknown Audio")
                    .sourceType("DRIVE")
                    .driveFileId(driveFileId)
                    .title(title)
                    .artist(artist)
                    .album(album)
                    .genre(genre)
                    .imageUrl(imageUrl)
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

    public String getDriveToken(Long userId) {
        try {
            User user = userRepository.findById(userId)
                    .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_EXISTED));
                    
            if (user.getRefreshToken() == null) {
                throw new AppException(ErrorCode.FORBIDDEN, "User Google Drive not linked");
            }

            return googleDriveService.getAccessToken(user.getRefreshToken());
        } catch (AppException e) {
            throw e;
        } catch (Exception e) {
            log.error("Failed to get drive token", e);
            throw new AppException(ErrorCode.UNCATEGORIZED_EXCEPTION, "Failed to get drive token");
        }
    }
}
