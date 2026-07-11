package com.music.app.service;

import com.music.app.exception.AppException;
import com.music.app.exception.ErrorCode;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.core.task.TaskRejectedException;
import org.springframework.stereotype.Service;

import java.util.concurrent.Callable;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionException;
import java.util.concurrent.Executor;
import java.util.concurrent.RejectedExecutionException;

@Service
@Slf4j
public class UploadQueueService {
    private final Executor uploadTaskExecutor;

    public UploadQueueService(@Qualifier("uploadTaskExecutor") Executor uploadTaskExecutor) {
        this.uploadTaskExecutor = uploadTaskExecutor;
    }

    public <T> T run(Callable<T> task) {
        try {
            return CompletableFuture.supplyAsync(() -> {
                try {
                    return task.call();
                } catch (AppException exception) {
                    throw exception;
                } catch (Exception exception) {
                    throw new CompletionException(exception);
                }
            }, uploadTaskExecutor).join();
        } catch (TaskRejectedException exception) {
            log.warn("Upload queue is full; rejecting upload request");
            throw new AppException(ErrorCode.UPLOAD_QUEUE_FULL,
                    "Upload queue is full. Please try again in a moment.");
        } catch (RejectedExecutionException exception) {
            log.warn("Upload queue is full; rejecting upload request");
            throw new AppException(ErrorCode.UPLOAD_QUEUE_FULL,
                    "Upload queue is full. Please try again in a moment.");
        } catch (CompletionException exception) {
            Throwable cause = exception.getCause();
            if (cause instanceof AppException appException) {
                throw appException;
            }
            if (cause instanceof RuntimeException runtimeException) {
                throw runtimeException;
            }
            throw new AppException(ErrorCode.UNCATEGORIZED_EXCEPTION,
                    cause != null ? cause.getMessage() : "Failed to process upload");
        }
    }
}
