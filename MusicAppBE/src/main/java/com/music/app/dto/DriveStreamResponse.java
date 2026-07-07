package com.music.app.dto;

import lombok.Builder;
import lombok.Data;
import java.io.InputStream;

@Data
@Builder
public class DriveStreamResponse {
    private InputStream inputStream;
    private int statusCode;
    private String contentType;
    private Long contentLength;
    private String contentRange;
}
