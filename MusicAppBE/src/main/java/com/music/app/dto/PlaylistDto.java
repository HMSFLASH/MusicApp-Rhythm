package com.music.app.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
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
@JsonIgnoreProperties(ignoreUnknown = true)
public class PlaylistDto {
    private String id;
    private String name;
    private String imageUrl;
    private int trackCount;
    private LocalDateTime createdAt;
    private List<MusicItemDto> tracks;
}
