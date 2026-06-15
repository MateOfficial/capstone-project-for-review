package com.storeflow.integration.controller;

import com.storeflow.audit.service.AuditService;
import com.storeflow.auth.security.PlatformUserDetails;
import com.storeflow.catalog.entity.Product;
import com.storeflow.catalog.repository.ProductRepository;
import com.storeflow.common.util.ProductNameNormalizer;
import com.storeflow.common.dto.ApiResponse;
import com.storeflow.integration.entity.IntegrationSettings;
import com.storeflow.integration.repository.IntegrationSettingsRepository;
import com.storeflow.integration.service.IntegrationImportService;
import com.storeflow.integration.util.FuzzyMatcher;
import jakarta.servlet.http.HttpServletRequest;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.poi.ss.usermodel.*;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.data.domain.Pageable;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.stream.Collectors;

@Slf4j
@Tag(name = "Integrations", description = "ERP / 1С stock sync")
@RestController
@RequestMapping("/api/admin/integrations")
@RequiredArgsConstructor
public class IntegrationController {

    private final ProductRepository productRepository;
    private final IntegrationSettingsRepository settingsRepository;
    private final IntegrationImportService integrationImportService;
    private final AuditService auditService;

    // ─────────────────────────────────────────────────────────────
    // 0. SETTINGS: get/generate API key for auto-sync
    // ─────────────────────────────────────────────────────────────

    @Operation(summary = "Get 1С integration settings (includes API key)")
    @GetMapping("/1c/settings")
    @PreAuthorize("hasAnyAuthority('catalog.manage', 'catalog.import')")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getSettings(
            @AuthenticationPrincipal PlatformUserDetails user) {

        IntegrationSettings settings = getOrCreateSettings(user.getStoreId());
        return ResponseEntity.ok(ApiResponse.ok(settingsToMap(settings)));
    }

    @Operation(summary = "Regenerate API key for automatic 1С sync")
    @PostMapping("/1c/settings/regenerate-key")
    @PreAuthorize("hasAuthority('catalog.manage')")
    public ResponseEntity<ApiResponse<Map<String, Object>>> regenerateKey(
            @AuthenticationPrincipal PlatformUserDetails user) {

        IntegrationSettings settings = getOrCreateSettings(user.getStoreId());
        settings.setSyncApiKey(UUID.randomUUID().toString().replace("-", ""));
        settingsRepository.save(settings);
        log.info("API key regenerated for store {}", user.getStoreId());
        return ResponseEntity.ok(ApiResponse.ok(settingsToMap(settings)));
    }

    private IntegrationSettings getOrCreateSettings(Long storeId) {
        return settingsRepository.findByStoreIdAndProvider(storeId, "1c")
                .orElseGet(() -> {
                    IntegrationSettings s = IntegrationSettings.builder()
                            .storeId(storeId)
                            .provider("1c")
                            .syncEnabled(false)
                            .syncApiKey(UUID.randomUUID().toString().replace("-", ""))
                            .build();
                    return settingsRepository.save(s);
                });
    }

