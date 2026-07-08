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

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;

    @PostMapping("/register")
    public ApiResponse<AuthenticationResponse> register(@Valid @RequestBody RegisterRequest request) {
        return ApiResponse.<AuthenticationResponse>builder()
                .result(authService.registerUser(request.getUsername(), request.getPassword(), request.getEmail()))
                .build();
    }

    @PostMapping("/login")
    public ApiResponse<AuthenticationResponse> login(@Valid @RequestBody LoginRequest request) {
        return ApiResponse.<AuthenticationResponse>builder()
                .result(authService.login(request.getLoginId(), request.getPassword()))
                .build();
    }

    @PostMapping("/google")
    public ApiResponse<AuthenticationResponse> googleLogin(@RequestBody Map<String, String> request) {
        String googleId = request.get("googleId");
        String email = request.get("email");
        String name = request.get("name");
        String picture = request.get("picture");
        return ApiResponse.<AuthenticationResponse>builder()
                .result(authService.loginWithGoogle(googleId, email, name, picture))
                .build();
    }
    
    @PostMapping("/logout")
    public ApiResponse<Void> logout(@RequestHeader("Authorization") String token) {
        authService.logout(token);
        return ApiResponse.<Void>builder().build();
    }

    @PostMapping("/refresh")
    public ApiResponse<AuthenticationResponse> refresh(@RequestBody RefreshRequest request) {
        return ApiResponse.<AuthenticationResponse>builder()
                .result(authService.refreshToken(request))
                .build();
    }

    @PostMapping("/set-password")
    public ResponseEntity<ApiResponse<?>> setPassword(@RequestBody SetPasswordRequest request) {
        try {
            Authentication auth = SecurityContextHolder.getContext().getAuthentication();
            if (auth == null || auth.getName().equals("anonymousUser")) {
                return ResponseEntity.status(401).body(ApiResponse.builder().code(401).message("Not authenticated").build());
            }
            String currentSubject = auth.getName();
            AuthenticationResponse response = authService.setLocalCredentials(currentSubject, request.getLoginId(), request.getPassword());
            return ResponseEntity.ok(ApiResponse.builder().result(response).build());
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

}
