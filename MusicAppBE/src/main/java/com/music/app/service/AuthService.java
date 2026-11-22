package com.music.app.service;

import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.text.ParseException;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.Base64;
import java.util.Date;
import java.util.UUID;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.music.app.dto.AuthenticationResponse;
import com.music.app.dto.RefreshRequest;
import com.music.app.dto.UserDto;
import com.music.app.exception.AppException;
import com.music.app.exception.ErrorCode;
import com.music.app.mapper.UserMapper;
import com.music.app.model.InvalidatedToken;
import com.music.app.model.PasswordResetToken;
import com.music.app.model.User;
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

@Service
@RequiredArgsConstructor
@Slf4j
public class AuthService {

    private static final SecureRandom SECURE_RANDOM = new SecureRandom();

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

    private String generateSecureResetToken() {
        byte[] bytes = new byte[32];
        SECURE_RANDOM.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    private User resolveUser(String userIdOrSubject) {
        if (userIdOrSubject == null || userIdOrSubject.isBlank()) {
            throw new AppException(ErrorCode.USER_NOT_EXISTED);
        }
        return userRepository
                .findById(userIdOrSubject)
                .or(() -> userRepository.findByUsername(userIdOrSubject))
                .or(() -> userRepository.findByEmail(userIdOrSubject))
                .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_EXISTED));
    }

    public User getUserBySubject(String subject) {
        return resolveUser(subject);
    }

    public UserDto getUserDtoById(String userIdOrSubject) {
        return userMapper.toDto(resolveUser(userIdOrSubject));
    }

    public UserDto getUserDtoByLoginId(String loginId) {
        User user = resolveUser(loginId);
        return userMapper.toDto(user);
    }

    public AuthenticationResponse registerUser(String username, String password, String email) {
        if (userRepository.findByUsername(username).isPresent()
                || userRepository.findByEmail(email).isPresent()) {
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
        User user = userRepository.findByUsername(loginId).orElseGet(() -> userRepository
                .findByEmail(loginId)
                .orElseThrow(() -> new AppException(ErrorCode.INVALID_CREDENTIALS)));

        if (user.getPassword() == null || !passwordEncoder.matches(password, user.getPassword())) {
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

    @Transactional
    public AuthenticationResponse loginWithGoogleAndSaveRefresh(
            String googleId, String email, String name, String picture, String refreshToken) {
        User user = userRepository.findByGoogleId(googleId).orElseGet(() -> userRepository
                .findByEmail(email)
                .map(existing -> {
                    existing.setGoogleId(googleId);
                    return userRepository.save(existing);
                })
                .orElseGet(() -> {
                    User newUser = User.builder()
                            .googleId(googleId)
                            .email(email)
                            .username(email)
                            .fullName(name)
                            .avatarUrl(picture)
                            .build();
                    return userRepository.save(newUser);
                }));

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

    @Transactional
    public AuthenticationResponse changePassword(
            String currentUserIdOrSubject, String oldPassword, String newPassword) {
        User user = resolveUser(currentUserIdOrSubject);

        if (user.getPassword() == null || !passwordEncoder.matches(oldPassword, user.getPassword())) {
            throw new AppException(ErrorCode.INVALID_CREDENTIALS, "Incorrect old password");
        }

        user.setPassword(passwordEncoder.encode(newPassword));
        incrementTokenVersion(user);
        user = userRepository.save(user);

        String accessToken = generateAccessToken(user);
        String backendRefreshToken = generateRefreshToken(user);
        return AuthenticationResponse.builder()
                .accessToken(accessToken)
                .refreshToken(backendRefreshToken)
                .user(userMapper.toDto(user))
                .build();
    }

    @Transactional
    public AuthenticationResponse setLocalCredentials(
            String currentUserIdOrSubject, String newLoginId, String newPassword) {
        User user = resolveUser(currentUserIdOrSubject);
        String currentUserId = user.getId();

        // If they want to set a custom username or update their email
        if (newLoginId != null && !newLoginId.trim().isEmpty()) {
            String trimmedLoginId = newLoginId.trim();
            if (trimmedLoginId.contains("@")) {
                if (userRepository
                        .findByEmail(trimmedLoginId)
                        .filter(existing -> !existing.getId().equals(currentUserId))
                        .isPresent()) {
                    throw new AppException(ErrorCode.USER_EXISTED);
                }
                user.setEmail(trimmedLoginId);
            } else {
                if (userRepository
                        .findByUsername(trimmedLoginId)
                        .filter(existing -> !existing.getId().equals(currentUserId))
                        .isPresent()) {
                    throw new AppException(ErrorCode.USER_EXISTED);
                }
                user.setUsername(trimmedLoginId);
            }
        }

        user.setPassword(passwordEncoder.encode(newPassword));
        incrementTokenVersion(user);
        user = userRepository.save(user);

        String accessToken = generateAccessToken(user);
        String backendRefreshToken = generateRefreshToken(user);
        return AuthenticationResponse.builder()
                .accessToken(accessToken)
                .refreshToken(backendRefreshToken)
                .user(userMapper.toDto(user))
                .build();
    }

    @Transactional
    public void generatePasswordResetToken(String email) {
        if (email == null || email.isBlank()) {
            throw new AppException(ErrorCode.INVALID_REQUEST, "Email is required");
        }
        User user = userRepository
                .findByEmail(email.trim())
                .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_EXISTED));
        // Delete old tokens for this user
        passwordResetTokenRepository.deleteByUser(user);
        passwordResetTokenRepository.flush();

        // Create new token
        String tokenStr = generateSecureResetToken();
        PasswordResetToken token = PasswordResetToken.builder()
                .token(tokenStr)
                .user(user)
                .expiryDate(LocalDateTime.now().plusMinutes(15))
                .build();

        passwordResetTokenRepository.save(token);

        // Send email (fallback to console if SMTP not configured)
        String resetLink = frontendUrl.replaceAll("/+$", "") + "/reset-password?token=" + tokenStr;
        emailService.sendPasswordResetEmail(user.getEmail(), resetLink);
    }

    @Transactional
    public void resetPassword(String token, String newPassword) {
        if (token == null || token.isBlank()) {
            throw new AppException(ErrorCode.INVALID_REQUEST, "Reset token is required");
        }
        if (newPassword == null || newPassword.length() < 12 || newPassword.length() > 128) {
            throw new AppException(ErrorCode.INVALID_REQUEST, "Password must be between 12 and 128 characters");
        }

        PasswordResetToken resetToken = passwordResetTokenRepository
                .findByToken(token)
                .orElseThrow(() -> new AppException(ErrorCode.INVALID_REQUEST, "Invalid reset token"));

        if (resetToken.isExpired()) {
            throw new AppException(ErrorCode.INVALID_REQUEST, "Token has expired");
        }

        User user = resetToken.getUser();
        user.setPassword(passwordEncoder.encode(newPassword));
        incrementTokenVersion(user);
        userRepository.save(user);

        passwordResetTokenRepository.delete(resetToken);
    }

    public void logout(String token) {
        try {
            if (token == null || token.isBlank()) {
                return;
            }
            if (token.startsWith("Bearer ")) {
                token = token.substring(7);
            }

            SignedJWT signedJWT = SignedJWT.parse(token);
            JWSVerifier verifier = new MACVerifier(signerKey.getBytes(StandardCharsets.UTF_8));
            if (!signedJWT.verify(verifier)) {
                log.warn("Rejected logout for token with invalid signature");
                return;
            }

            String jit = signedJWT.getJWTClaimsSet().getJWTID();
            Date expiryTime = signedJWT.getJWTClaimsSet().getExpirationTime();
            if (jit == null || expiryTime == null || !expiryTime.after(new Date())) {
                return;
            }

            InvalidatedToken invalidatedToken = InvalidatedToken.builder()
                    .id(jit)
                    .expiryTime(expiryTime
                            .toInstant()
                            .atZone(ZoneId.systemDefault())
                            .toLocalDateTime())
                    .build();

            invalidatedTokenRepository.save(invalidatedToken);
        } catch (ParseException | JOSEException e) {
            log.warn("Failed to parse or verify token during logout", e);
        }
    }

    @Transactional
    public AuthenticationResponse refreshToken(RefreshRequest request) {
        try {
            String token = request != null ? request.getRefreshToken() : null;
            if (token == null || token.isBlank()) {
                throw new AppException(ErrorCode.UNAUTHENTICATED, "Refresh token is missing");
            }

            JWSVerifier verifier = new MACVerifier(signerKey.getBytes(StandardCharsets.UTF_8));
            SignedJWT signedJWT = SignedJWT.parse(token);
            Date expiryTime = signedJWT.getJWTClaimsSet().getExpirationTime();

            boolean verified = signedJWT.verify(verifier);

            if (!(verified && expiryTime != null && expiryTime.after(new Date()))) {
                throw new AppException(ErrorCode.UNAUTHENTICATED, "Invalid or expired token");
            }

            String jit = signedJWT.getJWTClaimsSet().getJWTID();
            if (jit == null || invalidatedTokenRepository.existsById(jit)) {
                throw new AppException(ErrorCode.UNAUTHENTICATED, "Token has been invalidated");
            }

            String tokenType = signedJWT.getJWTClaimsSet().getStringClaim("token_type");
            if (!"REFRESH".equals(tokenType)) {
                throw new AppException(ErrorCode.UNAUTHENTICATED, "Invalid token type");
            }

            String userIdClaim = signedJWT.getJWTClaimsSet().getStringClaim("userId");
            String usernameOrEmail = signedJWT.getJWTClaimsSet().getSubject();
            User user;
            if (userIdClaim != null && !userIdClaim.isBlank()) {
                user = userRepository
                        .findById(userIdClaim)
                        .orElseThrow(() -> new AppException(ErrorCode.UNAUTHENTICATED, "User not found"));
            } else {
                user = resolveUser(usernameOrEmail);
            }

            Number tokenVersion = (Number) signedJWT.getJWTClaimsSet().getClaim("token_version");
            if (tokenVersion == null
                    || user.getAuthTokenVersion() == null
                    || user.getAuthTokenVersion().longValue() != tokenVersion.longValue()) {
                throw new AppException(ErrorCode.UNAUTHENTICATED, "Token has been superseded");
            }

            invalidatedTokenRepository.save(InvalidatedToken.builder()
                    .id(jit)
                    .expiryTime(expiryTime
                            .toInstant()
                            .atZone(ZoneId.systemDefault())
                            .toLocalDateTime())
                    .build());

            String accessToken = generateAccessToken(user);
            String refreshToken = generateRefreshToken(user);

            return AuthenticationResponse.builder()
                    .accessToken(accessToken)
                    .refreshToken(refreshToken)
                    .user(userMapper.toDto(user))
                    .build();

        } catch (ParseException | JOSEException e) {
            throw new AppException(ErrorCode.UNAUTHENTICATED, "Unauthenticated");
        }
    }

    private String generateAccessToken(User user) {
        JWSHeader header = new JWSHeader(JWSAlgorithm.HS512);

        JWTClaimsSet.Builder claimsBuilder = new JWTClaimsSet.Builder()
                .claim("userId", user.getId().toString())
                .subject(user.getUsername() != null ? user.getUsername() : user.getEmail())
                .issuer("musicapp.com")
                .claim("token_type", "ACCESS")
                .claim("token_version", user.getAuthTokenVersion())
                .issueTime(new Date())
                .expirationTime(new Date(
                        Instant.now().plus(validDuration, ChronoUnit.SECONDS).toEpochMilli()))
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
        claimsBuilder.claim(
                "hasPassword", user.getPassword() != null && !user.getPassword().isEmpty());
        claimsBuilder.claim(
                "isGoogleLinked",
                user.getGoogleId() != null && !user.getGoogleId().isEmpty());

        JWTClaimsSet jwtClaimsSet = claimsBuilder.build();

        Payload payload = new Payload(jwtClaimsSet.toJSONObject());
        JWSObject jwsObject = new JWSObject(header, payload);

        try {
            jwsObject.sign(new MACSigner(signerKey.getBytes(StandardCharsets.UTF_8)));
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
                .claim("token_version", user.getAuthTokenVersion())
                .issueTime(new Date())
                .expirationTime(new Date(Instant.now()
                        .plus(refreshableDuration, ChronoUnit.SECONDS)
                        .toEpochMilli()))
                .jwtID(UUID.randomUUID().toString())
                .build();

        Payload payload = new Payload(jwtClaimsSet.toJSONObject());
        JWSObject jwsObject = new JWSObject(header, payload);

        try {
            jwsObject.sign(new MACSigner(signerKey.getBytes(StandardCharsets.UTF_8)));
            return jwsObject.serialize();
        } catch (JOSEException e) {
            log.error("Cannot create token", e);
            throw new RuntimeException("Error generating token");
        }
    }

    private void incrementTokenVersion(User user) {
        user.setAuthTokenVersion((user.getAuthTokenVersion() == null ? 0 : user.getAuthTokenVersion()) + 1);
    }
}
