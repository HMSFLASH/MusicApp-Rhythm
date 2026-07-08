package com.music.app.controller;

import com.music.app.dto.CreatePlaylistRequest;
import com.music.app.dto.PlaylistDto;
import com.music.app.dto.ApiResponse;
import com.music.app.service.PlaylistService;
import com.music.app.util.SecurityUtils;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;
import java.util.List;

@RestController
@RequestMapping("/api/playlists")
@RequiredArgsConstructor
@Slf4j
public class PlaylistController {

    private final PlaylistService playlistService;

    @GetMapping
    public ApiResponse<List<PlaylistDto>> getPlaylists(Principal principal) {
        Long userId = SecurityUtils.extractUserId(principal);
        return ApiResponse.<List<PlaylistDto>>builder()
                .result(playlistService.getPlaylists(userId))
                .build();
    }

    @GetMapping("/{id}")
    public ApiResponse<PlaylistDto> getPlaylist(@PathVariable Long id, Principal principal) {
        Long userId = SecurityUtils.extractUserId(principal);
        return ApiResponse.<PlaylistDto>builder()
                .result(playlistService.getPlaylist(id, userId))
                .build();
    }

    @PostMapping
    public ApiResponse<PlaylistDto> createPlaylist(@RequestBody CreatePlaylistRequest req, Principal principal) {
        Long userId = SecurityUtils.extractUserId(principal);
        return ApiResponse.<PlaylistDto>builder()
                .result(playlistService.createPlaylist(req, userId))
                .build();
    }

    @PutMapping("/{id}")
    public ApiResponse<PlaylistDto> updatePlaylist(@PathVariable Long id,
                                                   @RequestBody CreatePlaylistRequest req,
                                                   Principal principal) {
        Long userId = SecurityUtils.extractUserId(principal);
        return ApiResponse.<PlaylistDto>builder()
                .result(playlistService.updatePlaylist(id, req, userId))
                .build();
    }

    @DeleteMapping("/{id}")
    public ApiResponse<String> deletePlaylist(@PathVariable Long id, Principal principal) {
        Long userId = SecurityUtils.extractUserId(principal);
        playlistService.deletePlaylist(id, userId);
        return ApiResponse.<String>builder()
                .result("Deleted")
                .build();
    }

    @PostMapping("/{id}/tracks/{trackId}")
    public ApiResponse<String> addTrack(@PathVariable Long id, @PathVariable String trackId, @RequestParam(required = false) String name, Principal principal) {
        Long userId = SecurityUtils.extractUserId(principal);
        playlistService.addTrack(id, trackId, name, userId);
        return ApiResponse.<String>builder()
                .result("Added")
                .build();
    }

    @DeleteMapping("/{id}/tracks/{trackId}")
    public ApiResponse<String> removeTrack(@PathVariable Long id, @PathVariable String trackId, Principal principal) {
        Long userId = SecurityUtils.extractUserId(principal);
        playlistService.removeTrack(id, trackId, userId);
        return ApiResponse.<String>builder()
                .result("Removed")
                .build();
    }
}
