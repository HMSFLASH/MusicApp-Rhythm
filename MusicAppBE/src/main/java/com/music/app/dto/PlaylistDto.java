package com.music.app.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PlaylistDto {
    private Long id;
    private String name;
    private String description;
    private String imageUrl;
    private int trackCount;
    private LocalDateTime createdAt;
    private List<MusicItemDto> tracks;
}
