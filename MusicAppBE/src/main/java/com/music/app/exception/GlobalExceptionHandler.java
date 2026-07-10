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
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.http.converter.HttpMessageNotReadableException;

import lombok.extern.slf4j.Slf4j;

@Slf4j
@ControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(value = AppException.class)
    public ResponseEntity<ApiResponse<Void>> handlingAppException(AppException exception) {
        log.warn("AppException occurred: {}", exception.getMessage());
        ErrorCode errorCode = exception.getErrorCode();
        ApiResponse<Void> apiResponse = new ApiResponse<>();

        apiResponse.setCode(errorCode.getCode());
        apiResponse.setMessage(exception.getMessage() != null ? exception.getMessage() : errorCode.getMessage());

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
        log.error("Uncaught exception occurred: ", exception);
        ApiResponse<Void> apiResponse = new ApiResponse<>();

        apiResponse.setCode(ErrorCode.UNCATEGORIZED_EXCEPTION.getCode());
        // Trả về message thực tế của lỗi để dễ debug thay vì "Uncategorized error" chung chung
        apiResponse.setMessage(exception.getMessage() != null ? exception.getMessage() : ErrorCode.UNCATEGORIZED_EXCEPTION.getMessage());

        return ResponseEntity.internalServerError().body(apiResponse);
    }

    @ExceptionHandler(value = { MethodArgumentNotValidException.class, HttpMessageNotReadableException.class })
    public ResponseEntity<ApiResponse<Void>> handlingValidationException(Exception exception) {
        ApiResponse<Void> apiResponse = new ApiResponse<>();
        apiResponse.setCode(HttpStatus.BAD_REQUEST.value());
        apiResponse.setMessage("Invalid request");
        return ResponseEntity.badRequest().body(apiResponse);
    }
}
