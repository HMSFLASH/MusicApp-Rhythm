package com.music.app.controller;

import com.music.app.dto.MusicItemDto;
import com.music.app.dto.ApiResponse;
import com.music.app.service.MusicService;
import com.music.app.util.SecurityUtils;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.http.MediaType;

import java.security.Principal;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/music")
@RequiredArgsConstructor
@Slf4j
public class MusicController {

    private final MusicService musicService;

    @GetMapping("/list")
    public ApiResponse<List<MusicItemDto>> listMusic(Principal principal) {
        Long userId = SecurityUtils.extractUserId(principal);
        return ApiResponse.<List<MusicItemDto>>builder()
                .result(musicService.listMusic(userId))
                .build();
    }

    @PutMapping("/{id}/metadata")
    public ApiResponse<MusicItemDto> updateMetadata(@PathVariable Long id,
                                                    @RequestBody MusicItemDto dto,
                                                    Principal principal) {
        Long userId = SecurityUtils.extractUserId(principal);
        return ApiResponse.<MusicItemDto>builder()
                .result(musicService.updateMetadata(id, dto, userId))
                .build();
    }

    @PostMapping(value = "/upload", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ApiResponse<MusicItemDto> uploadToDrive(
            @RequestParam("file") MultipartFile file,
            @RequestParam(value = "title", required = false) String title,
            @RequestParam(value = "artist", required = false) String artist,
            @RequestParam(value = "album", required = false) String album,
            @RequestParam(value = "genre", required = false) String genre,
            @RequestParam(value = "imageUrl", required = false) String imageUrl,
            Principal principal) {
            
        Long userId = SecurityUtils.extractUserId(principal);
        return ApiResponse.<MusicItemDto>builder()
                .result(musicService.uploadToDrive(file, title, artist, album, genre, imageUrl, userId))
                .build();
    }

    @GetMapping("/drive-token")
    public ApiResponse<Map<String, String>> getDriveToken(Principal principal) {
        Long userId = SecurityUtils.extractUserId(principal);
        String token = musicService.getDriveToken(userId);
        return ApiResponse.<Map<String, String>>builder()
                .result(Map.of("accessToken", token))
                .build();
    }
}
