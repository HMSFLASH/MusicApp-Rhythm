package com.music.app.service;

import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.music.app.dto.MusicItemDto;
import com.music.app.exception.AppException;
import com.music.app.exception.ErrorCode;
import com.music.app.model.MusicLibrary;
import com.music.app.repository.FavoriteRepository;
import com.music.app.repository.MusicLibraryRepository;
import com.music.app.repository.UserRepository;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class FavoriteService {

    private final FavoriteRepository favoriteRepository;
    private final MusicLibraryRepository musicLibraryRepository;
    private final UserRepository userRepository;
    private final MusicService musicService;

    public List<MusicItemDto> getFavorites(String userId) {
        return favoriteRepository.findByUserIdWithMusicLibrary(userId).stream()
                .map(fav -> musicService.toDto(fav.getMusicLibrary()))
                .collect(Collectors.toList());
    }

    @Transactional
    public void addFavorite(String trackId, String userId) {
        if (favoriteRepository.existsByUserIdAndMusicLibraryId(userId, trackId)) {
            return;
        }

        userRepository.findById(userId).orElseThrow(() -> new AppException(ErrorCode.USER_NOT_EXISTED));

        MusicLibrary lib = musicLibraryRepository
                .findByIdAndUserId(trackId, userId)
                .orElseThrow(() -> new AppException(ErrorCode.NOT_FOUND));

        favoriteRepository.insertIgnore(UUID.randomUUID().toString(), userId, lib.getId());
    }

    @Transactional
    public void removeFavorite(String trackId, String userId) {
        favoriteRepository.deleteByUserIdAndMusicLibraryId(userId, trackId);
    }

    public boolean checkFavorite(String trackId, String userId) {
        return favoriteRepository.existsByUserIdAndMusicLibraryId(userId, trackId);
    }
}
