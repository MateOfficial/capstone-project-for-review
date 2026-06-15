package com.storeflow.onboarding.controller;

import com.storeflow.common.dto.ApiResponse;
import com.storeflow.onboarding.dto.OnboardingRequest;
import com.storeflow.onboarding.dto.OnboardingStatus;
import com.storeflow.onboarding.service.OnboardingService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@Tag(name = "Onboarding", description = "First-run setup wizard")
@RestController
@RequestMapping("/api/onboarding")
@RequiredArgsConstructor
public class OnboardingController {

    private final OnboardingService onboardingService;

    @Operation(summary = "Get onboarding status")
    @GetMapping("/status")
    public ResponseEntity<ApiResponse<OnboardingStatus>> getStatus() {
        return ResponseEntity.ok(ApiResponse.ok(onboardingService.getStatus()));
    }

    @Operation(summary = "Initialize the system")
    @PostMapping("/initialize")
    public ResponseEntity<ApiResponse<OnboardingStatus>> initialize(
            @Valid @RequestBody OnboardingRequest request) {
        return ResponseEntity.ok(ApiResponse.ok(onboardingService.initialize(request)));
    }
}
