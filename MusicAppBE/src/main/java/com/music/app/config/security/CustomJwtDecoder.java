package com.music.app.config.security;

import java.nio.charset.StandardCharsets;
import javax.crypto.spec.SecretKeySpec;

import jakarta.annotation.PostConstruct;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.BadJwtException;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtException;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.stereotype.Component;

import com.music.app.repository.InvalidatedTokenRepository;
import com.music.app.repository.UserRepository;

import lombok.RequiredArgsConstructor;

@Component
@RequiredArgsConstructor
public class CustomJwtDecoder implements JwtDecoder {

    @Value("${jwt.signerKey}")
    private String signerKey;

    private final InvalidatedTokenRepository invalidatedTokenRepository;
    private final UserRepository userRepository;

    private volatile NimbusJwtDecoder nimbusJwtDecoder;

    @PostConstruct
    public void init() {
        SecretKeySpec secretKeySpec = new SecretKeySpec(signerKey.getBytes(StandardCharsets.UTF_8), "HS512");
        this.nimbusJwtDecoder = NimbusJwtDecoder.withSecretKey(secretKeySpec)
                .macAlgorithm(MacAlgorithm.HS512)
                .build();
    }

    private NimbusJwtDecoder getNimbusJwtDecoder() {
        NimbusJwtDecoder decoder = this.nimbusJwtDecoder;
        if (decoder == null) {
            synchronized (this) {
                decoder = this.nimbusJwtDecoder;
                if (decoder == null) {
                    SecretKeySpec secretKeySpec =
                            new SecretKeySpec(signerKey.getBytes(StandardCharsets.UTF_8), "HS512");
                    decoder = NimbusJwtDecoder.withSecretKey(secretKeySpec)
                            .macAlgorithm(MacAlgorithm.HS512)
                            .build();
                    this.nimbusJwtDecoder = decoder;
                }
            }
        }
        return decoder;
    }

    @Override
    public Jwt decode(String token) throws JwtException {
        Jwt jwt = getNimbusJwtDecoder().decode(token);

        String jit = jwt.getId();
        if (jit != null && invalidatedTokenRepository.existsById(jit)) {
            throw new BadJwtException("Token has been invalidated");
        }
        if (!"ACCESS".equals(jwt.getClaimAsString("token_type"))) {
            throw new BadJwtException("Refresh tokens cannot access protected resources");
        }
        String userId = jwt.getClaimAsString("userId");
        Object rawTokenVersion = jwt.getClaim("token_version");
        if (userId == null
                || !(rawTokenVersion instanceof Number tokenVersion)
                || userRepository
                        .findById(userId)
                        .map(user -> user.getAuthTokenVersion() == null
                                || user.getAuthTokenVersion().longValue() != tokenVersion.longValue())
                        .orElse(true)) {
            throw new BadJwtException("Token has been superseded");
        }

        return jwt;
    }
}
