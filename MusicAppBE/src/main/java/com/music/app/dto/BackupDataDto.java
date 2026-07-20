package com.music.app.dto;

import java.util.List;
import java.util.Map;

import lombok.Data;

@Data
public class BackupDataDto {
    private Map<String, Object> config;
    private Map<String, Object> idbData;
    private List<PlaylistDto> playlists;
    private List<MusicItemDto> favorites;
    private List<MusicItemDto> library;
}
