package com.music.app.service;

import java.time.LocalDateTime;

import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.music.app.repository.InvalidatedTokenRepository;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Service
@RequiredArgsConstructor
@Slf4j
public class ScheduledTasks {

    private final InvalidatedTokenRepository invalidatedTokenRepository;

    // Run every day at midnight (or whatever interval suits your needs, here 1 hour for safety)
    @Scheduled(fixedRate = 86400000)
    @Transactional
    public void cleanupExpiredTokens() {
        log.info("Starting cleanup of expired invalidated tokens...");
        invalidatedTokenRepository.deleteByExpiryTimeBefore(LocalDateTime.now());
        log.info("Finished cleanup of expired invalidated tokens.");
    }

    // Tự động gọi Supabase vào mỗi Thứ 6 lúc 12:00 trưa để ngăn Supabase tự tắt (Pause)
    // Cấu hình cron: "0 0 12 * * FRI"
    @Scheduled(cron = "0 0 12 * * FRI")
    public void pingSupabaseToKeepAlive() {
        log.info("Bắt đầu gọi API Supabase để giữ kết nối (Keep-Alive)...");
        try {
            org.springframework.web.client.RestTemplate restTemplate =
                    new org.springframework.web.client.RestTemplate();
            // Lấy URL từ biến môi trường, hoặc thay bằng URL thật của bạn
            String supabaseUrl = System.getenv("SUPABASE_URL");
            if (supabaseUrl != null && !supabaseUrl.isEmpty()) {
                // Gọi một API nhẹ (ví dụ health-check hoặc một REST API cơ bản)
                restTemplate.getForObject(supabaseUrl + "/rest/v1/", String.class);
                log.info("Đã gọi Supabase thành công!");
            } else {
                log.warn("Chưa cấu hình SUPABASE_URL, bỏ qua ping.");
            }
        } catch (Exception e) {
            log.error("Lỗi khi ping Supabase: {}", e.getMessage());
        }
    }
}
