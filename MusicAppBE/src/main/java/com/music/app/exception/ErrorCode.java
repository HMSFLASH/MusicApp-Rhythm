package com.music.app.exception;

import org.springframework.http.HttpStatus;
import lombok.Getter;

@Getter
public enum ErrorCode {
    UNCATEGORIZED_EXCEPTION(9999, "Uncategorized error", HttpStatus.INTERNAL_SERVER_ERROR),
    USER_EXISTED(1001, "User already exists", HttpStatus.BAD_REQUEST),
    USER_NOT_EXISTED(1002, "User not found", HttpStatus.NOT_FOUND),
    INVALID_CREDENTIALS(1003, "Invalid credentials", HttpStatus.UNAUTHORIZED),
    NOT_FOUND(1004, "Not found", HttpStatus.NOT_FOUND),
    FORBIDDEN(1005, "Forbidden", HttpStatus.FORBIDDEN),
    UNAUTHENTICATED(1006, "Unauthenticated", HttpStatus.UNAUTHORIZED),
    UNAUTHORIZED(1007, "Unauthorized", HttpStatus.UNAUTHORIZED),
    DRIVE_NOT_LINKED(2001, "Google Drive not linked", HttpStatus.BAD_REQUEST),
    BACKUP_NOT_FOUND(2002, "No backup found on Drive", HttpStatus.NOT_FOUND),
    BACKUP_FAILED(2003, "Backup to Google Drive failed", HttpStatus.INTERNAL_SERVER_ERROR),
    RESTORE_FAILED(2004, "Restore from Google Drive failed", HttpStatus.INTERNAL_SERVER_ERROR),
    UPLOAD_QUEUE_FULL(3001, "Upload queue is full", HttpStatus.TOO_MANY_REQUESTS);

    private final int code;
    private final String message;
    private final HttpStatus statusCode;

    ErrorCode(int code, String message, HttpStatus statusCode) {
        this.code = code;
        this.message = message;
        this.statusCode = statusCode;
    }
}
