package com.storeflow.auth.security;

import io.jsonwebtoken.*;
import io.jsonwebtoken.security.Keys;
import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.Date;

@Slf4j
@Component
public class JwtTokenProvider {

    @Value("${app.jwt.secret:}")
    private String jwtSecret;

    @Value("${app.jwt.access-token-expiration:86400000}")
    private long accessTokenExpiration;

    @Value("${app.jwt.refresh-token-expiration:604800000}")
    private long refreshTokenExpiration;

    private SecretKey key;

    @PostConstruct
    public void init() {
        if (jwtSecret == null || jwtSecret.isBlank()) {
            byte[] randomBytes = new byte[64];
            new SecureRandom().nextBytes(randomBytes);
            jwtSecret = Base64.getEncoder().encodeToString(randomBytes);
            log.warn("No JWT secret configured. Generated a random secret. Set JWT_SECRET env variable for production.");
        }
        byte[] secretBytes = jwtSecret.getBytes(StandardCharsets.UTF_8);
        if (secretBytes.length >= 64) {
            this.key = Keys.hmacShaKeyFor(secretBytes);
        } else {
            this.key = Jwts.SIG.HS512.key().build();
        }
    }

    public String generateAccessToken(Long userId, String username, Long storeId) {
        Date now = new Date();
        return Jwts.builder()
                .subject(userId.toString())
                .claim("username", username)
                .claim("storeId", storeId)
                .issuedAt(now)
                .expiration(new Date(now.getTime() + accessTokenExpiration))
                .signWith(key)
                .compact();
    }

    public String generateRefreshToken() {
        byte[] randomBytes = new byte[64];
        new SecureRandom().nextBytes(randomBytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(randomBytes);
    }

    public Long getUserIdFromToken(String token) {
        Claims claims = Jwts.parser()
                .verifyWith(key)
                .build()
                .parseSignedClaims(token)
                .getPayload();
        return Long.parseLong(claims.getSubject());
    }

    public Long getStoreIdFromToken(String token) {
        Claims claims = Jwts.parser()
                .verifyWith(key)
                .build()
                .parseSignedClaims(token)
                .getPayload();
        return claims.get("storeId", Long.class);
    }

    public boolean validateToken(String token) {
        try {
            Jwts.parser().verifyWith(key).build().parseSignedClaims(token);
            return true;
        } catch (JwtException | IllegalArgumentException e) {
            log.debug("Invalid JWT token: {}", e.getMessage());
            return false;
        }
    }

    public long getRefreshTokenExpiration() {
        return refreshTokenExpiration;
    }
}
