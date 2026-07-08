package com.music.app.controller;

import com.music.app.dto.AuthenticationResponse;
import com.music.app.dto.RefreshRequest;
import com.music.app.service.AuthService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import org.springframework.security.core.context.SecurityContextHolder;
import com.music.app.dto.SetPasswordRequest;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;

    @PostMapping("/register")
    public ResponseEntity<AuthenticationResponse> register(@RequestBody Map<String, String> request) {
        String username = request.get("username");
        String password = request.get("password");
        String email = request.get("email");
        return ResponseEntity.ok(authService.registerUser(username, password, email));
    }

    @PostMapping("/login")
    public ResponseEntity<AuthenticationResponse> login(@RequestBody Map<String, String> request) {
        String loginId = request.get("loginId");
        String password = request.get("password");
        return ResponseEntity.ok(authService.login(loginId, password));
    }

    @PostMapping("/google")
    public ResponseEntity<AuthenticationResponse> googleLogin(@RequestBody Map<String, String> request) {
        String googleId = request.get("googleId");
        String email = request.get("email");
        String name = request.get("name");
        String picture = request.get("picture");
        // Verify google token here if needed (omitted for brevity)
        return ResponseEntity.ok(authService.loginWithGoogle(googleId, email, name, picture));
    }
    
    @PostMapping("/logout")
    public ResponseEntity<Void> logout(@RequestHeader("Authorization") String token) {
        authService.logout(token);
        return ResponseEntity.ok().build();
    }

    @PostMapping("/refresh")
    public ResponseEntity<AuthenticationResponse> refresh(@RequestBody RefreshRequest request) {
        return ResponseEntity.ok(authService.refreshToken(request));
    }

    @PostMapping("/set-password")
    public ResponseEntity<?> setPassword(@RequestBody SetPasswordRequest request) {
        try {
            org.springframework.security.core.Authentication auth = SecurityContextHolder.getContext().getAuthentication();
            if (auth == null || auth.getName().equals("anonymousUser")) {
                return ResponseEntity.status(401).body(Map.of("message", "Not authenticated"));
            }
            String currentSubject = auth.getName();
            com.music.app.dto.AuthenticationResponse response = authService.setLocalCredentials(currentSubject, request.getLoginId(), request.getPassword());
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.status(500).body(Map.of("message", e.getMessage()));
        }
    }
    @PostMapping("/forgot-password")
    public ResponseEntity<?> forgotPassword(@RequestBody Map<String, String> request) {
        try {
            String email = request.get("email");
            authService.generatePasswordResetToken(email);
            return ResponseEntity.ok(Map.of("message", "If your email is registered, you will receive a password reset link shortly."));
        } catch (Exception e) {
            // Do not reveal if email exists or not to prevent user enumeration
            return ResponseEntity.ok(Map.of("message", "If your email is registered, you will receive a password reset link shortly."));
        }
    }

    @PostMapping("/reset-password")
    public ResponseEntity<?> resetPassword(@RequestBody Map<String, String> request) {
        try {
            String token = request.get("token");
            String newPassword = request.get("newPassword");
            authService.resetPassword(token, newPassword);
            return ResponseEntity.ok(Map.of("message", "Password has been successfully reset."));
        } catch (Exception e) {
            return ResponseEntity.status(400).body(Map.of("message", e.getMessage()));
        }
    }

}
