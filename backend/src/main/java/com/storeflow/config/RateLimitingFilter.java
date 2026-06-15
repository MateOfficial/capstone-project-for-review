package com.storeflow.config;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.http.HttpStatus;
import org.springframework.lang.NonNull;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.time.Duration;
import java.util.Set;

/**
 * Redis-backed rate limiting filter for sensitive endpoints.
 * Uses sliding window counter: max 10 requests per 15 minutes per IP.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class RateLimitingFilter extends OncePerRequestFilter {

    private static final int MAX_REQUESTS = 10;
    private static final Duration WINDOW = Duration.ofMinutes(15);

    private static final Set<String> RATE_LIMITED_PATHS = Set.of(
            "/api/auth/login",
            "/api/auth/refresh"
    );

    private final StringRedisTemplate redis;

    @Override
    protected void doFilterInternal(@NonNull HttpServletRequest request,
                                    @NonNull HttpServletResponse response,
                                    @NonNull FilterChain chain)
            throws ServletException, IOException {

        String path = request.getRequestURI();
        if (!RATE_LIMITED_PATHS.contains(path)) {
            chain.doFilter(request, response);
            return;
        }

        String ip = getClientIp(request);
        String key = "rate_limit:" + path.replace('/', ':') + ":" + ip;

        try {
            Long count = redis.opsForValue().increment(key);
            if (count != null && count == 1) {
                redis.expire(key, WINDOW);
            }
            if (count != null && count > MAX_REQUESTS) {
                log.warn("Rate limit exceeded for IP {} on {}", ip, path);
                response.setStatus(HttpStatus.TOO_MANY_REQUESTS.value());
                response.setContentType("application/json");
                response.getWriter().write("{\"status\":\"error\",\"message\":\"Too many requests. Please try again later.\"}");
                return;
            }
        } catch (Exception e) {
            // If Redis is unavailable, fail open (don't block requests)
            log.warn("Rate limiting unavailable (Redis error): {}", e.getMessage());
        }

        chain.doFilter(request, response);
    }

    private String getClientIp(HttpServletRequest request) {
        String forwarded = request.getHeader("X-Forwarded-For");
        if (forwarded != null && !forwarded.isBlank()) {
            return forwarded.split(",")[0].trim();
        }
        return request.getRemoteAddr();
    }
}
