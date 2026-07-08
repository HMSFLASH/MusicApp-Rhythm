package com.music.app.config.security;

import lombok.RequiredArgsConstructor;
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
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;
import org.springframework.web.filter.CorsFilter;

import org.springframework.security.oauth2.server.resource.web.DefaultBearerTokenResolver;

@Configuration
@EnableWebSecurity
@EnableMethodSecurity
@RequiredArgsConstructor
public class SecurityConfig {

        private final CustomJwtDecoder customJwtDecoder;
        private final JwtAuthenticationEntryPoint jwtAuthenticationEntryPoint;
        private final OAuth2LoginSuccessHandler oAuth2LoginSuccessHandler;
        private final org.springframework.security.oauth2.client.registration.ClientRegistrationRepository clientRegistrationRepository;

        private static final String[] PUBLIC_ENDPOINTS = {
                        "/api/auth/**",
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

                DefaultBearerTokenResolver bearerTokenResolver = new DefaultBearerTokenResolver();
                bearerTokenResolver.setAllowUriQueryParameter(true);

                httpSecurity.oauth2ResourceServer(oauth2 -> oauth2
                                .bearerTokenResolver(bearerTokenResolver)
                                .jwt(jwtConfigurer -> jwtConfigurer.decoder(customJwtDecoder))
                                .authenticationEntryPoint(jwtAuthenticationEntryPoint));

                org.springframework.security.oauth2.client.web.DefaultOAuth2AuthorizationRequestResolver authorizationRequestResolver = new org.springframework.security.oauth2.client.web.DefaultOAuth2AuthorizationRequestResolver(
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

                httpSecurity.csrf(AbstractHttpConfigurer::disable);
                httpSecurity.cors(cors -> {
                });
                httpSecurity.httpBasic(AbstractHttpConfigurer::disable);

                return httpSecurity.build();
        }

        @Bean
        public CorsFilter corsFilter(@org.springframework.beans.factory.annotation.Value("${app.frontend-url}") String frontendUrl) {
                CorsConfiguration corsConfiguration = new CorsConfiguration();
                if ("*".equals(frontendUrl)) {
                        corsConfiguration.addAllowedOriginPattern("*");
                } else {
                        corsConfiguration.addAllowedOrigin(frontendUrl);
                }
                corsConfiguration.addAllowedMethod("*");
                corsConfiguration.addAllowedHeader("*");
                corsConfiguration.setAllowCredentials(true);

                UrlBasedCorsConfigurationSource urlBasedCorsConfigurationSource = new UrlBasedCorsConfigurationSource();
                urlBasedCorsConfigurationSource.registerCorsConfiguration("/**", corsConfiguration);

                return new CorsFilter(urlBasedCorsConfigurationSource);
        }

        @Bean
        public PasswordEncoder passwordEncoder() {
                return new BCryptPasswordEncoder(10);
        }
}
