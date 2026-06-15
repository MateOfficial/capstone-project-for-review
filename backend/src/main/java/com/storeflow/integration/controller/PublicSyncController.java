package com.storeflow.integration.controller;

import com.storeflow.catalog.entity.Product;
import com.storeflow.catalog.repository.ProductRepository;
import com.storeflow.common.dto.ApiResponse;
import com.storeflow.integration.entity.IntegrationSettings;
import com.storeflow.integration.repository.IntegrationSettingsRepository;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Pageable;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Auto-sync endpoint for 1С integration over local network.
 * Authentication: X-Api-Key header (no JWT required).
 * 1С calls this endpoint automatically on schedule.
 */
@Slf4j
@Tag(name = "Auto Sync", description = "Automatic 1С sync via API key (no login needed)")
@RestController
@RequestMapping("/api/integration")
@RequiredArgsConstructor
public class PublicSyncController {

    private final ProductRepository productRepository;
    private final IntegrationSettingsRepository settingsRepository;

    /**
     * Sync stock quantities from 1С automatically.
     * <br>Example curl (from local network):
     * <pre>
     *   curl -X POST http://192.168.1.50:8080/api/integration/1c/sync \
     *        -H "X-Api-Key: YOUR_KEY_HERE" \
     *        -H "Content-Type: application/json" \
     *        -d '[{"sku":"KLA-001","quantity":5}]'
     * </pre>
     */
    @Operation(summary = "Auto-sync stock from 1С (API key auth)")
    @PostMapping("/1c/sync")
    public ResponseEntity<ApiResponse<Map<String, Object>>> autoSync(
            @RequestHeader(value = "X-Api-Key", required = false) String apiKey,
            @RequestBody List<Map<String, Object>> items) {

        if (apiKey == null || apiKey.isBlank()) {
            return ResponseEntity.status(401)
                    .body(ApiResponse.error("API key required. Add header: X-Api-Key: <your_key>", "UNAUTHORIZED"));
        }

        Optional<IntegrationSettings> settingsOpt = settingsRepository.findBySyncApiKey(apiKey.trim());
        if (settingsOpt.isEmpty()) {
            return ResponseEntity.status(401)
                    .body(ApiResponse.error("Invalid API key", "UNAUTHORIZED"));
        }

        IntegrationSettings settings = settingsOpt.get();
        Long storeId = settings.getStoreId();

        if (items == null || items.isEmpty()) {
            return ResponseEntity.badRequest()
                    .body(ApiResponse.error("No items provided", "MISSING_FIELD"));
        }

        List<Product> products = productRepository
                .findAllByStoreIdAndActiveTrue(storeId, Pageable.unpaged())
                .stream().toList();

        int updated = 0, skipped = 0;
        for (Map<String, Object> item : items) {
            String sku = String.valueOf(item.getOrDefault("sku", "")).trim();
            Object qtyObj = item.get("quantity");
            if (sku.isBlank() || qtyObj == null) { skipped++; continue; }
            int qty;
            try { qty = Integer.parseInt(String.valueOf(qtyObj)); }
            catch (NumberFormatException e) { skipped++; continue; }
            final String skuF = sku;
            final int qtyF = qty;
            Optional<Product> match = products.stream()
                    .filter(p -> skuF.equalsIgnoreCase(p.getExternalSku())
                              || skuF.equalsIgnoreCase(p.getCode()))
                    .findFirst();
            if (match.isPresent()) {
                match.get().setStockQuantity(qtyF);
                productRepository.save(match.get());
                updated++;
            } else {
                skipped++;
            }
        }

        // Update last sync stats
        settings.setLastSyncAt(LocalDateTime.now());
        settings.setLastSyncCount(updated);
        settingsRepository.save(settings);

        log.info("Auto-sync store {}: updated={}, skipped={}, total={}", storeId, updated, skipped, items.size());
        return ResponseEntity.ok(ApiResponse.ok(
                Map.of("updated", updated, "skipped", skipped, "total", items.size())));
    }
}
