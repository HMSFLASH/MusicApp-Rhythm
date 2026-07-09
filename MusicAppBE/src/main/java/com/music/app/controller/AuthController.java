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

import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletResponse;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;

    private void setTokenCookie(HttpServletResponse response, String token) {
        Cookie cookie = new Cookie("music_app_token", token);
        cookie.setHttpOnly(true);
        cookie.setSecure(true);
        cookie.setPath("/");
        cookie.setMaxAge(7 * 24 * 60 * 60); // 7 days
        // Cookie spec for SameSite is usually handled via header, but Servlet 6.0 supports setAttribute
        // If Servlet API < 6.0, we can add it via header, let's use header to be safe:
        response.addHeader("Set-Cookie", "music_app_token=" + token + "; Path=/; Max-Age=" + (7 * 24 * 60 * 60) + "; HttpOnly; SameSite=Lax");
    }

    private void setRefreshTokenCookie(HttpServletResponse response, String refreshToken) {
        if (refreshToken != null) {
            response.addHeader("Set-Cookie", "music_app_refresh_token=" + refreshToken + "; Path=/api/auth/refresh; Max-Age=" + (30 * 24 * 60 * 60) + "; HttpOnly; SameSite=Lax");
        }
    }

    private void clearTokenCookie(HttpServletResponse response) {
        response.addHeader("Set-Cookie", "music_app_token=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax");
    }

    private void clearRefreshTokenCookie(HttpServletResponse response) {
        response.addHeader("Set-Cookie", "music_app_refresh_token=; Path=/api/auth/refresh; Max-Age=0; HttpOnly; SameSite=Lax");
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
        AuthenticationResponse authResponse = authService.login(request.getLoginId(), request.getPassword());
        setTokenCookie(response, authResponse.getAccessToken());
        setRefreshTokenCookie(response, authResponse.getRefreshToken());
        return ApiResponse.<AuthenticationResponse>builder()
                .result(authResponse)
                .build();
    }

    @PostMapping("/google")
    public ApiResponse<AuthenticationResponse> googleLogin(@RequestBody Map<String, String> request, HttpServletResponse response) {
        String googleId = request.get("googleId");
        String email = request.get("email");
        String name = request.get("name");
        String picture = request.get("picture");
        AuthenticationResponse authResponse = authService.loginWithGoogle(googleId, email, name, picture);
        setTokenCookie(response, authResponse.getAccessToken());
        setRefreshTokenCookie(response, authResponse.getRefreshToken());
        return ApiResponse.<AuthenticationResponse>builder()
                .result(authResponse)
                .build();
    }
    
    @PostMapping("/logout")
    public ApiResponse<Void> logout(@CookieValue(name = "music_app_token", required = false) String tokenCookie, @RequestHeader(value = "Authorization", required = false) String tokenHeader, HttpServletResponse response) {
        String token = tokenCookie != null ? tokenCookie : (tokenHeader != null && tokenHeader.startsWith("Bearer ") ? tokenHeader.substring(7) : tokenHeader);
        if (token != null) {
            authService.logout(token);
        }
        clearTokenCookie(response);
        clearRefreshTokenCookie(response);
        return ApiResponse.<Void>builder().build();
    }

    @PostMapping("/refresh")
    public ApiResponse<AuthenticationResponse> refresh(@RequestBody(required = false) RefreshRequest request, @CookieValue(name = "music_app_refresh_token", required = false) String refreshTokenCookie, HttpServletResponse response) {
        String token = (request != null && request.getRefreshToken() != null) ? request.getRefreshToken() : refreshTokenCookie;
        if (token == null || token.isEmpty()) {
            throw new RuntimeException("Refresh token is missing");
        }
        RefreshRequest req = new RefreshRequest(token);
        AuthenticationResponse authResponse = authService.refreshToken(req);
        setTokenCookie(response, authResponse.getAccessToken());
        setRefreshTokenCookie(response, authResponse.getRefreshToken());
        return ApiResponse.<AuthenticationResponse>builder()
                .result(authResponse)
                .build();
    }

    @PostMapping("/set-password")
    public ResponseEntity<ApiResponse<?>> setPassword(@RequestBody SetPasswordRequest request, HttpServletResponse response) {
        try {
            Authentication auth = SecurityContextHolder.getContext().getAuthentication();
            if (auth == null || auth.getName().equals("anonymousUser")) {
                return ResponseEntity.status(401).body(ApiResponse.builder().code(401).message("Not authenticated").build());
            }
            String currentSubject = auth.getName();
            AuthenticationResponse authResponse = authService.setLocalCredentials(currentSubject, request.getLoginId(), request.getPassword());
            setTokenCookie(response, authResponse.getAccessToken());
            setRefreshTokenCookie(response, authResponse.getRefreshToken());
            return ResponseEntity.ok(ApiResponse.builder().result(authResponse).build());
        } catch (Exception e) {
            return ResponseEntity.status(500).body(ApiResponse.builder().code(500).message(e.getMessage()).build());
        }
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
