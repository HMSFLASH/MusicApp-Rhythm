package com.music.app.controller;

import com.music.app.dto.MusicItemDto;
import com.music.app.dto.ApiResponse;
import com.music.app.dto.RegisterDriveUploadRequest;
import com.music.app.service.MusicService;
import com.music.app.util.SecurityUtils;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;

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
        String userId = SecurityUtils.extractUserId(principal);
        return ApiResponse.<List<MusicItemDto>>builder()
                .result(musicService.listMusic(userId))
                .build();
    }

    @PostMapping("/sync")
    public ApiResponse<List<MusicItemDto>> syncWithDrive(Principal principal) {
        String userId = SecurityUtils.extractUserId(principal);
        return ApiResponse.<List<MusicItemDto>>builder()
                .result(musicService.syncWithDrive(userId))
                .build();
    }

    @PostMapping("/{id}/play")
    public ApiResponse<MusicItemDto> recordPlay(@PathVariable String id, Principal principal) {
        String userId = SecurityUtils.extractUserId(principal);
        return ApiResponse.<MusicItemDto>builder()
                .result(musicService.recordPlay(id, userId))
                .build();
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> deleteMusic(@PathVariable String id, Principal principal) {
        String userId = SecurityUtils.extractUserId(principal);
        musicService.deleteMusic(id, userId);
        return ApiResponse.<Void>builder()
                .result(null)
                .build();
    }

    @GetMapping("/drive-token")
    public ApiResponse<Map<String, String>> getDriveToken(Principal principal) {
        String userId = SecurityUtils.extractUserId(principal);
        return ApiResponse.<Map<String, String>>builder()
                .result(Map.of("accessToken", musicService.getDriveToken(userId)))
                .build();
    }

    @GetMapping("/drive-upload-session")
    public ApiResponse<Map<String, String>> getDriveUploadSession(Principal principal) {
        String userId = SecurityUtils.extractUserId(principal);
        return ApiResponse.<Map<String, String>>builder()
                .result(musicService.getDriveUploadSession(userId))
                .build();
    }

    @PostMapping("/direct-upload/register")
    public ApiResponse<MusicItemDto> registerDirectDriveUpload(
            @RequestBody RegisterDriveUploadRequest request,
            Principal principal) {
        String userId = SecurityUtils.extractUserId(principal);
        return ApiResponse.<MusicItemDto>builder()
                .result(musicService.registerDirectDriveUpload(request, userId))
                .build();
    }

    @GetMapping("/{id}/image")
    public ResponseEntity<byte[]> getMusicImage(@PathVariable String id, Principal principal) {
        String userId = null;
        if (principal != null) {
            try {
                userId = SecurityUtils.extractUserId(principal);
            } catch (Exception ignored) {
            }
        }

        String imageUrl = userId == null
                ? musicService.getMusicImage(id)
                : musicService.getMusicImage(id, userId);
        if (imageUrl != null && imageUrl.startsWith("data:image/")) {
            int commaIndex = imageUrl.indexOf(',');
            if (commaIndex != -1) {
                String base64 = imageUrl.substring(commaIndex + 1);
                String mimeType = imageUrl.substring(5, imageUrl.indexOf(';'));
                byte[] data = java.util.Base64.getDecoder().decode(base64);
                return ResponseEntity.ok()
                        .header(org.springframework.http.HttpHeaders.CONTENT_TYPE, mimeType)
                        .header(org.springframework.http.HttpHeaders.CACHE_CONTROL, "max-age=31536000") // 1 year cache
                        .body(data);
            }
        } else if (imageUrl != null && imageUrl.startsWith("http")) {
            return ResponseEntity.status(org.springframework.http.HttpStatus.FOUND)
                    .header(org.springframework.http.HttpHeaders.LOCATION, imageUrl)
                    .build();
        }
        return ResponseEntity.notFound().build();
    }

}
