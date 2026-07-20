package com.music.app.controller;

import java.security.Principal;
import java.util.List;

import org.springframework.web.bind.annotation.*;

import com.music.app.dto.ApiResponse;
import com.music.app.dto.MusicItemDto;
import com.music.app.service.FavoriteService;
import com.music.app.util.SecurityUtils;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@RestController
@RequestMapping("/api/favorites")
@RequiredArgsConstructor
@Slf4j
public class FavoriteController {

    private final FavoriteService favoriteService;

    @GetMapping
    public ApiResponse<List<MusicItemDto>> getFavorites(Principal principal) {
        String userId = SecurityUtils.extractUserId(principal);
        return ApiResponse.<List<MusicItemDto>>builder()
                .result(favoriteService.getFavorites(userId))
                .build();
    }

    @PostMapping("/{trackId}")
    public ApiResponse<String> addFavorite(@PathVariable String trackId, Principal principal) {
        String userId = SecurityUtils.extractUserId(principal);
        favoriteService.addFavorite(trackId, userId);
        return ApiResponse.<String>builder().result("Added to favorites").build();
    }

    @DeleteMapping("/{trackId}")
    public ApiResponse<String> removeFavorite(@PathVariable String trackId, Principal principal) {
        String userId = SecurityUtils.extractUserId(principal);
        favoriteService.removeFavorite(trackId, userId);
        return ApiResponse.<String>builder().result("Removed from favorites").build();
    }

    @GetMapping("/check/{trackId}")
    public ApiResponse<Boolean> checkFavorite(@PathVariable String trackId, Principal principal) {
        String userId = SecurityUtils.extractUserId(principal);
        return ApiResponse.<Boolean>builder()
                .result(favoriteService.checkFavorite(trackId, userId))
                .build();
    }
}
