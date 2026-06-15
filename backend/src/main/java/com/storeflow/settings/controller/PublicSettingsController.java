package com.storeflow.settings.controller;

import com.storeflow.common.dto.ApiResponse;
import com.storeflow.settings.service.SettingsService;
import com.storeflow.store.service.StoreResolver;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;
import java.util.Set;

@Tag(name = "Public Settings", description = "Public store settings")
@RestController
@RequestMapping("/api/public/settings")
@RequiredArgsConstructor
public class PublicSettingsController {

    private final SettingsService settingsService;
    private final StoreResolver storeResolver;

    private static final Set<String> PUBLIC_KEYS = Set.of(
        "signature", "companyName", "companyAddress", "companyPhone",
        "company.name", "company.logo", "company.primaryColor", "company.phone", "company.address",
        "warranty.logoMode", "warranty.defaultTerms", "warranty.brandProfiles"
    );

    @Operation(summary = "Get public settings (signature, company info)")
    @GetMapping
    public ResponseEntity<ApiResponse<Map<String, String>>> getPublicSettings(
            @RequestParam(required = false) Long storeId) {
        Map<String, String> all = settingsService.getAllSettings(storeResolver.resolveStoreId(storeId));
        Map<String, String> filtered = new HashMap<>();
        all.forEach((k, v) -> {
            if (PUBLIC_KEYS.contains(k)) {
                filtered.put(k, v);
            }
        });
        return ResponseEntity.ok(ApiResponse.ok(filtered));
    }
}
