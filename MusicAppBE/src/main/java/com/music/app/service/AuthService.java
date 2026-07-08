package com.music.app.service;

import com.music.app.exception.AppException;
import com.music.app.exception.ErrorCode;
import com.music.app.dto.AuthenticationResponse;
import com.music.app.dto.RefreshRequest;
import com.music.app.dto.UserDto;
import com.music.app.mapper.UserMapper;
import com.music.app.model.InvalidatedToken;
import com.music.app.model.User;
import com.music.app.model.PasswordResetToken;
import com.music.app.repository.InvalidatedTokenRepository;
import com.music.app.repository.PasswordResetTokenRepository;
import com.music.app.repository.UserRepository;
import com.nimbusds.jose.*;
import com.nimbusds.jose.crypto.MACSigner;
import com.nimbusds.jose.crypto.MACVerifier;
import com.nimbusds.jwt.JWTClaimsSet;
import com.nimbusds.jwt.SignedJWT;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.text.ParseException;
import java.time.Instant;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.Date;
import java.util.UUID;
import java.time.LocalDateTime;

@Service
@RequiredArgsConstructor
@Slf4j
public class AuthService {

    private final UserRepository userRepository;
    private final InvalidatedTokenRepository invalidatedTokenRepository;
    private final PasswordResetTokenRepository passwordResetTokenRepository;
    private final EmailService emailService;
    private final UserMapper userMapper;
    private final PasswordEncoder passwordEncoder;

    @Value("${jwt.signerKey}")
    private String signerKey;

    @Value("${jwt.valid-duration}")
    private long validDuration;

    @Value("${jwt.refreshable-duration}")
    private long refreshableDuration;

    @Value("${app.frontend-url}")
    private String frontendUrl;

    public User getUserBySubject(String subject) {
        return userRepository.findByUsername(subject)
                .orElseGet(() -> userRepository.findByEmail(subject)
                        .orElseThrow(() -> new RuntimeException("User not found: " + subject)));
    }

    public UserDto getUserDtoByLoginId(String loginId) {
        User user = getUserBySubject(loginId);
        return userMapper.toDto(user);
    }

    public AuthenticationResponse registerUser(String username, String password, String email) {
        if (userRepository.findByUsername(username).isPresent() || userRepository.findByEmail(email).isPresent()) {
            throw new AppException(ErrorCode.USER_EXISTED);
        }
        User user = User.builder()
                .username(username)
                .password(passwordEncoder.encode(password))
                .email(email)
                .build();
        User savedUser = userRepository.save(user);
        String accessToken = generateAccessToken(savedUser);
        String refreshToken = generateRefreshToken(savedUser);
        return AuthenticationResponse.builder()
                .accessToken(accessToken)
                .refreshToken(refreshToken)
                .user(userMapper.toDto(savedUser))
                .build();
    }

    public AuthenticationResponse login(String loginId, String password) {
        User user = userRepository.findByUsername(loginId).orElseGet(() -> userRepository.findByEmail(loginId)
                .orElseThrow(() -> new AppException(ErrorCode.INVALID_CREDENTIALS)));

        if (!passwordEncoder.matches(password, user.getPassword())) {
            throw new AppException(ErrorCode.INVALID_CREDENTIALS);
        }

        String accessToken = generateAccessToken(user);
        String refreshToken = generateRefreshToken(user);

        return AuthenticationResponse.builder()
                .accessToken(accessToken)
                .refreshToken(refreshToken)
                .user(userMapper.toDto(user))
                .build();
    }

    public AuthenticationResponse loginWithGoogle(String googleId, String email, String name, String picture) {
        return loginWithGoogleAndSaveRefresh(googleId, email, name, picture, null);
    }

