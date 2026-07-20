package com.music.app.util;

import java.security.Principal;

import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;

import com.music.app.exception.AppException;
import com.music.app.exception.ErrorCode;

public class SecurityUtils {

    public static String extractUserId(Principal principal) {
        if (principal == null) {
            throw new AppException(ErrorCode.UNAUTHORIZED);
        }
        if (principal
                instanceof
                org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken
                jwtAuth) {
            String userId = jwtAuth.getToken().getClaimAsString("userId");
            if (userId != null) {
                return userId;
            }
        }
        try {
            return principal.getName();
        } catch (NumberFormatException e) {
            throw new AppException(ErrorCode.UNAUTHORIZED);
        }
    }

    public static String getCurrentUserId() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated()) {
            throw new AppException(ErrorCode.UNAUTHORIZED);
        }
        if (auth
                instanceof
                org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken
                jwtAuth) {
            String userId = jwtAuth.getToken().getClaimAsString("userId");
            if (userId != null) {
                return userId;
            }
        }
        try {
            return auth.getName();
        } catch (NumberFormatException e) {
            throw new AppException(ErrorCode.UNAUTHORIZED);
        }
    }
}
