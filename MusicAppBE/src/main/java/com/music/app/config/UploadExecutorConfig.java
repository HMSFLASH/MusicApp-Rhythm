package com.music.app.config;

import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;

@Configuration
@EnableConfigurationProperties(UploadQueueProperties.class)
public class UploadExecutorConfig {

    @Bean(name = "uploadTaskExecutor")
    public ThreadPoolTaskExecutor uploadTaskExecutor(UploadQueueProperties properties) {
        int maxConcurrent = Math.max(1, properties.getMaxConcurrent());
        int queueCapacity = Math.max(0, properties.getQueueCapacity());
        int shutdownAwaitSeconds = Math.max(0, properties.getShutdownAwaitSeconds());

        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(maxConcurrent);
        executor.setMaxPoolSize(maxConcurrent);
        executor.setQueueCapacity(queueCapacity);
        executor.setThreadNamePrefix("upload-worker-");
        executor.setWaitForTasksToCompleteOnShutdown(true);
        executor.setAwaitTerminationSeconds(shutdownAwaitSeconds);
        executor.initialize();
        return executor;
    }
}
