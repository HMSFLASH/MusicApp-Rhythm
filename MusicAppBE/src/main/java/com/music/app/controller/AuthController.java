package com.music.app.controller;

import com.music.app.dto.AuthenticationResponse;
import com.music.app.dto.RefreshRequest;
import com.music.app.dto.RegisterRequest;
import com.music.app.dto.LoginRequest;
import com.music.app.dto.ApiResponse;
import com.music.app.service.AuthService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import jakarta.validation.Valid;

import java.util.Map;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.Authentication;
import com.music.app.dto.SetPasswordRequest;
import org.springframework.web.bind.annotation.CookieValue;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseCookie;
import org.springframework.security.web.csrf.CsrfToken;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;

    @Value("${app.cookie.secure:true}")
    private boolean secureCookies;

    private void setTokenCookie(HttpServletResponse response, String token) {
        response.addHeader("Set-Cookie", ResponseCookie.from("music_app_token", token)
                .httpOnly(true).secure(secureCookies).sameSite("Strict").path("/")
                .maxAge(7 * 24 * 60 * 60).build().toString());
    }

    private void setRefreshTokenCookie(HttpServletResponse response, String refreshToken) {
        if (refreshToken != null) {
            response.addHeader("Set-Cookie", ResponseCookie.from("music_app_refresh_token", refreshToken)
                    .httpOnly(true).secure(secureCookies).sameSite("Strict").path("/api/auth/refresh")
                    .maxAge(30 * 24 * 60 * 60).build().toString());
        }
    }

    private void clearTokenCookie(HttpServletResponse response) {
        response.addHeader("Set-Cookie", ResponseCookie.from("music_app_token", "")
                .httpOnly(true).secure(secureCookies).sameSite("Strict").path("/").maxAge(0).build().toString());
    }

    private void clearRefreshTokenCookie(HttpServletResponse response) {
        response.addHeader("Set-Cookie", ResponseCookie.from("music_app_refresh_token", "")
                .httpOnly(true).secure(secureCookies).sameSite("Strict").path("/api/auth/refresh").maxAge(0).build().toString());
    }

    @PostMapping("/register")
    public ApiResponse<AuthenticationResponse> register(@Valid @RequestBody RegisterRequest request, HttpServletResponse response) {
        AuthenticationResponse authResponse = authService.registerUser(request.getUsername(), request.getPassword(), request.getEmail());
        setTokenCookie(response, authResponse.getAccessToken());
        setRefreshTokenCookie(response, authResponse.getRefreshToken());
        return ApiResponse.<AuthenticationResponse>builder()
                .result(authResponse)
                .build();
    }

    @PostMapping("/login")
    public ApiResponse<AuthenticationResponse> login(@Valid @RequestBody LoginRequest request, HttpServletResponse response) {
        String loginId = request.getLoginId() != null ? request.getLoginId().trim() : null;
        AuthenticationResponse authResponse = authService.login(loginId, request.getPassword());
        setTokenCookie(response, authResponse.getAccessToken());
        setRefreshTokenCookie(response, authResponse.getRefreshToken());
        return ApiResponse.<AuthenticationResponse>builder()
                .result(authResponse)
                .build();
    }

    @PostMapping("/logout")
    public ApiResponse<Void> logout(@CookieValue(name = "music_app_token", required = false) String tokenCookie,
            @CookieValue(name = "music_app_refresh_token", required = false) String refreshTokenCookie,
            @RequestHeader(value = "Authorization", required = false) String tokenHeader, HttpServletResponse response) {
        String token = tokenCookie != null ? tokenCookie : (tokenHeader != null && tokenHeader.startsWith("Bearer ") ? tokenHeader.substring(7) : tokenHeader);
        if (token != null) {
            authService.logout(token);
        }
        if (refreshTokenCookie != null) {
            authService.logout(refreshTokenCookie);
        }
        clearTokenCookie(response);
        clearRefreshTokenCookie(response);
        return ApiResponse.<Void>builder().build();
    }

    @PostMapping("/refresh")
    public ApiResponse<AuthenticationResponse> refresh(@CookieValue(name = "music_app_refresh_token", required = false) String refreshTokenCookie, HttpServletResponse response) {
        if (refreshTokenCookie == null || refreshTokenCookie.isEmpty()) {
            throw new com.music.app.exception.AppException(com.music.app.exception.ErrorCode.UNAUTHENTICATED, "Refresh token is missing");
        }
        AuthenticationResponse authResponse = authService.refreshToken(new RefreshRequest(refreshTokenCookie));
        setTokenCookie(response, authResponse.getAccessToken());
        setRefreshTokenCookie(response, authResponse.getRefreshToken());
        return ApiResponse.<AuthenticationResponse>builder()
                .result(authResponse)
                .build();
    }

    @PostMapping("/set-password")
    public ResponseEntity<ApiResponse<?>> setPassword(@Valid @RequestBody SetPasswordRequest request, HttpServletResponse response) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || auth.getName().equals("anonymousUser")) {
            return ResponseEntity.status(401).body(ApiResponse.builder().code(401).message("Not authenticated").build());
        }
        String currentSubject = auth.getName();
        AuthenticationResponse authResponse = authService.setLocalCredentials(currentSubject, request.getLoginId(), request.getPassword());
        setTokenCookie(response, authResponse.getAccessToken());
        setRefreshTokenCookie(response, authResponse.getRefreshToken());
        return ResponseEntity.ok(ApiResponse.builder().result(authResponse).build());
    }

    @PostMapping("/change-password")
    public ResponseEntity<ApiResponse<?>> changePassword(@Valid @RequestBody com.music.app.dto.ChangePasswordRequest request, HttpServletResponse response) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || auth.getName().equals("anonymousUser")) {
            return ResponseEntity.status(401).body(ApiResponse.builder().code(401).message("Not authenticated").build());
        }
        String currentSubject = auth.getName();
        AuthenticationResponse authResponse = authService.changePassword(currentSubject, request.getOldPassword(), request.getNewPassword());
        setTokenCookie(response, authResponse.getAccessToken());
        setRefreshTokenCookie(response, authResponse.getRefreshToken());
        return ResponseEntity.ok(ApiResponse.builder().result(authResponse).build());
    }

    @GetMapping("/csrf")
    public CsrfToken csrf(CsrfToken csrfToken) {
        return csrfToken;
    }
    
    @PostMapping("/forgot-password")
    public ApiResponse<Map<String, String>> forgotPassword(@RequestBody Map<String, String> request) {
        try {
            String email = request.get("email");
            authService.generatePasswordResetToken(email);
            return ApiResponse.<Map<String, String>>builder()
                    .result(Map.of("message", "If your email is registered, you will receive a password reset link shortly."))
                    .build();
        } catch (Exception e) {
            return ApiResponse.<Map<String, String>>builder()
                    .result(Map.of("message", "If your email is registered, you will receive a password reset link shortly."))
                    .build();
        }
    }

    @PostMapping("/reset-password")
    public ResponseEntity<ApiResponse<Map<String, String>>> resetPassword(@RequestBody Map<String, String> request) {
        try {
            String token = request.get("token");
            String newPassword = request.get("newPassword");
            authService.resetPassword(token, newPassword);
            return ResponseEntity.ok(ApiResponse.<Map<String, String>>builder()
                    .result(Map.of("message", "Password has been successfully reset."))
                    .build());
        } catch (Exception e) {
            return ResponseEntity.status(400).body(ApiResponse.<Map<String, String>>builder()
                    .code(400)
                    .message(e.getMessage())
                    .build());
        }
    }

    @GetMapping("/me")
    public ResponseEntity<ApiResponse<com.music.app.dto.UserDto>> getCurrentUser() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || auth.getName().equals("anonymousUser")) {
            return ResponseEntity.status(401).body(ApiResponse.<com.music.app.dto.UserDto>builder().code(401).message("Not authenticated").build());
        }
        com.music.app.dto.UserDto user = authService.getUserDtoByLoginId(auth.getName());
        if (user == null) {
            return ResponseEntity.status(401).body(ApiResponse.<com.music.app.dto.UserDto>builder().code(401).message("User not found").build());
        }
        return ResponseEntity.ok(ApiResponse.<com.music.app.dto.UserDto>builder().result(user).build());
    }

}
