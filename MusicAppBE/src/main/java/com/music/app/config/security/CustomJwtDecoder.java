package com.music.app.config.security;

import java.text.ParseException;
import java.util.Objects;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.oauth2.jwt.BadJwtException;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtException;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.stereotype.Component;

import com.music.app.model.Role;
import com.music.app.model.User;
import com.music.app.repository.RoleRepository;
import com.music.app.repository.UserRepository;

import lombok.RequiredArgsConstructor;

@Component
@RequiredArgsConstructor
public class CustomJwtDecoder implements JwtDecoder {

    @Value("${jwt.signerKey}")
    private String signerKey;

    private final UserRepository userRepository;
    private final RoleRepository roleRepository;

    private NimbusJwtDecoder nimbusJwtDecoder = null;

    @Override
    public Jwt decode(String token) throws JwtException {
        try {
            com.nimbusds.jwt.SignedJWT signedJWT = com.nimbusds.jwt.SignedJWT.parse(token);

            // Supabase puts user UUID in 'sub' claim
            String userId = signedJWT.getJWTClaimsSet().getSubject();
            if (userId == null) {
                throw new BadJwtException("Token does not contain a subject (sub) claim");
            }

            // Sync user if doesn't exist
            if (!userRepository.existsById(userId)) {
                String email = signedJWT.getJWTClaimsSet().getStringClaim("email");

                Role userRole = roleRepository
                        .findByName("USER")
                        .orElseGet(() ->
                                roleRepository.save(Role.builder().name("USER").build()));

                User newUser = User.builder()
                        .id(userId)
                        .email(email)
                        .username(email != null ? email.split("@")[0] : userId)
                        .role(userRole)
                        .build();
                userRepository.save(newUser);
            }

        } catch (ParseException e) {
            throw new BadJwtException("Invalid token format", e);
        }

        if (Objects.isNull(nimbusJwtDecoder)) {
            // Supabase uses ECC (P-256) now, so we must fetch the Public Key via JWKS endpoint
            String jwkSetUri =
                    System.getenv("SUPABASE_URL") + "/auth/v1/jwks?apikey=" + System.getenv("SUPABASE_ANON_KEY");
            nimbusJwtDecoder = NimbusJwtDecoder.withJwkSetUri(jwkSetUri).build();
        }

        return nimbusJwtDecoder.decode(token);
    }
}
