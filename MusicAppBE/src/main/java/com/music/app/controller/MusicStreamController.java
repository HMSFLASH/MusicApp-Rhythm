package com.music.app.controller;

import com.music.app.dto.DriveStreamResponse;
import com.music.app.model.MusicLibrary;
import com.music.app.model.User;
import com.music.app.repository.MusicLibraryRepository;
import com.music.app.repository.UserRepository;
import com.music.app.service.GoogleDriveService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.method.annotation.StreamingResponseBody;
import java.io.InputStream;
import java.net.URL;
import java.security.Principal;

@RestController
@RequestMapping("/api/music")
@RequiredArgsConstructor
@Slf4j
public class MusicStreamController {

    private final GoogleDriveService googleDriveService;
    private final UserRepository userRepository;
    private final MusicLibraryRepository musicLibraryRepository;

    @GetMapping("/stream/{fileId}")
    public ResponseEntity<StreamingResponseBody> streamMusic(
            @PathVariable String fileId,
            @RequestHeader(value = HttpHeaders.RANGE, required = false) String rangeHeader,
            Principal principal) {
        
        try {
            String driveFileIdToUse = fileId;
            // Kiểm tra xem fileId có phải là một số (MusicLibrary ID) hay không
            if (fileId.matches("\\d+")) {
                MusicLibrary lib = musicLibraryRepository.findById(Long.valueOf(fileId)).orElse(null);
                if (lib != null) {
                    if ("DRIVE".equals(lib.getSourceType()) && lib.getDriveFileId() != null) {
                        driveFileIdToUse = lib.getDriveFileId();
                    }
                }
            }

            // Xử lý luồng DRIVE
            if (!(principal instanceof JwtAuthenticationToken)) {
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
            }

            JwtAuthenticationToken token = (JwtAuthenticationToken) principal;
            String userIdStr = token.getToken().getClaimAsString("userId");
            if (userIdStr == null) {
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
            }

            Long userId = Long.valueOf(userIdStr);
            User user = userRepository.findById(userId).orElse(null);
            
            if (user == null || user.getRefreshToken() == null) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
            }

            DriveStreamResponse driveResponse = googleDriveService.streamFile(driveFileIdToUse, rangeHeader, user.getRefreshToken());

            StreamingResponseBody responseBody = outputStream -> {
                try (InputStream is = driveResponse.getInputStream()) {
                    byte[] buffer = new byte[65536];
                    int bytesRead;
                    while ((bytesRead = is.read(buffer)) != -1) {
                        outputStream.write(buffer, 0, bytesRead);
                    }
                } catch (Exception e) {
                    String msg = e.getMessage() != null ? e.getMessage().toLowerCase() : "";
                    if (e.getClass().getName().contains("ClientAbortException") || 
                        e.getClass().getName().contains("AsyncRequestNotUsableException") ||
                        msg.contains("broken pipe") || 
                        msg.contains("connection reset by peer") ||
                        msg.contains("an established connection was aborted")) {
                        log.debug("Client aborted connection during Drive stream (expected)");
                    } else {
                        log.error("Error streaming data to client", e);
                    }
                }
            };

            HttpHeaders responseHeaders = new HttpHeaders();
            responseHeaders.setAccessControlAllowOrigin("*");
            responseHeaders.set(HttpHeaders.ACCEPT_RANGES, "bytes");
            
            if (driveResponse.getContentType() != null) {
                responseHeaders.setContentType(MediaType.parseMediaType(driveResponse.getContentType()));
            } else {
                responseHeaders.setContentType(MediaType.parseMediaType("audio/mpeg"));
            }

            if (driveResponse.getContentLength() != null) {
                responseHeaders.setContentLength(driveResponse.getContentLength());
            }

            if (driveResponse.getContentRange() != null) {
                responseHeaders.set(HttpHeaders.CONTENT_RANGE, driveResponse.getContentRange());
            }

            return new ResponseEntity<>(responseBody, responseHeaders, HttpStatus.valueOf(driveResponse.getStatusCode()));
            
        } catch (com.google.api.client.http.HttpResponseException e) {
            log.error("Google Drive API Error: {}", e.getMessage());
            return ResponseEntity.status(e.getStatusCode()).build();
        } catch (Exception e) {
            log.error("Failed to stream music", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }
}
