package com.music.app.config.security;

import java.text.ParseException;
import java.util.Objects;
import javax.crypto.spec.SecretKeySpec;

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

    private NimbusJwtDecoder nimbusJwtDecoder = null;

    @Override
    public Jwt decode(String token) throws JwtException {
        try {
            com.nimbusds.jwt.SignedJWT signedJWT = com.nimbusds.jwt.SignedJWT.parse(token);

            String jit = signedJWT.getJWTClaimsSet().getJWTID();
            if (jit != null && invalidatedTokenRepository.existsById(jit)) {
                throw new BadJwtException("Token has been invalidated");
            }
            if (!"ACCESS".equals(signedJWT.getJWTClaimsSet().getStringClaim("token_type"))) {
                throw new BadJwtException("Refresh tokens cannot access protected resources");
            }
            String userId = signedJWT.getJWTClaimsSet().getStringClaim("userId");
            Number tokenVersion = (Number) signedJWT.getJWTClaimsSet().getClaim("token_version");
            if (userId == null
                    || tokenVersion == null
                    || userRepository
                            .findById(userId)
                            .map(user -> user.getAuthTokenVersion() == null
                                    || user.getAuthTokenVersion().longValue() != tokenVersion.longValue())
                            .orElse(true)) {
                throw new BadJwtException("Token has been superseded");
            }
        } catch (ParseException e) {
            throw new BadJwtException("Invalid token format", e);
        }

        if (Objects.isNull(nimbusJwtDecoder)) {
            SecretKeySpec secretKeySpec = new SecretKeySpec(signerKey.getBytes(), "HS512");
            nimbusJwtDecoder = NimbusJwtDecoder.withSecretKey(secretKeySpec)
                    .macAlgorithm(MacAlgorithm.HS512)
                    .build();
        }

        return nimbusJwtDecoder.decode(token);
    }
}
