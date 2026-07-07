package com.music.app.dto;

import lombok.Data;

@Data
public class CreatePlaylistRequest {
    private String name;
    private String description;
    private String imageUrl;
}
