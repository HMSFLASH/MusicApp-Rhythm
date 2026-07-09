package com.music.app.config.security;

import com.music.app.dto.AuthenticationResponse;
import com.music.app.service.AuthService;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.client.OAuth2AuthorizedClient;
import org.springframework.security.oauth2.client.OAuth2AuthorizedClientService;
import org.springframework.security.oauth2.client.authentication.OAuth2AuthenticationToken;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.security.web.authentication.SimpleUrlAuthenticationSuccessHandler;
import org.springframework.stereotype.Component;

import java.io.IOException;

import org.springframework.context.annotation.Lazy;

@Component
@Slf4j
public class OAuth2LoginSuccessHandler extends SimpleUrlAuthenticationSuccessHandler {

    private final AuthService authService;
    private final OAuth2AuthorizedClientService authorizedClientService;

    public OAuth2LoginSuccessHandler(@Lazy AuthService authService, OAuth2AuthorizedClientService authorizedClientService) {
        this.authService = authService;
        this.authorizedClientService = authorizedClientService;
    }

    @Override
    public void onAuthenticationSuccess(HttpServletRequest request, HttpServletResponse response, Authentication authentication) throws IOException, ServletException {
        if (authentication instanceof OAuth2AuthenticationToken) {
            OAuth2AuthenticationToken oauthToken = (OAuth2AuthenticationToken) authentication;
            OAuth2User oAuth2User = oauthToken.getPrincipal();

            String googleId = oAuth2User.getAttribute("sub");
            String email = oAuth2User.getAttribute("email");
            String name = oAuth2User.getAttribute("name");
            String picture = oAuth2User.getAttribute("picture");
            
            OAuth2AuthorizedClient client = authorizedClientService.loadAuthorizedClient(
                    oauthToken.getAuthorizedClientRegistrationId(), oauthToken.getName());
            
            String refreshToken = null;
            if (client != null && client.getRefreshToken() != null) {
                refreshToken = client.getRefreshToken().getTokenValue();
            }

            log.info("Google login successful for email: {}", email);
            if (refreshToken != null) {
                log.info("Received refresh token for Google Drive integration");
            }

            AuthenticationResponse authResponse = authService.loginWithGoogleAndSaveRefresh(googleId, email, name, picture, refreshToken);

            String requestOrigin = request.getHeader("Origin");
            if (requestOrigin == null || requestOrigin.isEmpty()) {
                requestOrigin = request.getHeader("Referer");
            }
            String host = "localhost:5173";
            if (requestOrigin != null && !requestOrigin.isEmpty()) {
                 try {
                     java.net.URL url = new java.net.URL(requestOrigin);
                     host = url.getHost() + ":5173";
                 } catch (Exception e) {
                     // ignore
                 }
            } else {
                 host = request.getServerName() + ":5173";
            }
            
            String scheme = request.getScheme(); // http or https
            String targetUrl = scheme + "://" + host + "/oauth2/callback";
            
            String token = authResponse.getAccessToken();
            response.addHeader("Set-Cookie", "music_app_token=" + token + "; Path=/; Max-Age=" + (7 * 24 * 60 * 60) + "; HttpOnly; SameSite=Lax");
            
            String backendRefreshToken = authResponse.getRefreshToken();
            if (backendRefreshToken != null) {
                response.addHeader("Set-Cookie", "music_app_refresh_token=" + backendRefreshToken + "; Path=/api/auth/refresh; Max-Age=" + (30 * 24 * 60 * 60) + "; HttpOnly; SameSite=Lax");
            }
            
            getRedirectStrategy().sendRedirect(request, response, targetUrl);
        } else {
            super.onAuthenticationSuccess(request, response, authentication);
        }
    }
}
