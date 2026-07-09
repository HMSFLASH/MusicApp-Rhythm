package com.music.app.controller;

import com.music.app.dto.ApiResponse;
import com.music.app.dto.BackupRequest;
import com.music.app.service.BackupService;
import com.music.app.util.SecurityUtils;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;
import java.util.Map;

@RestController
@RequestMapping("/api/backup")
@RequiredArgsConstructor
@Slf4j
public class BackupController {

    private final BackupService backupService;

    @PostMapping("/drive")
    public ApiResponse<String> backupToDrive(@RequestBody BackupRequest request, Principal principal) {
        Long userId = SecurityUtils.extractUserId(principal);
        backupService.backupToDrive(request.getConfig(), request.getIdbData(), userId);
        return ApiResponse.<String>builder()
                .result("Backup successful")
                .build();
    }

    @GetMapping("/drive")
    public ApiResponse<Map<String, Object>> restoreFromDrive(Principal principal) {
        Long userId = SecurityUtils.extractUserId(principal);
        return ApiResponse.<Map<String, Object>>builder()
                .result(backupService.restoreFromDrive(userId))
                .build();
    }
}
