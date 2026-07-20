package com.music.app.dto;

import java.util.Map;

import lombok.Data;

@Data
public class BackupRequest {
    private Map<String, Object> config;
    private Map<String, Object> idbData;
}
