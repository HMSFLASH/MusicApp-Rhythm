package com.music.app.service;

import com.music.app.dto.CreatePlaylistRequest;
import com.music.app.dto.MusicItemDto;
import com.music.app.dto.PlaylistDto;
import com.music.app.exception.AppException;
import com.music.app.exception.ErrorCode;
import com.music.app.model.MusicLibrary;
import com.music.app.model.Playlist;
import com.music.app.model.PlaylistItem;
import com.music.app.model.User;
import com.music.app.repository.MusicLibraryRepository;
import com.music.app.repository.PlaylistRepository;
import com.music.app.repository.PlaylistItemRepository;
import com.music.app.repository.UserRepository;

import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;

import org.hibernate.FetchNotFoundException;
import org.hibernate.ObjectNotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class PlaylistService {

    private final PlaylistRepository playlistRepository;
    private final PlaylistItemRepository playlistItemRepository;
    private final MusicLibraryRepository musicLibraryRepository;
    private final UserRepository userRepository;
    private final MusicService musicService;

    public PlaylistDto toDto(Playlist p, boolean includeTracks) throws FetchNotFoundException {
        List<MusicItemDto> tracks = null;
        if (includeTracks) {
            tracks = new java.util.ArrayList<>();
            for (PlaylistItem i : p.getItems()) {
                try {
                    if (i.getMusicLibrary() != null) {
                        tracks.add(musicService.toDto(i.getMusicLibrary()));
                    }
                } catch (ObjectNotFoundException | EntityNotFoundException e) {
                    // Ignore orphaned track
                }
            }
        }

        return PlaylistDto.builder()
                .id(p.getId())
                .name(p.getName())
                .imageUrl(p.getImageUrl())
                .trackCount(p.getTrackCount() != null ? p.getTrackCount() : 0)
                .createdAt(p.getCreatedAt())
                .tracks(tracks)
                .build();
    }

    public List<PlaylistDto> getPlaylists(String userId) {
        return playlistRepository.findByUserIdOrderByCreatedAtDesc(userId)
                .stream().map(p -> toDto(p, false)).collect(Collectors.toList());
    }

    public PlaylistDto getPlaylist(String id, String userId) {
        return playlistRepository.findByIdAndUserIdWithItems(id, userId)
                .map(p -> toDto(p, true))
                .orElseThrow(() -> new AppException(ErrorCode.NOT_FOUND));
    }

    @Transactional
    public PlaylistDto createPlaylist(CreatePlaylistRequest req, String userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_EXISTED));

        Playlist playlist = Playlist.builder()
                .name(req.getName())
                .imageUrl(req.getImageUrl())
                .user(user)
                .build();

        playlist = playlistRepository.save(playlist);
        return toDto(playlist, true);
    }

    @Transactional
    public PlaylistDto updatePlaylist(String id, CreatePlaylistRequest req, String userId) {
        Playlist p = playlistRepository.findByIdAndUserId(id, userId)
                .orElseThrow(() -> new AppException(ErrorCode.NOT_FOUND));

        if (req.getName() != null)
            p.setName(req.getName());
        if (req.getImageUrl() != null)
            p.setImageUrl(req.getImageUrl());
        return toDto(playlistRepository.save(p), false);
    }

    @Transactional
    public void deletePlaylist(String id, String userId) {
        Playlist p = playlistRepository.findByIdAndUserId(id, userId)
                .orElseThrow(() -> new AppException(ErrorCode.NOT_FOUND));
        playlistRepository.delete(p);
    }

    @Transactional
    public void addTrack(String id, String trackId, String name, String userId) {
        Playlist p = playlistRepository.findByIdAndUserId(id, userId)
                .orElseThrow(() -> new AppException(ErrorCode.NOT_FOUND));

        if (!trackId.matches("\\d+")) {
            throw new AppException(ErrorCode.NOT_FOUND);
        }
        MusicLibrary lib = musicLibraryRepository.findByIdAndUserId(trackId, userId).orElse(null);
        if (lib == null) {
            throw new AppException(ErrorCode.NOT_FOUND);
        }

        final String finalLibId = lib.getId();
        if (playlistItemRepository.existsByPlaylistIdAndMusicLibraryId(id, finalLibId)) {
            return;
        }

        int maxPos = playlistItemRepository.getMaxPosition(id);
        PlaylistItem item = PlaylistItem.builder()
                .playlist(p).musicLibrary(lib).position(maxPos + 1).build();
        playlistItemRepository.save(item);
    }

    @Transactional
    public void removeTrack(String id, String trackId, String userId) {
        // verify playlist exists and belongs to user
        playlistRepository.findByIdAndUserId(id, userId)
                .orElseThrow(() -> new AppException(ErrorCode.NOT_FOUND));

        if (trackId.matches("\\d+")) {
            playlistItemRepository.deleteByPlaylistIdAndMusicLibraryId(id, trackId);
        } else {
            playlistItemRepository.deleteByPlaylistIdAndDriveFileId(id, trackId);
        }
    }
}
