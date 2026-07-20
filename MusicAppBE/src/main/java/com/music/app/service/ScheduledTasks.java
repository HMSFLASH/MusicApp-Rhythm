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
}
