package com.music.app.exception;

import com.music.app.dto.ApiResponse;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ControllerAdvice;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.context.request.async.AsyncRequestTimeoutException;
import org.springframework.web.context.request.async.AsyncRequestNotUsableException;
import org.apache.catalina.connector.ClientAbortException;
import java.io.IOException;
import org.springframework.http.HttpStatus;

@ControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(value = AppException.class)
    public ResponseEntity<ApiResponse<Void>> handlingAppException(AppException exception) {
        ErrorCode errorCode = exception.getErrorCode();
        ApiResponse<Void> apiResponse = new ApiResponse<>();

        apiResponse.setCode(errorCode.getCode());
        apiResponse.setMessage(errorCode.getMessage());

        return ResponseEntity.status(errorCode.getStatusCode()).body(apiResponse);
    }

    @ExceptionHandler(value = {
        AsyncRequestTimeoutException.class, 
        AsyncRequestNotUsableException.class, 
        ClientAbortException.class,
        IOException.class
    })
    public ResponseEntity<Void> handlingAsyncTimeout(Exception exception) {
        return ResponseEntity.status(HttpStatus.REQUEST_TIMEOUT).build();
    }

    @ExceptionHandler(value = Exception.class)
    public ResponseEntity<ApiResponse<Void>> handlingRuntimeException(Exception exception) {
        ApiResponse<Void> apiResponse = new ApiResponse<>();

        apiResponse.setCode(ErrorCode.UNCATEGORIZED_EXCEPTION.getCode());
        apiResponse.setMessage(ErrorCode.UNCATEGORIZED_EXCEPTION.getMessage());

        return ResponseEntity.internalServerError().body(apiResponse);
    }
}
