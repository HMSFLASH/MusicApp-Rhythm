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
import com.music.app.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class PlaylistService {

    private final PlaylistRepository playlistRepository;
    private final MusicLibraryRepository musicLibraryRepository;
    private final UserRepository userRepository;
    private final MusicService musicService;

    public PlaylistDto toDto(Playlist p, boolean includeTracks) {
        List<MusicItemDto> tracks = includeTracks
                ? p.getItems().stream().map(i -> musicService.toDto(i.getMusicLibrary())).collect(Collectors.toList())
                : null;

        return PlaylistDto.builder()
                .id(p.getId())
                .name(p.getName())
                .description(p.getDescription())
                .imageUrl(p.getImageUrl())
                .trackCount(p.getTrackCount() != null ? p.getTrackCount() : 0)
                .createdAt(p.getCreatedAt())
                .tracks(tracks)
                .build();
    }

    public List<PlaylistDto> getPlaylists(Long userId) {
        return playlistRepository.findByUserIdOrderByCreatedAtDesc(userId)
                .stream().map(p -> toDto(p, false)).collect(Collectors.toList());
    }

    public PlaylistDto getPlaylist(Long id, Long userId) {
        return playlistRepository.findByIdAndUserIdWithItems(id, userId)
                .map(p -> toDto(p, true))
                .orElseThrow(() -> new AppException(ErrorCode.NOT_FOUND));
    }

    @Transactional
    public PlaylistDto createPlaylist(CreatePlaylistRequest req, Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_EXISTED));

        Playlist playlist = Playlist.builder()
                .name(req.getName())
                .description(req.getDescription())
                .imageUrl(req.getImageUrl())
                .user(user)
                .build();

        playlist = playlistRepository.save(playlist);
        return toDto(playlist, true);
    }

    @Transactional
    public PlaylistDto updatePlaylist(Long id, CreatePlaylistRequest req, Long userId) {
        Playlist p = playlistRepository.findByIdAndUserId(id, userId)
                .orElseThrow(() -> new AppException(ErrorCode.NOT_FOUND));

        if (req.getName() != null) p.setName(req.getName());
        if (req.getDescription() != null) p.setDescription(req.getDescription());
        if (req.getImageUrl() != null) p.setImageUrl(req.getImageUrl());
        return toDto(playlistRepository.save(p), false);
    }

    @Transactional
    public void deletePlaylist(Long id, Long userId) {
        Playlist p = playlistRepository.findByIdAndUserId(id, userId)
                .orElseThrow(() -> new AppException(ErrorCode.NOT_FOUND));
        playlistRepository.delete(p);
    }

    @Transactional
    public void addTrack(Long id, String trackId, String name, Long userId) {
        Playlist p = playlistRepository.findByIdAndUserId(id, userId)
                .orElseThrow(() -> new AppException(ErrorCode.NOT_FOUND));

        MusicLibrary lib = null;
        if (trackId.matches("\\d+")) {
            lib = musicLibraryRepository.findById(Long.valueOf(trackId)).orElse(null);
        } else {
            lib = musicLibraryRepository.findByDriveFileId(trackId).orElse(null);
            if (lib == null) {
                User user = userRepository.findById(userId)
                        .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_EXISTED));
                lib = musicLibraryRepository.save(MusicLibrary.builder()
                        .name(name != null ? name : "Drive File")
                        .driveFileId(trackId)
                        .sourceType("DRIVE")
                        .user(user)
                        .build());
            }
        }
        if (lib == null) {
            throw new AppException(ErrorCode.NOT_FOUND);
        }

        final Long finalLibId = lib.getId();
        boolean exists = p.getItems().stream()
                .anyMatch(i -> i.getMusicLibrary().getId().equals(finalLibId));
        if (exists) {
            return;
        }

        int pos = p.getItems().size();
        PlaylistItem item = PlaylistItem.builder()
                .playlist(p).musicLibrary(lib).position(pos).build();
        p.getItems().add(item);
        playlistRepository.save(p);
    }

    @Transactional
    public void removeTrack(Long id, String trackId, Long userId) {
        Playlist p = playlistRepository.findByIdAndUserId(id, userId)
                .orElseThrow(() -> new AppException(ErrorCode.NOT_FOUND));

        if (trackId.matches("\\d+")) {
            p.getItems().removeIf(i -> i.getMusicLibrary().getId().equals(Long.valueOf(trackId)));
        } else {
            p.getItems().removeIf(i -> trackId.equals(i.getMusicLibrary().getDriveFileId()));
        }
        
        for (int i = 0; i < p.getItems().size(); i++) {
            p.getItems().get(i).setPosition(i);
        }
        playlistRepository.save(p);
    }
}
