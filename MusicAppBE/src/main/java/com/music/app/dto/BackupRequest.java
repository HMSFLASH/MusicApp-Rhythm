package com.music.app.dto;

import lombok.Data;
import java.util.Map;

@Data
public class BackupRequest {
    private Map<String, Object> config;
    private Map<String, Object> idbData;
}
