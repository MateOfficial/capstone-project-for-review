package com.storeflow.reporting.controller;

import com.storeflow.auth.security.PlatformUserDetails;
import com.storeflow.common.dto.ApiResponse;
import com.storeflow.reporting.dto.ReportSummary;
import com.storeflow.reporting.service.ReportingService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "Reports", description = "Operational reporting")
@RestController
@RequestMapping("/api/admin/reports")
@RequiredArgsConstructor
public class ReportController {

    private final ReportingService reportingService;

    @Operation(summary = "Get summary report")
    @GetMapping("/summary")
    @PreAuthorize("hasAuthority('reports.view')")
    public ResponseEntity<ApiResponse<ReportSummary>> getSummary(
            @AuthenticationPrincipal PlatformUserDetails user) {
        return ResponseEntity.ok(ApiResponse.ok(reportingService.getSummary(user.getStoreId())));
    }
}
