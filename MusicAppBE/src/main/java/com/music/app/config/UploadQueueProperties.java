package com.music.app.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "app.upload")
public class UploadQueueProperties {
    private int maxConcurrent = 2;
    private int queueCapacity = 50;
    private int shutdownAwaitSeconds = 30;

    public int getMaxConcurrent() {
        return maxConcurrent;
    }

    public void setMaxConcurrent(int maxConcurrent) {
        this.maxConcurrent = maxConcurrent;
    }

    public int getQueueCapacity() {
        return queueCapacity;
    }

    public void setQueueCapacity(int queueCapacity) {
        this.queueCapacity = queueCapacity;
    }

    public int getShutdownAwaitSeconds() {
        return shutdownAwaitSeconds;
    }

    public void setShutdownAwaitSeconds(int shutdownAwaitSeconds) {
        this.shutdownAwaitSeconds = shutdownAwaitSeconds;
    }
}