    public AuthenticationResponse loginWithGoogleAndSaveRefresh(String googleId, String email, String name,
            String picture, String refreshToken) {
        User user = userRepository.findByGoogleId(googleId).orElseGet(() -> {
            User newUser = User.builder()
                    .googleId(googleId)
                    .email(email)
                    .username(email)
                    .fullName(name)
                    .avatarUrl(picture)
                    .build();
            return userRepository.save(newUser);
        });

        boolean needSave = false;
        if (refreshToken != null && !refreshToken.equals(user.getRefreshToken())) {
            user.setRefreshToken(refreshToken);
            needSave = true;
        }
        if (name != null && !name.equals(user.getFullName())) {
            user.setFullName(name);
            needSave = true;
        }
        if (picture != null && !picture.equals(user.getAvatarUrl())) {
            user.setAvatarUrl(picture);
            needSave = true;
        }
        if (needSave) {
            user = userRepository.save(user);
        }

        String accessToken = generateAccessToken(user);
        String backendRefreshToken = generateRefreshToken(user);
        return AuthenticationResponse.builder()
                .accessToken(accessToken)
                .refreshToken(backendRefreshToken)
                .user(userMapper.toDto(user))
                .build();
    }

    public AuthenticationResponse setLocalCredentials(String currentSubject, String newLoginId, String newPassword) {
        User user = userRepository.findByUsername(currentSubject).orElseGet(() -> userRepository
                .findByEmail(currentSubject).orElseThrow(() -> new RuntimeException("User not found")));

        // If they want to set a custom username or update their email
        if (newLoginId != null && !newLoginId.trim().isEmpty()) {
            if (newLoginId.contains("@")) {
                user.setEmail(newLoginId);
            } else {
                user.setUsername(newLoginId);
            }
        }

        user.setPassword(passwordEncoder.encode(newPassword));
        user = userRepository.save(user);

        String accessToken = generateAccessToken(user);
        String backendRefreshToken = generateRefreshToken(user);
        return AuthenticationResponse.builder()
                .accessToken(accessToken)
                .refreshToken(backendRefreshToken)
                .user(userMapper.toDto(user))
                .build();
    }

    public void generatePasswordResetToken(String email) {
        User user = userRepository.findByEmail(email).orElseThrow(() -> new AppException(ErrorCode.USER_NOT_EXISTED));
        // Delete old tokens for this user
        passwordResetTokenRepository.deleteByUser(user);

        // Create new token
        String tokenStr = UUID.randomUUID().toString();
        PasswordResetToken token = PasswordResetToken.builder()
                .token(tokenStr)
                .user(user)
                .expiryDate(LocalDateTime.now().plusMinutes(15))
                .build();

        passwordResetTokenRepository.save(token);

        // Send email (fallback to console if SMTP not configured)
        String resetLink = frontendUrl + "/reset-password?token=" + tokenStr;
        emailService.sendPasswordResetEmail(user.getEmail(), resetLink);
    }

    public void resetPassword(String token, String newPassword) {
        PasswordResetToken resetToken = passwordResetTokenRepository.findByToken(token)
                .orElseThrow(() -> new RuntimeException("Invalid token"));

        if (resetToken.isExpired()) {
            passwordResetTokenRepository.delete(resetToken);
            throw new RuntimeException("Token has expired");
        }

        User user = resetToken.getUser();
        user.setPassword(passwordEncoder.encode(newPassword));
        userRepository.save(user);

        passwordResetTokenRepository.delete(resetToken);
    }

    public void logout(String token) {
        try {
            // Remove "Bearer " prefix if present
            if (token != null && token.startsWith("Bearer ")) {
                token = token.substring(7);
            }

            SignedJWT signedJWT = SignedJWT.parse(token);
            String jit = signedJWT.getJWTClaimsSet().getJWTID();
            Date expiryTime = signedJWT.getJWTClaimsSet().getExpirationTime();

            InvalidatedToken invalidatedToken = InvalidatedToken.builder()
                    .id(jit)
                    .expiryTime(expiryTime.toInstant().atZone(ZoneId.systemDefault()).toLocalDateTime())
                    .build();

            invalidatedTokenRepository.save(invalidatedToken);
        } catch (ParseException e) {
            log.error("Failed to parse token during logout", e);
        }
    }

