package com.music.app.dto;

import lombok.Data;
import java.util.List;
import java.util.Map;

@Data
public class BackupDataDto {
    private Map<String, Object> config;
    private List<PlaylistDto> playlists;
    private List<MusicItemDto> favorites;
    private List<MusicItemDto> library;
}
