package com.storeflow.audit.controller;

import com.storeflow.audit.entity.AuditLog;
import com.storeflow.audit.service.AuditService;
import com.storeflow.auth.security.PlatformUserDetails;
import com.storeflow.common.dto.ApiResponse;
import com.storeflow.common.dto.PageResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@Tag(name = "Audit", description = "Audit log")
@RestController
@RequestMapping("/api/admin/audit")
@RequiredArgsConstructor
public class AuditController {

    private final AuditService auditService;

    @Operation(summary = "Get audit log")
    @GetMapping
    @PreAuthorize("hasAuthority('admin.audit')")
    public ResponseEntity<ApiResponse<PageResponse<AuditLog>>> getAuditLog(
            @AuthenticationPrincipal PlatformUserDetails user,
            @RequestParam(required = false) String entityType,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size) {
        Page<AuditLog> result = entityType != null
                ? auditService.getAuditLogByEntity(user.getStoreId(), entityType, PageRequest.of(page, size))
                : auditService.getAuditLog(user.getStoreId(), PageRequest.of(page, size));
        return ResponseEntity.ok(ApiResponse.ok(PageResponse.<AuditLog>builder()
                .content(result.getContent()).page(result.getNumber())
                .size(result.getSize()).totalElements(result.getTotalElements())
                .totalPages(result.getTotalPages()).last(result.isLast()).build()));
    }
}
