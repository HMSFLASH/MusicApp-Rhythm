package com.music.app.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class MusicItemDto {
    private String id;
    private String name;
    private String title;
    private String artist;
    private String album;
    private String genre;
    private String imageUrl;
    private String lyrics;
    private Long durationSeconds;
    private String sourceType;
    private String driveFileId;
}
