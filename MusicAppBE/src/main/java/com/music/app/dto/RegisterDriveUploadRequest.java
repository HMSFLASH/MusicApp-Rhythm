package com.music.app.dto;

import lombok.Data;

@Data
public class RegisterDriveUploadRequest {
    private String driveFileId;
    private String fileName;
    private String title;
    private String artist;
    private String album;
    private String genre;
    private String imageUrl;
    private Long durationSeconds;
}
