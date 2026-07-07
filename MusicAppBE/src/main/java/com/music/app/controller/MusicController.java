package com.music.app.controller;

import com.google.api.services.drive.model.File;
import com.music.app.dto.MusicItemDto;
import com.music.app.model.MusicLibrary;
import com.music.app.model.User;
import com.music.app.repository.MusicLibraryRepository;
import com.music.app.repository.UserRepository;
import com.music.app.service.GoogleDriveService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.web.bind.annotation.*;

import java.io.InputStream;
import java.net.URL;
import java.security.Principal;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.http.MediaType;

@RestController
@RequestMapping("/api/music")
@RequiredArgsConstructor
@Slf4j
public class MusicController {

    private final MusicLibraryRepository musicLibraryRepository;
    private final GoogleDriveService googleDriveService;
    private final UserRepository userRepository;

    /** Chuyển MusicLibrary entity thành DTO */
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

    private Long extractUserId(Principal principal) {
        if (!(principal instanceof JwtAuthenticationToken)) return null;
        String uid = ((JwtAuthenticationToken) principal).getToken().getClaimAsString("userId");
        return uid != null ? Long.valueOf(uid) : null;
    }

    /** GET /api/music/list — Lấy tất cả nhạc (Telegram + Drive) */
    @GetMapping("/list")
    public ResponseEntity<List<MusicItemDto>> listMusic(Principal principal) {
        Long userId = extractUserId(principal);
        if (userId == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();

        List<MusicItemDto> result = musicLibraryRepository.findByUserId(userId).stream()
                .map(this::toDto)
                .collect(Collectors.toList());

        return ResponseEntity.ok(result);
    }

    /** GET /api/music/search?q={query} — Tìm kiếm nhạc theo tên */
    @GetMapping("/search")
    public ResponseEntity<List<MusicItemDto>> searchMusic(@RequestParam String q) {
        if (q == null || q.isBlank()) {
            return ResponseEntity.ok(List.of());
        }
        List<MusicItemDto> results = musicLibraryRepository.findByNameContainingIgnoreCase(q.trim())
                .stream()
                .map(this::toDto).collect(Collectors.toList());
        return ResponseEntity.ok(results);
    }

    /** PUT /api/music/{id}/metadata — Cập nhật metadata thủ công */
    @PutMapping("/{id}/metadata")
    public ResponseEntity<MusicItemDto> updateMetadata(@PathVariable Long id,
                                                        @RequestBody MusicItemDto dto,
                                                        Principal principal) {
        Long userId = extractUserId(principal);
        if (userId == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();

        MusicLibrary lib = musicLibraryRepository.findById(id).orElse(null);
        if (lib == null) return ResponseEntity.notFound().build();

        if (dto.getTitle() != null) lib.setTitle(dto.getTitle());
        if (dto.getArtist() != null) lib.setArtist(dto.getArtist());
        if (dto.getAlbum() != null) lib.setAlbum(dto.getAlbum());
        if (dto.getGenre() != null) lib.setGenre(dto.getGenre());
        if (dto.getImageUrl() != null) lib.setImageUrl(dto.getImageUrl());
        if (dto.getDurationSeconds() != null) lib.setDurationSeconds(dto.getDurationSeconds());

        return ResponseEntity.ok(toDto(musicLibraryRepository.save(lib)));
    }



    /** POST /api/music/upload — Upload local file directly to Google Drive */
    @PostMapping(value = "/upload", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<?> uploadToDrive(
            @RequestParam("file") MultipartFile file,
            @RequestParam(value = "title", required = false) String title,
            @RequestParam(value = "artist", required = false) String artist,
            @RequestParam(value = "album", required = false) String album,
            @RequestParam(value = "genre", required = false) String genre,
            @RequestParam(value = "imageUrl", required = false) String imageUrl,
            Principal principal) {
        try {
            log.info("Upload request received: file={}, size={} bytes", file.getOriginalFilename(), file.getSize());
            
            Long userId = extractUserId(principal);
            if (userId == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();

            User user = userRepository.findById(userId).orElse(null);
            if (user == null || user.getRefreshToken() == null) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN).body("User Google Drive not linked");
            }

            log.info("Starting Google Drive upload for: {}", file.getOriginalFilename());
            String driveFileId = googleDriveService.uploadAudioStream(file.getInputStream(), file.getSize(), user.getRefreshToken(), file.getOriginalFilename());
            log.info("Google Drive upload complete: fileId={}", driveFileId);

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
            musicLibraryRepository.save(lib);

            log.info("Upload complete and saved to DB: {}", file.getOriginalFilename());
            return ResponseEntity.ok(toDto(lib));
        } catch (Exception e) {
            log.error("Failed to upload file to drive", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }
}
