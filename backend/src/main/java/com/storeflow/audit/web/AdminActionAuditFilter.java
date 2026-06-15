package com.storeflow.audit.web;

import com.storeflow.audit.service.AuditService;
import com.storeflow.auth.security.PlatformUserDetails;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;

@Component
@RequiredArgsConstructor
public class AdminActionAuditFilter extends OncePerRequestFilter {

    private static final Set<String> MUTATING_METHODS = Set.of("POST", "PUT", "PATCH", "DELETE");

    private final AuditService auditService;

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        String method = request.getMethod();
        String uri = request.getRequestURI();

        if (!MUTATING_METHODS.contains(method)) {
            return true;
        }

        if (uri == null || !uri.startsWith("/api/admin/")) {
            return true;
        }

        // These two endpoints already log richer import metadata manually.
        return "/api/admin/integrations/1c/import".equals(uri)
                || "/api/admin/integrations/1c/import/preflight".equals(uri);
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {
        filterChain.doFilter(request, response);

        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !(authentication.getPrincipal() instanceof PlatformUserDetails user)) {
            return;
        }

        Map<String, Object> details = new LinkedHashMap<>();
        details.put("method", request.getMethod());
        details.put("path", request.getRequestURI());
        details.put("status", response.getStatus());
        if (request.getQueryString() != null && !request.getQueryString().isBlank()) {
            details.put("query", request.getQueryString());
        }

        String entityType = resolveEntityType(request.getRequestURI());
        String entityId = resolveEntityId(request.getRequestURI());
        String action = "ADMIN_" + request.getMethod() + "_" + entityType.toUpperCase();

        auditService.log(
                user.getStoreId(),
                user.getUserId(),
                user.getUsername(),
                action,
                entityType,
                entityId,
                details,
                resolveIpAddress(request)
        );
    }

    private String resolveEntityType(String path) {
        String[] parts = path.split("/");
        // /api/admin/{entity}/...
        if (parts.length >= 4 && !parts[3].isBlank()) {
            return parts[3];
        }
        return "admin";
    }

    private String resolveEntityId(String path) {
        String[] parts = path.split("/");
        if (parts.length == 0) {
            return null;
        }

        String last = parts[parts.length - 1];
        if (last.matches("\\d+")) {
            return last;
        }

        return null;
    }

    private String resolveIpAddress(HttpServletRequest request) {
        String xff = request.getHeader("X-Forwarded-For");
        if (xff != null && !xff.isBlank()) {
            int comma = xff.indexOf(',');
            return comma > 0 ? xff.substring(0, comma).trim() : xff.trim();
        }
        return request.getRemoteAddr();
    }
}
