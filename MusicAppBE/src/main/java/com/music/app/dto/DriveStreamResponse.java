package com.music.app.dto;

import java.io.InputStream;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class DriveStreamResponse {
    private InputStream inputStream;
    private int statusCode;
    private String contentType;
    private Long contentLength;
    private String contentRange;
}
