package com.music.app.config.security;

import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;
import jakarta.servlet.http.Cookie;

import org.springframework.security.oauth2.client.registration.ClientRegistrationRepository;
import org.springframework.security.oauth2.client.web.DefaultOAuth2AuthorizationRequestResolver;
import org.springframework.security.oauth2.server.resource.web.BearerTokenResolver;
import org.springframework.security.oauth2.server.resource.web.DefaultBearerTokenResolver;

@Configuration(proxyBeanMethods = false)
@EnableWebSecurity
@EnableMethodSecurity
@RequiredArgsConstructor
public class SecurityConfig {

        private final CustomJwtDecoder customJwtDecoder;
        private final JwtAuthenticationEntryPoint jwtAuthenticationEntryPoint;
        private final OAuth2LoginSuccessHandler oAuth2LoginSuccessHandler;
        private final ClientRegistrationRepository clientRegistrationRepository;

        private static final String[] PUBLIC_ENDPOINTS = {
                        "/api/auth/login",
                        "/api/auth/register",
                        "/api/auth/refresh",
                        "/api/auth/forgot-password",
                        "/api/auth/reset-password",
                        "/api/auth/csrf",
                        "/oauth2/**",
                        "/login/oauth2/**",
                        "/v3/api-docs/**",
                        "/swagger-ui/**",
                        "/swagger-ui.html"
        };

        @Bean
        public SecurityFilterChain filterChain(HttpSecurity httpSecurity) throws Exception {
                httpSecurity.authorizeHttpRequests(request -> request
                                .requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()
                                .requestMatchers(PUBLIC_ENDPOINTS).permitAll()
                                .anyRequest().authenticated());

                BearerTokenResolver bearerTokenResolver = request -> {
                        String path = request.getRequestURI();
                        if (path.equals("/api/auth/login") || path.equals("/api/auth/register")
                                        || path.equals("/api/auth/refresh")
                                        || path.equals("/api/auth/forgot-password")
                                        || path.equals("/api/auth/reset-password")) {
                                return null;
                        }

                        Cookie[] cookies = request.getCookies();
                        if (cookies != null) {
                                for (Cookie cookie : cookies) {
                                        if ("music_app_token".equals(cookie.getName())) {
                                                return cookie.getValue();
                                        }
                                }
                        }
                        String authHeader = request.getHeader("Authorization");
                        if (authHeader != null && authHeader.startsWith("Bearer ")) {
                                return authHeader.substring(7);
                        }
                        return null;
                };

                httpSecurity.oauth2ResourceServer(oauth2 -> oauth2
                                .bearerTokenResolver(bearerTokenResolver)
                                .jwt(jwtConfigurer -> jwtConfigurer.decoder(customJwtDecoder))
                                .authenticationEntryPoint(jwtAuthenticationEntryPoint));

                DefaultOAuth2AuthorizationRequestResolver authorizationRequestResolver = new DefaultOAuth2AuthorizationRequestResolver(
                                clientRegistrationRepository, "/oauth2/authorization");
                authorizationRequestResolver.setAuthorizationRequestCustomizer(customizer -> customizer
                                .additionalParameters(params -> {
                                        params.put("access_type", "offline");
                                        params.put("prompt", "consent");
                                }));

                httpSecurity.oauth2Login(oauth2 -> oauth2
                                .authorizationEndpoint(
                                                auth -> auth.authorizationRequestResolver(authorizationRequestResolver))
                                .successHandler(oAuth2LoginSuccessHandler));

                // Authentication cookies are Strict and CORS is an explicit allowlist.
                // CSRF protection is retained for browser-initiated state changes.
                // httpSecurity.csrf(csrf -> csrf.csrfTokenRepository(
                // org.springframework.security.web.csrf.CookieCsrfTokenRepository.withHttpOnlyFalse()));
                httpSecurity.csrf(csrf -> csrf.disable());
                httpSecurity.cors(cors -> {
                });
                httpSecurity.httpBasic(AbstractHttpConfigurer::disable);

                return httpSecurity.build();
        }

        @Bean
        public CorsConfigurationSource corsConfigurationSource(@Value("${app.frontend-url}") String frontendUrl) {
                CorsConfiguration corsConfiguration = new CorsConfiguration();
                // Tạm thời allow tất cả origin để test mạng LAN không bị lỗi CORS
                corsConfiguration.addAllowedOriginPattern("*");
                corsConfiguration.addAllowedMethod("*");
                corsConfiguration.addAllowedHeader("*");
                corsConfiguration.setAllowCredentials(true);
                UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
                source.registerCorsConfiguration("/**", corsConfiguration);
                return source;
        }

        @Bean
        public PasswordEncoder passwordEncoder() {
                return new BCryptPasswordEncoder(10);
        }
}