    private Map<String, Object> settingsToMap(IntegrationSettings s) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("syncApiKey", s.getSyncApiKey());
        m.put("syncEnabled", Boolean.TRUE.equals(s.getSyncEnabled()));
        m.put("lastSyncAt", s.getLastSyncAt());
        m.put("lastSyncCount", s.getLastSyncCount() != null ? s.getLastSyncCount() : 0);
        return m;
    }

    // ─────────────────────────────────────────────────────────────
    // 1. PREVIEW: upload 1С file → get fuzzy match suggestions
    // ─────────────────────────────────────────────────────────────

    /**
     * Upload 1С export (CSV or XLSX).
     * Expects a file with at least one column: the SKU/name from 1С.
     * Optionally a second column: quantity.
     * Returns list of {externalSku, externalName, suggestedProductId, suggestedName, score}.
     */
    @Operation(summary = "Preview 1С SKU mapping suggestions")
    @PostMapping("/1c/preview")
    @PreAuthorize("hasAnyAuthority('catalog.manage', 'catalog.import')")
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> preview1CFile(
            @AuthenticationPrincipal PlatformUserDetails user,
            @RequestParam("file") MultipartFile file) throws Exception {

        List<String[]> rows = parseFile(file);
        List<Product> products = productRepository
                .findAllByStoreIdAndActiveTrue(user.getStoreId(), Pageable.unpaged())
                .stream().toList();

        List<Map<String, Object>> result = new ArrayList<>();
        for (String[] row : rows) {
            if (row.length == 0 || row[0].isBlank()) continue;
            String externalSku = row[0].trim();
            String externalQty = row.length > 1 ? row[1].trim() : "";

            // Find best fuzzy match
            Product bestMatch = null;
            double bestScore = 0.0;
            for (Product p : products) {
                double score = Math.max(
                    FuzzyMatcher.similarity(externalSku, p.getName()),
                    p.getCode() != null ? FuzzyMatcher.similarity(externalSku, p.getCode()) : 0.0
                );
                if (score > bestScore) {
                    bestScore = score;
                    bestMatch = p;
                }
            }

            // Also find top-3 alternatives
            final Product fm = bestMatch;
            final double fs = bestScore;
            List<Map<String, Object>> alternatives = products.stream()
                    .filter(p -> fm == null || !p.getId().equals(fm.getId()))
                    .map(p -> {
                        double s = Math.max(
                            FuzzyMatcher.similarity(externalSku, p.getName()),
                            p.getCode() != null ? FuzzyMatcher.similarity(externalSku, p.getCode()) : 0.0
                        );
                        Map<String, Object> alt = new LinkedHashMap<>();
                        alt.put("id", p.getId());
                        alt.put("name", p.getName());
                        alt.put("score", s);
                        return alt;
                    })
                    .filter(m -> (double) m.get("score") > 0.3)
                    .sorted(Comparator.comparingDouble(m -> -((double) m.get("score"))))
                    .limit(3)
                    .collect(Collectors.toList());

            Map<String, Object> row2 = new LinkedHashMap<>();
            row2.put("externalSku", externalSku);
            row2.put("externalQty", externalQty);
            row2.put("suggestedProductId", bestMatch != null ? bestMatch.getId() : null);
            row2.put("suggestedProductName", bestMatch != null ? bestMatch.getName() : null);
            row2.put("suggestedProductCode", bestMatch != null ? bestMatch.getCode() : null);
            row2.put("score", Math.round(bestScore * 100));
            row2.put("autoConfirm", bestScore >= 0.80);
            row2.put("alternatives", alternatives);
            result.add(row2);
        }

        return ResponseEntity.ok(ApiResponse.ok(result));
    }

    // ─────────────────────────────────────────────────────────────
    // 2. CONFIRM: save external_sku mappings
    // ─────────────────────────────────────────────────────────────

    /**
     * Save confirmed mappings.
     * Body: [ { "productId": 5, "externalSku": "T LM1 03" }, ... ]
     */
    @Operation(summary = "Save confirmed 1С SKU mappings")
    @PostMapping("/1c/confirm-mapping")
    @PreAuthorize("hasAnyAuthority('catalog.manage', 'catalog.import')")
    public ResponseEntity<ApiResponse<Map<String, Object>>> confirmMapping(
            @AuthenticationPrincipal PlatformUserDetails user,
            @RequestBody List<Map<String, Object>> mappings) {

        List<Product> products = productRepository
                .findAllByStoreIdAndActiveTrue(user.getStoreId(), Pageable.unpaged())
                .stream().toList();

        Map<Long, Product> byId = products.stream()
                .collect(Collectors.toMap(Product::getId, p -> p));

        int saved = 0;
        for (Map<String, Object> m : mappings) {
            Object pidObj = m.get("productId");
            Object skuObj = m.get("externalSku");
            if (pidObj == null || skuObj == null) continue;
            Long pid = Long.valueOf(pidObj.toString());
            String sku = skuObj.toString().trim();
            Product p = byId.get(pid);
            if (p != null) {
                p.setExternalSku(sku);
                productRepository.save(p);
                saved++;
            }
        }

        log.info("1C mapping confirmed for store {}: {} mappings saved", user.getStoreId(), saved);
        return ResponseEntity.ok(ApiResponse.ok(Map.of("saved", saved)));
    }

    // ─────────────────────────────────────────────────────────────
    // 3. SYNC: receive live stock update from 1С
    // ─────────────────────────────────────────────────────────────

    @Operation(summary = "Sync stock quantities from 1С")
    @PostMapping("/1c/sync")
    @PreAuthorize("hasAnyAuthority('catalog.manage', 'catalog.import')")
    public ResponseEntity<ApiResponse<Map<String, Object>>> syncFrom1C(
            @AuthenticationPrincipal PlatformUserDetails user,
            @RequestBody List<Map<String, Object>> items) {

        if (items == null || items.isEmpty()) {
            return ResponseEntity.badRequest()
                    .body(ApiResponse.error("No items provided", "MISSING_FIELD"));
        }

        List<Product> products = productRepository
                .findAllByStoreIdAndActiveTrue(user.getStoreId(), Pageable.unpaged())
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
                    .filter(p -> skuF.equalsIgnoreCase(p.getExternalSku()) || skuF.equalsIgnoreCase(p.getCode()))
                    .findFirst();
            if (match.isPresent()) { match.get().setStockQuantity(qtyF); productRepository.save(match.get()); updated++; }
            else skipped++;
        }

        log.info("1C sync store {}: updated={}, skipped={}", user.getStoreId(), updated, skipped);
        return ResponseEntity.ok(ApiResponse.ok(Map.of("updated", updated, "skipped", skipped, "total", items.size())));
    }

    // ─────────────────────────────────────────────────────────────
    // 4. TWO-FILE IMPORT: база.xlsx (stock) + цены.xls (prices)
    //    Joined by Артикул (code). No confirmation needed.
    //    Returns: updated, notFound list, nameChanges list.
    // ─────────────────────────────────────────────────────────────

    /**
     * база.xlsx layout:
     *   Header row index 6 (row 7), data from row index 8 (row 9)
     *   Col 0 = Штрихкод, Col 4 = Артикул (JOIN KEY),
     *   Col 6 = Номенклатура, Col 11 = Итого (total qty)
     *
     * цены.xls layout:
     *   Two header rows (index 0-1), data from row index 2 (row 3)
     *   Col 1 = Артикул (JOIN KEY), Col 6 = Товар, Col 10 = Цена
     */
    @Operation(summary = "Two-file import: stock (база.xlsx) + prices (цены.xls), joined by Артикул")
    @PostMapping("/1c/import")
    @PreAuthorize("hasAnyAuthority('catalog.manage', 'catalog.import')")
    public ResponseEntity<ApiResponse<Map<String, Object>>> importTwoFiles(
            @AuthenticationPrincipal PlatformUserDetails user,
            @RequestParam("stockFile") MultipartFile stockFile,
            @RequestParam("priceFile")  MultipartFile priceFile,
            HttpServletRequest request) {

        Long storeId = user.getStoreId();
        Map<String, Object> result = integrationImportService.importTwoFiles(storeId, stockFile, priceFile);

        auditService.log(
                storeId,
                user.getUserId(),
                user.getUsername(),
                "INTEGRATION_IMPORT_1C",
                "integration",
                "1c",
                Map.of(
                        "updated", result.getOrDefault("updated", 0),
                        "notFoundCount", ((List<?>) result.getOrDefault("notFound", List.of())).size(),
                        "nameChangesCount", ((List<?>) result.getOrDefault("nameChanges", List.of())).size(),
                        "stockFile", stockFile.getOriginalFilename() != null ? stockFile.getOriginalFilename() : "",
                        "priceFile", priceFile.getOriginalFilename() != null ? priceFile.getOriginalFilename() : ""
                ),
                request.getRemoteAddr()
        );

        return ResponseEntity.ok(ApiResponse.ok(result));
    }

    @Operation(summary = "Preflight check for two-file import (no DB writes)")
    @PostMapping("/1c/import/preflight")
    @PreAuthorize("hasAnyAuthority('catalog.manage', 'catalog.import')")
    public ResponseEntity<ApiResponse<Map<String, Object>>> preflightTwoFiles(
            @AuthenticationPrincipal PlatformUserDetails user,
            @RequestParam("stockFile") MultipartFile stockFile,
            @RequestParam("priceFile") MultipartFile priceFile,
            HttpServletRequest request) {

        Map<String, Object> result = integrationImportService.preflightTwoFiles(stockFile, priceFile);

        auditService.log(
                user.getStoreId(),
                user.getUserId(),
                user.getUsername(),
                "INTEGRATION_IMPORT_PREFLIGHT_1C",
                "integration",
                "1c",
                Map.of(
                        "stockRows", result.getOrDefault("stockRows", 0),
                        "priceRows", result.getOrDefault("priceRows", 0),
                        "joinedCodes", result.getOrDefault("joinedCodes", 0),
                        "stockOnly", result.getOrDefault("stockOnly", 0),
                        "priceOnly", result.getOrDefault("priceOnly", 0)
                ),
                request.getRemoteAddr()
        );

        return ResponseEntity.ok(ApiResponse.ok(result));
    }

    /**
     * Apply name changes selected by the user.
     * Body: [{"productId": 5, "newName": "Yamaha P-45 B"}, ...]
     */
    @Operation(summary = "Apply 1С name normalization to selected products")
    @PostMapping("/1c/apply-names")
    @PreAuthorize("hasAnyAuthority('catalog.manage', 'catalog.import')")
    public ResponseEntity<ApiResponse<Map<String, Object>>> applyNames(
            @AuthenticationPrincipal PlatformUserDetails user,
            @RequestBody List<Map<String, Object>> items) {

        Long storeId = user.getStoreId();
        int applied = 0;
        for (Map<String, Object> item : items) {
            if (item.get("productId") == null || item.get("newName") == null) continue;
            Long pid  = Long.valueOf(item.get("productId").toString());
            String nm = item.get("newName").toString().trim();
            if (nm.isBlank()) continue;
            Optional<Product> opt = productRepository.findByIdAndStoreId(pid, storeId);
            if (opt.isPresent()) {
                opt.get().setName(nm);
                // Update searchKey so search reflects new name immediately
                String sk = ProductNameNormalizer.normalize(nm).replaceAll("\\s+", "").toLowerCase();
                opt.get().setSearchKey(sk);
                productRepository.save(opt.get());
                applied++;
            }
        }
        log.info("1C apply-names store {}: applied={}", storeId, applied);
        return ResponseEntity.ok(ApiResponse.ok(Map.of("applied", applied)));
    }

    // ─────────────────────────────────────────────────────────────
    // 5. AUTO-SYNC: called by 1С over local network via API key
    //    POST /api/integration/1c/sync  (no JWT needed)
    //    Header: X-Api-Key: <key>
    //    Body:   [{"sku":"...", "quantity":5}, ...]
    // ─────────────────────────────────────────────────────────────
    // NOTE: this endpoint is registered in a separate controller
    //       PublicSyncController to avoid the /api/admin prefix.

    // ─────────────────────────────────────────────────────────────
    // Helpers
    // ─────────────────────────────────────────────────────────────

    private List<String[]> parseFile(MultipartFile file) throws Exception {
        String name = file.getOriginalFilename() != null ? file.getOriginalFilename().toLowerCase() : "";
        if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
            return parseExcel(file);
        }
        return parseCsv(file);
    }

    private List<String[]> parseCsv(MultipartFile file) throws Exception {
        List<String[]> rows = new ArrayList<>();
        try (BufferedReader br = new BufferedReader(new InputStreamReader(file.getInputStream(), StandardCharsets.UTF_8))) {
            String line;
            boolean first = true;
            while ((line = br.readLine()) != null) {
                if (first) { first = false; continue; } // skip header
                String[] parts = line.split("[,;\t]", -1);
                if (parts.length > 0) rows.add(parts);
            }
        }
        return rows;
    }

    private List<String[]> parseExcel(MultipartFile file) throws Exception {
        List<String[]> rows = new ArrayList<>();
        try (Workbook wb = new XSSFWorkbook(file.getInputStream())) {
            Sheet sheet = wb.getSheetAt(0);
            boolean first = true;
            for (Row row : sheet) {
                if (first) { first = false; continue; } // skip header
                String col0 = getCellStr(row.getCell(0));
                String col1 = getCellStr(row.getCell(1));
                if (!col0.isBlank()) rows.add(new String[]{col0, col1});
            }
        }
        return rows;
    }

    private String getCellStr(Cell cell) {
        if (cell == null) return "";
        return switch (cell.getCellType()) {
            case STRING -> cell.getStringCellValue().trim();
            case NUMERIC -> String.valueOf((long) cell.getNumericCellValue());
            default -> "";
        };
    }
}
