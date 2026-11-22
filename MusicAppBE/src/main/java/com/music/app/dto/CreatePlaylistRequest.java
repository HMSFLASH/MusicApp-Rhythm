package com.music.app.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import lombok.Data;

@Data
public class CreatePlaylistRequest {
    @NotBlank(message = "Playlist name is required")
    @Size(max = 255, message = "Playlist name must be at most 255 characters")
    private String name;

    private String imageUrl;
}