    public AuthenticationResponse refreshToken(RefreshRequest request) {
        try {
            String token = request.getRefreshToken();

            JWSVerifier verifier = new MACVerifier(signerKey.getBytes());
            SignedJWT signedJWT = SignedJWT.parse(token);
            Date expiryTime = signedJWT.getJWTClaimsSet().getExpirationTime();

            boolean verified = signedJWT.verify(verifier);

            if (!(verified && expiryTime.after(new Date()))) {
                throw new RuntimeException("Unauthenticated: Invalid or expired token");
            }

            if (invalidatedTokenRepository.existsById(signedJWT.getJWTClaimsSet().getJWTID())) {
                throw new RuntimeException("Unauthenticated: Token has been invalidated");
            }

            String tokenType = signedJWT.getJWTClaimsSet().getStringClaim("token_type");
            if (!"REFRESH".equals(tokenType)) {
                throw new RuntimeException("Unauthenticated: Invalid token type");
            }

            String usernameOrEmail = signedJWT.getJWTClaimsSet().getSubject();
            User user = userRepository.findByUsername(usernameOrEmail).orElseGet(() -> userRepository
                    .findByEmail(usernameOrEmail).orElseThrow(() -> new RuntimeException("User not found")));

            String accessToken = generateAccessToken(user);

            return AuthenticationResponse.builder()
                    .accessToken(accessToken)
                    .refreshToken(token)
                    .user(userMapper.toDto(user))
                    .build();

        } catch (ParseException | JOSEException e) {
            throw new RuntimeException("Unauthenticated", e);
        }
    }

    private String generateAccessToken(User user) {
        JWSHeader header = new JWSHeader(JWSAlgorithm.HS512);

        JWTClaimsSet.Builder claimsBuilder = new JWTClaimsSet.Builder()
                .claim("userId", user.getId().toString())
                .subject(user.getUsername() != null ? user.getUsername() : user.getEmail())
                .issuer("musicapp.com")
                .claim("token_type", "ACCESS")
                .issueTime(new Date())
                .expirationTime(new Date(Instant.now().plus(validDuration, ChronoUnit.SECONDS).toEpochMilli()))
                .jwtID(UUID.randomUUID().toString());

        if (user.getFullName() != null) {
            claimsBuilder.claim("name", user.getFullName());
        }
        if (user.getAvatarUrl() != null) {
            claimsBuilder.claim("picture", user.getAvatarUrl());
        }
        if (user.getEmail() != null) {
            claimsBuilder.claim("email", user.getEmail());
        }
        if (user.getUsername() != null) {
            claimsBuilder.claim("username", user.getUsername());
        }
        if (user.getRole() != null) {
            claimsBuilder.claim("role", user.getRole().getName());
        }
        claimsBuilder.claim("hasPassword", user.getPassword() != null && !user.getPassword().isEmpty());
        claimsBuilder.claim("isGoogleLinked", user.getGoogleId() != null && !user.getGoogleId().isEmpty());

        JWTClaimsSet jwtClaimsSet = claimsBuilder.build();

        Payload payload = new Payload(jwtClaimsSet.toJSONObject());
        JWSObject jwsObject = new JWSObject(header, payload);

        try {
            jwsObject.sign(new MACSigner(signerKey.getBytes()));
            return jwsObject.serialize();
        } catch (JOSEException e) {
            log.error("Cannot create token", e);
            throw new RuntimeException("Error generating token");
        }
    }

    private String generateRefreshToken(User user) {
        JWSHeader header = new JWSHeader(JWSAlgorithm.HS512);

        JWTClaimsSet jwtClaimsSet = new JWTClaimsSet.Builder()
                .claim("userId", user.getId().toString())
                .subject(user.getUsername() != null ? user.getUsername() : user.getEmail())
                .issuer("musicapp.com")
                .claim("token_type", "REFRESH")
                .issueTime(new Date())
                .expirationTime(new Date(Instant.now().plus(refreshableDuration, ChronoUnit.SECONDS).toEpochMilli()))
                .jwtID(UUID.randomUUID().toString())
                .build();

        Payload payload = new Payload(jwtClaimsSet.toJSONObject());
        JWSObject jwsObject = new JWSObject(header, payload);

        try {
            jwsObject.sign(new MACSigner(signerKey.getBytes()));
            return jwsObject.serialize();
        } catch (JOSEException e) {
            log.error("Cannot create token", e);
            throw new RuntimeException("Error generating token");
        }
    }
}
