package com.storeflow.catalog.service;

import com.storeflow.catalog.dto.*;
import com.storeflow.catalog.entity.Category;
import com.storeflow.catalog.entity.Product;
import com.storeflow.catalog.entity.ProductImage;
import com.storeflow.catalog.repository.CategoryRepository;
import com.storeflow.catalog.repository.ProductImageRepository;
import com.storeflow.catalog.repository.ProductRepository;
import com.storeflow.common.util.SlugUtils;
import com.storeflow.common.util.ProductNameNormalizer;
import com.storeflow.common.exception.DuplicateResourceException;
import com.storeflow.common.exception.ResourceNotFoundException;
import com.storeflow.store.entity.Store;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.poi.ss.usermodel.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.*;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class CatalogService {

    private enum ImportField {
        NAME,
        CODE,
        PRICE,
        DISCOUNT,
        STOCK,
        CATEGORY,
        DESCRIPTION,
        CHARACTERISTICS
    }

    private final ProductRepository productRepository;
    private final CategoryRepository categoryRepository;
    private final ProductImageRepository productImageRepository;

    private static final Set<String> NAME_HEADERS = Set.of(
            "name", "product", "model", "item", "title",
            "наименование", "товар", "модель", "позиция", "номенклатура", "продукт", "название", "описание товара");
    private static final Set<String> CODE_HEADERS = Set.of(
            "code", "sku", "article", "id", "ref", "number", "no",
            "артикул", "код", "штрихкод", "barcode", "номер", "ид");
    private static final Set<String> PRICE_HEADERS = Set.of(
            "price", "cost", "rate", "amount", "sum", "retail", "розница", "прайс",
            "цена", "стоимость", "сумма", "priceuzs", "priceusd", "цена розничная", "розн", "цена продажи");
    private static final Set<String> DISCOUNT_HEADERS = Set.of("discount", "sale", "скидка", "акция", "% скидки");
    private static final Set<String> STOCK_HEADERS = Set.of(
            "stock", "qty", "quantity", "balance", "available",
            "остаток", "количество", "склад", "наличие", "кол-во", "кол");
    private static final Set<String> CATEGORY_HEADERS = Set.of(
            "category", "group", "section", "type", "brand", "class",
            "категория", "группа", "раздел", "тип", "бренд", "марка", "подгруппа");
    private static final Set<String> DESCRIPTION_HEADERS = Set.of(
            "description", "desc", "note", "comment",
            "примечание", "комментарий", "заметка");
    private static final Set<String> CHARACTERISTICS_HEADERS = Set.of(
            "characteristics", "spec", "specs", "features",
            "характеристики", "характер", "производитель");

    private static final Pattern HAS_LETTER_PATTERN = Pattern.compile(".*[A-Za-zА-Яа-я].*");
    private static final Pattern NUMBERISH_PATTERN = Pattern.compile("[0-9][0-9\\s,.'’`]*");

    @Value("${app.upload.dir:./uploads}")
    private String uploadDir;

    // ===================== PRODUCTS =====================

    @Transactional(readOnly = true)
    public Page<ProductDto> listProducts(Long storeId, Pageable pageable) {
        return listProducts(storeId, null, pageable);
    }

    @Transactional(readOnly = true)
    public Page<ProductDto> listProducts(Long storeId, Long categoryId, Pageable pageable) {
        if (categoryId != null) {
            return productRepository.findAllByStoreIdAndCategoryIdAndActiveTrue(storeId, categoryId, pageable)
                    .map(this::toProductDto);
        }
        return productRepository.findAllByStoreIdAndActiveTrue(storeId, pageable)
                .map(this::toProductDto);
    }

    @Transactional(readOnly = true)
    public Page<ProductDto> listAllProducts(Long storeId, Pageable pageable) {
        return productRepository.findAllByStoreId(storeId, pageable)
                .map(this::toProductDto);
    }

    @Transactional(readOnly = true)
    public Page<ProductDto> searchProducts(Long storeId, String query, Pageable pageable) {
        String normalizedQuery = query.replaceAll("\\s+", "").toLowerCase();
        return productRepository.search(storeId, normalizedQuery, pageable)
                .map(this::toProductDto);
    }

    @Transactional(readOnly = true)
    public ProductDto getProduct(Long storeId, Long productId) {
        Product product = productRepository.findByIdAndStoreId(productId, storeId)
                .orElseThrow(() -> new ResourceNotFoundException("Product", productId));
        return toProductDto(product);
    }

    @Transactional
    public ProductDto createProduct(Long storeId, ProductRequest request) {
        Store store = new Store();
        store.setId(storeId);

        Product product = Product.builder()
                .store(store)
                .code(request.getCode())
                .name(ProductNameNormalizer.normalize(request.getName()))
                .searchKey(request.getSearchKey() != null ? request.getSearchKey() :
                        ProductNameNormalizer.normalize(request.getName()).replaceAll("\\s+", "").toLowerCase())
                .description(request.getDescription())
                .detailedDescription(request.getDetailedDescription())
                .price(request.getPrice() != null ? request.getPrice() : 0L)
                .discount(request.getDiscount() != null ? request.getDiscount() : 0)
                .stockQuantity(request.getStockQuantity())
                .features(request.getFeatures())
                .characteristics(request.getCharacteristics())
                .build();

        if (request.getCategoryId() != null) {
            Category category = categoryRepository.findById(request.getCategoryId())
                    .orElseThrow(() -> new ResourceNotFoundException("Category", request.getCategoryId()));
            product.setCategory(category);
        }

        product = productRepository.save(product);
        log.info("Created product: {} for store: {}", product.getName(), storeId);
        return toProductDto(product);
    }

    @Transactional
    public ProductDto updateProduct(Long storeId, Long productId, ProductRequest request) {
        Product product = productRepository.findByIdAndStoreId(productId, storeId)
                .orElseThrow(() -> new ResourceNotFoundException("Product", productId));

        if (request.getCode() != null) product.setCode(request.getCode());
        if (request.getName() != null) product.setName(ProductNameNormalizer.normalize(request.getName()));
        if (request.getSearchKey() != null) product.setSearchKey(request.getSearchKey());
        if (request.getDescription() != null) product.setDescription(request.getDescription());
        if (request.getDetailedDescription() != null) product.setDetailedDescription(request.getDetailedDescription());
        if (request.getPrice() != null) product.setPrice(request.getPrice());
        if (request.getDiscount() != null) product.setDiscount(request.getDiscount());
        if (request.getStockQuantity() != null) product.setStockQuantity(request.getStockQuantity());
        if (request.getFeatures() != null) product.setFeatures(request.getFeatures());
        if (request.getCharacteristics() != null) product.setCharacteristics(request.getCharacteristics());

        if (request.getCategoryId() != null) {
            Category category = categoryRepository.findById(request.getCategoryId())
                    .orElseThrow(() -> new ResourceNotFoundException("Category", request.getCategoryId()));
            product.setCategory(category);
        }

        product = productRepository.save(product);
        return toProductDto(product);
    }

    @Transactional
    public void deleteProduct(Long storeId, Long productId) {
        Product product = productRepository.findByIdAndStoreId(productId, storeId)
                .orElseThrow(() -> new ResourceNotFoundException("Product", productId));
        productRepository.delete(product);
    }

    /**
     * Import products from CSV or Excel (xlsx) file.
     * Expected columns: name, code, price, discount, stock_quantity, category, description, characteristics
     * First row is treated as a header and skipped.
     */
    @Transactional
    public ImportResult importProducts(Long storeId, MultipartFile file) throws IOException {
        String filename = file.getOriginalFilename() != null ? file.getOriginalFilename().toLowerCase() : "";
        if (filename.endsWith(".xlsx") || filename.endsWith(".xls")) {
            return importFromExcel(storeId, file);
        } else {
            return importFromCsv(storeId, file);
        }
    }

    private ImportResult importFromCsv(Long storeId, MultipartFile file) throws IOException {
        List<String> errors = new ArrayList<>();
        int total = 0, imported = 0, skipped = 0;

        List<List<String>> rows = new ArrayList<>();
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(file.getInputStream(), StandardCharsets.UTF_8))) {
            List<String> rawLines = new ArrayList<>();
            String line;
            while ((line = reader.readLine()) != null) {
                if (!line.isBlank()) {
                    rawLines.add(line);
                }
            }
            if (rawLines.isEmpty()) {
                return ImportResult.builder().total(0).imported(0).skipped(0).errors(errors).build();
            }

            char delimiter = detectCsvDelimiter(rawLines.get(0));
            for (String raw : rawLines) {
                rows.add(parseCsvLine(raw, delimiter));
            }
        }

        ImportExecution execution = executeSmartImport(storeId, rows, errors);
        total = execution.total();
        imported = execution.imported();
        skipped = execution.skipped();
        return ImportResult.builder().total(total).imported(imported).skipped(skipped).errors(errors).build();
    }

    private ImportResult importFromExcel(Long storeId, MultipartFile file) throws IOException {
        List<String> errors = new ArrayList<>();
        int total = 0, imported = 0, skipped = 0;

        List<List<String>> rows = new ArrayList<>();
        try (Workbook wb = WorkbookFactory.create(file.getInputStream())) {
            Sheet sheet = wb.getSheetAt(0);
            DataFormatter formatter = new DataFormatter();
            for (Row row : sheet) {
                if (isRowEmpty(row)) continue;
                int lastCell = Math.max(1, row.getLastCellNum());
                List<String> values = new ArrayList<>(lastCell);
                for (int c = 0; c < lastCell; c++) {
                    Cell cell = row.getCell(c);
                    if (cell == null) {
                        values.add("");
                    } else if (cell.getCellType() == org.apache.poi.ss.usermodel.CellType.ERROR
                            || cell.getCellType() == org.apache.poi.ss.usermodel.CellType.FORMULA
                            && cell.getCachedFormulaResultType() == org.apache.poi.ss.usermodel.CellType.ERROR) {
                        values.add("");
                    } else {
                        String v = formatter.formatCellValue(cell).trim();
                        values.add(v.startsWith("#") ? "" : v);
                    }
                }
                rows.add(values);
            }
        }

        ImportExecution execution = executeSmartImport(storeId, rows, errors);
        total = execution.total();
        imported = execution.imported();
        skipped = execution.skipped();
        return ImportResult.builder().total(total).imported(imported).skipped(skipped).errors(errors).build();
    }

    private record ImportExecution(int total, int imported, int skipped) {}

    private record FixedOrderImportPlan(boolean enabled, int startIndex) {}

    private ImportExecution executeSmartImport(Long storeId, List<List<String>> rows, List<String> errors) {
        if (rows.isEmpty()) {
            return new ImportExecution(0, 0, 0);
        }

        // Find the real header row (scan up to first 30 rows)
        int headerIdx = findHeaderRowIndex(rows);
        List<String> headerCandidate = rows.get(headerIdx);

        // Use data rows after header as sample for heuristics
        List<List<String>> sampleRows = rows.stream().skip(headerIdx + 1).limit(8).toList();

        Map<ImportField, Integer> mapping = detectColumnMapping(headerCandidate, sampleRows);

        // Fallback for onboarding-friendly file layout:
        // col0=article, col1=model name, col2=price, col3=category
        FixedOrderImportPlan fixedOrderPlan = detectFixedOrderImportPlan(rows, headerIdx);
        if (fixedOrderPlan.enabled()) {
            mapping.put(ImportField.CODE, 0);
            mapping.put(ImportField.NAME, 1);
            mapping.put(ImportField.PRICE, 2);
            mapping.putIfAbsent(ImportField.CATEGORY, 3);
        }

        // Determine minimum filled-cell threshold: data rows should have at least 2 meaningful fields
        int minDataCells = 2;

        int total = 0;
        int imported = 0;
        int skipped = 0;

        int startIndex = fixedOrderPlan.enabled() ? fixedOrderPlan.startIndex() : headerIdx + 1;
        for (int i = startIndex; i < rows.size(); i++) {
            List<String> row = rows.get(i);
            if (row == null || row.stream().allMatch(v -> v == null || v.isBlank())) {
                continue;
            }
            // Skip section-separator rows (only 1 non-blank cell — e.g. "1 YAMAHA" or "Итого")
            long nonBlank = row.stream().filter(v -> v != null && !v.isBlank()).count();
            if (nonBlank < minDataCells) {
                continue;
            }
            total++;
            int rowNum = i + 1;

            try {
                String name = extractString(row, mapping.get(ImportField.NAME));
                if (name.isBlank()) {
                    name = inferName(row, mapping);
                }
                if (name.isBlank()) {
                    skipped++;
                    errors.add("Row " + rowNum + ": не удалось определить название товара");
                    continue;
                }

                String code = extractString(row, mapping.get(ImportField.CODE));
                long price = extractLong(row, mapping.get(ImportField.PRICE), -1L);
                if (price <= 0) {
                    price = inferPrice(row, mapping);
                }
                if (price <= 0) {
                    skipped++;
                    errors.add("Row " + rowNum + ": не удалось определить цену");
                    continue;
                }

                int discount = (int) extractLong(row, mapping.get(ImportField.DISCOUNT), 0L);
                int stock = (int) extractLong(row, mapping.get(ImportField.STOCK), 0L);
                String categoryName = extractString(row, mapping.get(ImportField.CATEGORY));
                String description = extractString(row, mapping.get(ImportField.DESCRIPTION));
                String chars = extractString(row, mapping.get(ImportField.CHARACTERISTICS));

                createProductFromRaw(storeId, name, code, price, discount, stock, categoryName, description, chars);
                imported++;
            } catch (Exception e) {
                skipped++;
                errors.add("Row " + rowNum + ": " + e.getMessage());
            }
        }

        return new ImportExecution(total, imported, skipped);
    }

    private FixedOrderImportPlan detectFixedOrderImportPlan(List<List<String>> rows, int headerIdx) {
        if (rows.isEmpty()) return new FixedOrderImportPlan(false, headerIdx + 1);

        // Candidate 1: row at headerIdx may already be first data row (file without header)
        List<String> headerRow = rows.get(headerIdx);
        if (isLikelyFixedOrderDataRow(headerRow)) {
            return new FixedOrderImportPlan(true, headerIdx);
        }

        // Candidate 2: classic header + data starts from next row
        int next = headerIdx + 1;
        if (next < rows.size() && isLikelyFixedOrderDataRow(rows.get(next))) {
            return new FixedOrderImportPlan(true, next);
        }

        return new FixedOrderImportPlan(false, headerIdx + 1);
    }

    private boolean isLikelyFixedOrderDataRow(List<String> row) {
        if (row == null || row.size() < 3) return false;

        String code = sanitizeCell(row.get(0));
        String name = sanitizeCell(row.size() > 1 ? row.get(1) : "");
        String priceRaw = sanitizeCell(row.size() > 2 ? row.get(2) : "");

        if (name.isBlank()) return false;
        long price = parseMoney(priceRaw, -1L);
        if (price <= 0) return false;

        // Typical article/code values are mostly numeric or alphanumeric with dashes/slashes.
        String compactCode = code.replace(" ", "");
        boolean validCode = !compactCode.isBlank() && compactCode.matches("[A-Za-z0-9/_\\-\\.]+") && compactCode.length() >= 3;
        return validCode;
    }

    private String sanitizeCell(String value) {
        if (value == null) return "";
        String trimmed = value.trim();
        return trimmed.startsWith("#") ? "" : trimmed;
    }

    private Map<ImportField, Integer> detectColumnMapping(List<String> header, List<List<String>> sampleRows) {
        Map<ImportField, Integer> mapping = new EnumMap<>(ImportField.class);
        for (int i = 0; i < header.size(); i++) {
            String normalized = normalizeHeader(header.get(i));
            if (normalized.isBlank()) continue;

            if (containsAny(normalized, NAME_HEADERS)) mapping.putIfAbsent(ImportField.NAME, i);
            else if (containsAny(normalized, CODE_HEADERS)) mapping.putIfAbsent(ImportField.CODE, i);
            else if (containsAny(normalized, PRICE_HEADERS)) mapping.putIfAbsent(ImportField.PRICE, i);
            else if (containsAny(normalized, DISCOUNT_HEADERS)) mapping.putIfAbsent(ImportField.DISCOUNT, i);
            else if (containsAny(normalized, STOCK_HEADERS)) mapping.putIfAbsent(ImportField.STOCK, i);
            else if (containsAny(normalized, CATEGORY_HEADERS)) mapping.putIfAbsent(ImportField.CATEGORY, i);
            else if (containsAny(normalized, DESCRIPTION_HEADERS)) mapping.putIfAbsent(ImportField.DESCRIPTION, i);
            else if (containsAny(normalized, CHARACTERISTICS_HEADERS)) mapping.putIfAbsent(ImportField.CHARACTERISTICS, i);
        }

        // Infer NAME first (text-heavy column), then find PRICE preferring cols after NAME
        if (!mapping.containsKey(ImportField.NAME)) {
            Integer inferredName = inferNameColumn(sampleRows, mapping.get(ImportField.PRICE));
            if (inferredName != null) mapping.put(ImportField.NAME, inferredName);
        }
        if (!mapping.containsKey(ImportField.PRICE)) {
            Integer inferredPrice = inferPriceColumn(sampleRows, mapping.get(ImportField.NAME));
            if (inferredPrice != null) mapping.put(ImportField.PRICE, inferredPrice);
        }
        // Infer CODE: numeric column BEFORE name (typical catalog layout)
        if (!mapping.containsKey(ImportField.CODE)) {
            Integer inferredCode = inferCodeColumn(sampleRows, mapping.get(ImportField.NAME), mapping.get(ImportField.PRICE));
            if (inferredCode != null) mapping.put(ImportField.CODE, inferredCode);
        }
        if (!mapping.containsKey(ImportField.CATEGORY)) {
            Integer inferredCategory = inferCategoryColumn(sampleRows, mapping.get(ImportField.NAME), mapping.get(ImportField.PRICE));
            if (inferredCategory != null) mapping.put(ImportField.CATEGORY, inferredCategory);
        }
        return mapping;
    }

    /**
     * Scan the first up to 30 rows to find the most likely header row.
     * Picks the row with the highest number of dictionary hits.
     * Falls back to row 0 if nothing recognizable is found.
     */
    private int findHeaderRowIndex(List<List<String>> rows) {
        int bestIdx = 0;
        int bestScore = 0;
        int limit = Math.min(30, rows.size());
        for (int i = 0; i < limit; i++) {
            List<String> row = rows.get(i);
            int score = 0;
            for (String cell : row) {
                String n = normalizeHeader(cell);
                if (n.isBlank()) continue;
                if (containsAny(n, NAME_HEADERS)) score += 3;
                else if (containsAny(n, PRICE_HEADERS)) score += 3;
                else if (containsAny(n, CODE_HEADERS)) score += 2;
                else if (containsAny(n, CATEGORY_HEADERS)) score += 2;
                else if (containsAny(n, STOCK_HEADERS)) score += 2;
                else if (containsAny(n, DISCOUNT_HEADERS)) score += 1;
                else if (containsAny(n, DESCRIPTION_HEADERS)) score += 1;
            }
            if (score > bestScore) {
                bestScore = score;
                bestIdx = i;
            }
        }
        return bestIdx;
    }

    private Integer inferPriceColumn(List<List<String>> rows) {
        if (rows.isEmpty()) return null;
        return inferPriceColumn(rows, null);
    }

    /** Find the price column. When nameColumn is known, prefer columns AFTER it (price typically follows name). */
    private Integer inferPriceColumn(List<List<String>> rows, Integer nameColumn) {
        if (rows.isEmpty()) return null;
        int maxCols = rows.stream().mapToInt(List::size).max().orElse(0);

        record ColStats(int idx, double score, double avgValue) {}
        List<ColStats> candidates = new ArrayList<>();

        for (int c = 0; c < maxCols; c++) {
            int numericLike = 0;
            int nonEmpty = 0;
            long sumValues = 0;
            for (List<String> row : rows) {
                if (c >= row.size()) continue;
                String val = row.get(c) == null ? "" : row.get(c).trim();
                if (val.isBlank()) continue;
                nonEmpty++;
                long parsed = parseMoney(val, -1L);
                if (parsed > 0) {
                    numericLike++;
                    sumValues += parsed;
                }
            }
            if (nonEmpty == 0) continue;
            double score = (double) numericLike / nonEmpty;
            if (score >= 0.6) {
                candidates.add(new ColStats(c, score, nonEmpty > 0 ? (double) sumValues / nonEmpty : 0));
            }
        }
        if (candidates.isEmpty()) return null;

        // Prefer columns that come AFTER the name column (price follows name in typical layouts)
        if (nameColumn != null) {
            List<ColStats> afterName = candidates.stream()
                    .filter(cs -> cs.idx() > nameColumn).toList();
            if (!afterName.isEmpty()) {
                // Among after-name candidates, pick highest score; tiebreak by higher average value
                return afterName.stream()
                        .max(Comparator.comparingDouble(ColStats::score)
                                .thenComparingDouble(ColStats::avgValue))
                        .map(ColStats::idx).orElse(null);
            }
        }
        // Fallback: pick best scoring candidate overall; tiebreak by higher average (price > code)
        return candidates.stream()
                .max(Comparator.comparingDouble(ColStats::score)
                        .thenComparingDouble(ColStats::avgValue))
                .map(ColStats::idx).orElse(null);
    }

    /** Find a code column: pure-numeric, SHORT values, typically BEFORE the name column. */
    private Integer inferCodeColumn(List<List<String>> rows, Integer nameColumn, Integer priceColumn) {
        if (rows.isEmpty()) return null;
        int maxCols = rows.stream().mapToInt(List::size).max().orElse(0);
        for (int c = 0; c < maxCols; c++) {
            if (Objects.equals(c, nameColumn) || Objects.equals(c, priceColumn)) continue;
            int numericLike = 0;
            int nonEmpty = 0;
            for (List<String> row : rows) {
                if (c >= row.size()) continue;
                String v = row.get(c) == null ? "" : row.get(c).trim();
                if (v.isBlank()) continue;
                nonEmpty++;
                // Code: all digits, length 4-20
                if (v.matches("\\d{4,20}")) numericLike++;
            }
            if (nonEmpty > 0 && (double) numericLike / nonEmpty >= 0.7) {
                // If nameColumn is known, prefer cols before name for code
                if (nameColumn == null || c < nameColumn) return c;
            }
        }
        return null;
    }

    private Integer inferNameColumn(List<List<String>> rows, Integer priceColumn) {
        if (rows.isEmpty()) return null;
        int maxCols = rows.stream().mapToInt(List::size).max().orElse(0);
        double bestScore = -1;
        Integer bestIdx = null;

        for (int c = 0; c < maxCols; c++) {
            if (priceColumn != null && c == priceColumn) continue;
            int textLike = 0;
            int nonEmpty = 0;
            for (List<String> row : rows) {
                if (c >= row.size()) continue;
                String v = row.get(c) == null ? "" : row.get(c).trim();
                if (v.isBlank()) continue;
                nonEmpty++;
                if (looksLikeName(v)) textLike++;
            }
            if (nonEmpty == 0) continue;
            double score = (double) textLike / nonEmpty;
            if (score > bestScore && score >= 0.5) {
                bestScore = score;
                bestIdx = c;
            }
        }
        return bestIdx;
    }

    private Integer inferCategoryColumn(List<List<String>> rows, Integer nameColumn, Integer priceColumn) {
        if (rows.isEmpty()) return null;
        int maxCols = rows.stream().mapToInt(List::size).max().orElse(0);

        for (int c = 0; c < maxCols; c++) {
            if (Objects.equals(c, nameColumn) || Objects.equals(c, priceColumn)) continue;
            Set<String> uniq = new HashSet<>();
            for (List<String> row : rows) {
                if (c < row.size()) {
                    String v = row.get(c) == null ? "" : row.get(c).trim();
                    if (!v.isBlank() && v.length() < 50 && HAS_LETTER_PATTERN.matcher(v).matches()) {
                        uniq.add(v.toLowerCase());
                    }
                }
            }
            if (!uniq.isEmpty() && uniq.size() <= 20) {
                return c;
            }
        }
        return null;
    }

    private String extractString(List<String> row, Integer idx) {
        if (idx == null || idx < 0 || idx >= row.size()) return "";
        String value = row.get(idx);
        if (value == null) return "";
        String trimmed = value.trim();
        // Treat Excel formula errors as empty values
        if (trimmed.startsWith("#")) return "";
        return trimmed;
    }

    private long extractLong(List<String> row, Integer idx, long fallback) {
        String value = extractString(row, idx);
        if (value.isBlank()) return fallback;
        return parseMoney(value, fallback);
    }

    private String inferName(List<String> row, Map<ImportField, Integer> mapping) {
        Integer priceIdx = mapping.get(ImportField.PRICE);
        String best = "";
        for (int i = 0; i < row.size(); i++) {
            if (Objects.equals(i, priceIdx)) continue;
            String v = row.get(i) == null ? "" : row.get(i).trim();
            if (looksLikeName(v) && v.length() > best.length()) {
                best = v;
            }
        }
        return best;
    }

    private long inferPrice(List<String> row, Map<ImportField, Integer> mapping) {
        Integer nameIdx = mapping.get(ImportField.NAME);
        long best = -1L;
        for (int i = 0; i < row.size(); i++) {
            if (Objects.equals(i, nameIdx)) continue;
            String v = row.get(i) == null ? "" : row.get(i).trim();
            long parsed = parseMoney(v, -1L);
            if (parsed > best) {
                best = parsed;
            }
        }
        return best;
    }

    private boolean looksLikeName(String v) {
        if (v == null || v.isBlank()) return false;
        if (!HAS_LETTER_PATTERN.matcher(v).matches()) return false;
        return !v.equalsIgnoreCase("none") && !v.equalsIgnoreCase("null");
    }

    private String normalizeHeader(String value) {
        if (value == null) return "";
        return value.toLowerCase(Locale.ROOT)
                .replace("№", "")
                .replaceAll("[\\p{Punct}\\s]+", "")
                .trim();
    }

    private boolean containsAny(String normalized, Set<String> dictionary) {
        for (String token : dictionary) {
            String t = normalizeHeader(token);
            if (!t.isBlank() && normalized.contains(t)) return true;
        }
        return false;
    }

    private char detectCsvDelimiter(String firstLine) {
        int comma = countChar(firstLine, ',');
        int semicolon = countChar(firstLine, ';');
        int tab = countChar(firstLine, '\t');
        if (semicolon >= comma && semicolon >= tab) return ';';
        if (tab >= comma && tab >= semicolon) return '\t';
        return ',';
    }

    private int countChar(String s, char ch) {
        int c = 0;
        for (int i = 0; i < s.length(); i++) if (s.charAt(i) == ch) c++;
        return c;
    }

    private List<String> parseCsvLine(String line, char delimiter) {
        List<String> result = new ArrayList<>();
        StringBuilder current = new StringBuilder();
        boolean inQuotes = false;
        for (int i = 0; i < line.length(); i++) {
            char ch = line.charAt(i);
            if (ch == '"') {
                if (inQuotes && i + 1 < line.length() && line.charAt(i + 1) == '"') {
                    current.append('"');
                    i++;
                } else {
                    inQuotes = !inQuotes;
                }
            } else if (ch == delimiter && !inQuotes) {
                result.add(current.toString().trim());
                current.setLength(0);
            } else {
                current.append(ch);
            }
        }
        result.add(current.toString().trim());
        return result;
    }

    private void createProductFromRaw(Long storeId, String name, String code, long price,
                                      int discount, int stock, String categoryName,
                                      String description, String chars) {
        Store store = new Store();
        store.setId(storeId);

        Category category = null;
        if (!categoryName.isBlank()) {
            String slug = SlugUtils.normalizeSlug(categoryName);
            category = categoryRepository.findByStoreIdAndSlug(storeId, slug)
                    .orElseGet(() -> {
                        Category c = Category.builder()
                                .store(store).name(categoryName).slug(slug).sortOrder(0).build();
                        return categoryRepository.save(c);
                    });
        }

        Product product = Product.builder()
                .store(store)
                .code(code.isBlank() ? null : code)
                .name(ProductNameNormalizer.normalize(name))
                .searchKey(ProductNameNormalizer.normalize(name).replaceAll("\\s+", "").toLowerCase())
                .description(description.isBlank() ? null : description)
                .price(price)
                .discount(Math.max(0, Math.min(100, discount)))
                .stockQuantity(stock)
                .characteristics(chars.isBlank() ? null : chars)
                .category(category)
                .build();
        productRepository.save(product);
    }

    // ---- Excel / CSV helpers ----
    private boolean isRowEmpty(Row row) {
        if (row == null) return true;
        for (Cell c : row) {
            if (c != null && c.getCellType() != CellType.BLANK) return false;
        }
        return true;
    }

    private long parseMoney(String value, long fallback) {
        if (value == null) return fallback;
        String v = value.trim();
        if (v.isBlank()) return fallback;

        if (!NUMBERISH_PATTERN.matcher(v).find()) {
            return fallback;
        }

        v = v.replace('\u00A0', ' ')
            .replaceAll("(?i)(uzs|сум|sum|usd|eur|руб|р|\\$|€)", "")
                .replace("'", "")
                .replace("’", "")
                .replace("`", "")
                .replaceAll("\\s+", "");

        int lastComma = v.lastIndexOf(',');
        int lastDot = v.lastIndexOf('.');
        int decimalPos = Math.max(lastComma, lastDot);

        if (decimalPos > 0 && decimalPos < v.length() - 1) {
            String frac = v.substring(decimalPos + 1);
            if (frac.length() <= 2) {
                String intPart = v.substring(0, decimalPos).replaceAll("[.,]", "");
                String normalized = intPart + "." + frac;
                try {
                    return new BigDecimal(normalized).setScale(0, RoundingMode.HALF_UP).longValue();
                } catch (Exception ignored) {
                    // fallback to integer-only extraction below
                }
            }
        }

        String digitsOnly = v.replaceAll("[^0-9]", "");
        if (digitsOnly.isBlank()) return fallback;
        try {
            return Long.parseLong(digitsOnly);
        } catch (Exception e) {
            return fallback;
        }
    }

    @Transactional
    public ProductDto uploadImage(Long storeId, Long productId, MultipartFile file) throws IOException {
        Product product = productRepository.findByIdAndStoreId(productId, storeId)
                .orElseThrow(() -> new ResourceNotFoundException("Product", productId));

        Path uploadPath = Paths.get(uploadDir, "products", storeId.toString());
        Files.createDirectories(uploadPath);

        String originalFilename = file.getOriginalFilename();
        String extension = originalFilename != null && originalFilename.contains(".")
                ? originalFilename.substring(originalFilename.lastIndexOf('.'))
                : ".jpg";
        String filename = UUID.randomUUID() + extension;
        Path filePath = uploadPath.resolve(filename);
        file.transferTo(filePath.toFile());

        ProductImage image = ProductImage.builder()
                .product(product)
                .url("/uploads/products/" + storeId + "/" + filename)
                .primaryImage(product.getImages().isEmpty())
                .build();
        productImageRepository.save(image);

        return toProductDto(productRepository.findById(productId).orElseThrow());
    }

    // ===================== CATEGORIES =====================

    @Transactional(readOnly = true)
    public List<CategoryDto> listCategories(Long storeId) {
        Map<Long, Long> productCountsByCategory = productRepository.countActiveByStoreIdGroupedByCategory(storeId)
                .stream()
                .collect(Collectors.toMap(
                        row -> (Long) row[0],
                        row -> (Long) row[1],
                        (left, right) -> left
                ));

        return categoryRepository.findAllByStoreIdAndActiveTrue(storeId).stream()
                .map(category -> toCategoryDto(category, productCountsByCategory.getOrDefault(category.getId(), 0L)))
                .collect(Collectors.toList());
    }

    @Transactional
    public CategoryDto createCategory(Long storeId, CategoryRequest request) {
                String source = request.getSlug() != null ? request.getSlug() : request.getName();
                String slug = SlugUtils.normalizeSlug(source);

        if (categoryRepository.existsByStoreIdAndSlug(storeId, slug)) {
            throw new DuplicateResourceException("Category", "slug", slug);
        }

        Store store = new Store();
        store.setId(storeId);

        Category category = Category.builder()
                .store(store)
                .name(request.getName())
                .slug(slug)
                .sortOrder(request.getSortOrder() != null ? request.getSortOrder() : 0)
                .build();

        if (request.getParentId() != null) {
            Category parent = categoryRepository.findById(request.getParentId())
                    .orElseThrow(() -> new ResourceNotFoundException("Category", request.getParentId()));
            category.setParent(parent);
        }

        category = categoryRepository.save(category);
        return toCategoryDto(category);
    }

    @Transactional
    public CategoryDto updateCategory(Long storeId, Long categoryId, CategoryRequest request) {
        Category category = categoryRepository.findById(categoryId)
                .orElseThrow(() -> new ResourceNotFoundException("Category", categoryId));

        if (request.getName() != null) category.setName(request.getName());
        if (request.getSortOrder() != null) category.setSortOrder(request.getSortOrder());

        category = categoryRepository.save(category);
        return toCategoryDto(category);
    }

    @Transactional
    public void deleteCategory(Long storeId, Long categoryId) {
        Category category = categoryRepository.findById(categoryId)
                .orElseThrow(() -> new ResourceNotFoundException("Category", categoryId));
        categoryRepository.delete(category);
    }

    // ===================== STATS =====================

    public record CatalogStats(long totalProducts, long discountedProducts, long totalCategories) {}

    @Transactional(readOnly = true)
    public CatalogStats getStats(Long storeId) {
        return new CatalogStats(
                productRepository.countActiveByStoreId(storeId),
                productRepository.countDiscountedByStoreId(storeId),
                categoryRepository.findAllByStoreIdAndActiveTrue(storeId).size()
        );
    }

    // ===================== MAPPERS =====================

    private ProductDto toProductDto(Product p) {
        Long discountedPrice = p.getPrice();
        if (p.getDiscount() != null && p.getDiscount() > 0) {
            discountedPrice = p.getPrice() - (p.getPrice() * p.getDiscount() / 100);
        }

        return ProductDto.builder()
                .id(p.getId())
                .code(p.getCode())
                .name(p.getName())
                .searchKey(p.getSearchKey())
                .description(p.getDescription())
                .detailedDescription(p.getDetailedDescription())
                .categoryId(p.getCategory() != null ? p.getCategory().getId() : null)
                .categoryName(p.getCategory() != null ? p.getCategory().getName() : null)
                .price(p.getPrice())
                .discount(p.getDiscount())
                .discountedPrice(discountedPrice)
                .stockQuantity(p.getStockQuantity())
                .warehouseStock(p.getWarehouseStock())
                .active(p.getActive())
                .features(p.getFeatures())
                .characteristics(p.getCharacteristics())
                .images(p.getImages().stream().map(img -> ProductDto.ImageDto.builder()
                        .id(img.getId())
                        .url(img.getUrl())
                        .altText(img.getAltText())
                        .primaryImage(img.getPrimaryImage())
                        .build()).collect(Collectors.toList()))
                .createdAt(p.getCreatedAt())
                .updatedAt(p.getUpdatedAt())
                .build();
    }

    private CategoryDto toCategoryDto(Category c) {
                return toCategoryDto(c, 0L);
        }

        private CategoryDto toCategoryDto(Category c, Long productCount) {
        return CategoryDto.builder()
                .id(c.getId())
                .name(c.getName())
                .slug(c.getSlug())
                .parentId(c.getParent() != null ? c.getParent().getId() : null)
                .sortOrder(c.getSortOrder())
                .active(c.getActive())
                                .productCount(productCount)
                .build();
    }
}
