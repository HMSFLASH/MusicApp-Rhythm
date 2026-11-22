package com.music.app.util;

import java.security.Principal;

import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;

import com.music.app.exception.AppException;
import com.music.app.exception.ErrorCode;

public class SecurityUtils {

    public static String extractUserId(Principal principal) {
        if (principal == null
                || principal.getName() == null
                || principal.getName().isBlank()
                || "anonymousUser".equals(principal.getName())) {
            throw new AppException(ErrorCode.UNAUTHORIZED);
        }
        if (principal instanceof JwtAuthenticationToken jwtAuth) {
            String userId = jwtAuth.getToken().getClaimAsString("userId");
            if (userId != null && !userId.isBlank()) {
                return userId;
            }
        }
        return principal.getName();
    }

    public static String getCurrentUserId() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null
                || !auth.isAuthenticated()
                || auth.getName() == null
                || auth.getName().isBlank()
                || "anonymousUser".equals(auth.getName())) {
            throw new AppException(ErrorCode.UNAUTHORIZED);
        }
        if (auth instanceof JwtAuthenticationToken jwtAuth) {
            String userId = jwtAuth.getToken().getClaimAsString("userId");
            if (userId != null && !userId.isBlank()) {
                return userId;
            }
        }
        return auth.getName();
    }
}
