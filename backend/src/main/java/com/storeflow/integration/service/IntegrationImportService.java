package com.storeflow.integration.service;

import com.storeflow.catalog.entity.Product;
import com.storeflow.catalog.repository.ProductRepository;
import com.storeflow.common.exception.BusinessException;
import com.storeflow.common.util.ProductNameNormalizer;
import com.storeflow.store.entity.Store;
import com.storeflow.store.repository.StoreRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.ss.usermodel.WorkbookFactory;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;

@Slf4j
@Service
@RequiredArgsConstructor
public class IntegrationImportService {

    private final ProductRepository productRepository;
    private final StoreRepository storeRepository;

    public Map<String, Object> preflightTwoFiles(MultipartFile stockFile, MultipartFile priceFile) {
        validateImportFile(stockFile, Set.of("xlsx", "xls"), "stockFile");
        validateImportFile(priceFile, Set.of("xlsx", "xls"), "priceFile");

        Map<String, StockRow> stockMap = parseStockFile(stockFile);
        Map<String, PriceRow> priceMap = parsePriceFile(priceFile);

        Set<String> allCodes = new LinkedHashSet<>();
        allCodes.addAll(stockMap.keySet());
        allCodes.addAll(priceMap.keySet());

        int stockRows = stockMap.size();
        int priceRows = priceMap.size();
        int joinedCodes = allCodes.size();
        int stockOnly = (int) stockMap.keySet().stream().filter(code -> !priceMap.containsKey(code)).count();
        int priceOnly = (int) priceMap.keySet().stream().filter(code -> !stockMap.containsKey(code)).count();

        List<String> warehouseNames = stockMap.values().stream()
                .findFirst()
                .map(StockRow::warehouseStock)
                .map(m -> new ArrayList<>(m.keySet()))
                .orElseGet(ArrayList::new);

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("stockRows", stockRows);
        result.put("priceRows", priceRows);
        result.put("joinedCodes", joinedCodes);
        result.put("stockOnly", stockOnly);
        result.put("priceOnly", priceOnly);
        result.put("warehouseCount", warehouseNames.size());
        result.put("warehouseNames", warehouseNames);
        return result;
    }

    @Transactional
    public Map<String, Object> importTwoFiles(Long storeId, MultipartFile stockFile, MultipartFile priceFile) {
        validateImportFile(stockFile, Set.of("xlsx", "xls"), "stockFile");
        validateImportFile(priceFile, Set.of("xlsx", "xls"), "priceFile");

        Store store = storeRepository.findById(storeId)
                .orElseThrow(() -> new IllegalStateException("Store not found: " + storeId));

        List<Product> storeProducts = productRepository.findAllByStoreId(storeId, Pageable.unpaged()).getContent();
        Map<String, Product> productsByCanonicalCode = new HashMap<>();
        Map<String, List<Product>> productsByCanonicalCodeGroup = new HashMap<>();
        Map<String, Product> productsBySearchKey = new HashMap<>();
        for (Product product : storeProducts) {
            String canonicalCode = normalizeCode(product.getCode());
            if (!canonicalCode.isBlank()) {
                productsByCanonicalCode.putIfAbsent(canonicalCode, product);
                productsByCanonicalCodeGroup.computeIfAbsent(canonicalCode, k -> new ArrayList<>()).add(product);
            }
            if (product.getSearchKey() != null && !product.getSearchKey().isBlank()) {
                productsBySearchKey.putIfAbsent(product.getSearchKey().trim().toLowerCase(), product);
            }
        }

        Map<String, StockRow> stockMap = parseStockFile(stockFile);
        Map<String, PriceRow> priceMap = parsePriceFile(priceFile);

        Set<String> allCodes = new LinkedHashSet<>();
        allCodes.addAll(stockMap.keySet());
        allCodes.addAll(priceMap.keySet());

        int updated = 0;
        List<Map<String, Object>> notFound = new ArrayList<>();
        List<Map<String, Object>> nameChanges = new ArrayList<>();

        for (String code : allCodes) {
            StockRow stock = stockMap.get(code);
            PriceRow price = priceMap.get(code);
            String icName = price != null ? price.icName() : stock != null ? stock.icName() : code;

            Optional<Product> optProduct = productRepository.findByStoreIdAndCode(storeId, code);

            if (optProduct.isEmpty()) {
                Product byCanonicalCode = productsByCanonicalCode.get(normalizeCode(code));
                if (byCanonicalCode != null) {
                    optProduct = Optional.of(byCanonicalCode);
                }
            }

            if (optProduct.isEmpty() && stock != null && !stock.barcode().isBlank()) {
                optProduct = productRepository.findByStoreIdAndBarcode(storeId, stock.barcode());
            }

            if (optProduct.isEmpty() && !icName.isBlank()) {
                Product bySearchKey = productsBySearchKey.get(toSearchKey(icName));
                if (bySearchKey != null) {
                    optProduct = Optional.of(bySearchKey);
                }
            }

            if (optProduct.isEmpty() && !icName.isBlank()) {
                optProduct = productRepository.findByStoreIdAndNameNormalized(storeId, icName);
            }

            if (optProduct.isEmpty()) {
                if (!icName.isBlank()) {
                    Product newP = new Product();
                    newP.setStore(store);
                    newP.setCode(code);
                    newP.setName(icName);
                    newP.setSearchKey(toSearchKey(icName));
                    newP.setActive(true);
                    if (stock != null) {
                        newP.setStockQuantity(stock.qty());
                        if (!stock.barcode().isBlank()) newP.setBarcode(stock.barcode());
                        if (stock.warehouseStock() != null) newP.setWarehouseStock(stock.warehouseStock());
                    }
                    if (price != null && price.price() > 0) {
                        newP.setPrice(price.price());
                    }
                    Product saved = productRepository.save(newP);
                    String savedCanonicalCode = normalizeCode(saved.getCode());
                    productsByCanonicalCode.putIfAbsent(savedCanonicalCode, saved);
                    if (!savedCanonicalCode.isBlank()) {
                        productsByCanonicalCodeGroup.computeIfAbsent(savedCanonicalCode, k -> new ArrayList<>()).add(saved);
                    }
                    if (saved.getSearchKey() != null && !saved.getSearchKey().isBlank()) {
                        productsBySearchKey.putIfAbsent(saved.getSearchKey().trim().toLowerCase(), saved);
                    }
                    if (stock != null) {
                        List<Product> siblings = productsByCanonicalCodeGroup.getOrDefault(savedCanonicalCode, List.of());
                        for (Product sibling : siblings) {
                            if (Objects.equals(sibling.getId(), saved.getId())) continue;
                            sibling.setStockQuantity(saved.getStockQuantity());
                            if (saved.getWarehouseStock() != null) sibling.setWarehouseStock(saved.getWarehouseStock());
                            if (saved.getBarcode() != null && !saved.getBarcode().isBlank() && (sibling.getBarcode() == null || sibling.getBarcode().isBlank())) {
                                sibling.setBarcode(saved.getBarcode());
                            }
                            productRepository.save(sibling);
                        }
                    }
                    updated++;
                } else {
                    Map<String, Object> nf = new LinkedHashMap<>();
                    nf.put("code", code);
                    nf.put("icName", icName);
                    notFound.add(nf);
                }
                continue;
            }

            Product p = optProduct.get();
            boolean changed = false;

            // Always normalize the current card name on import so model spacing/casing is fixed
            // without requiring a separate manual "apply names" action.
            String normalizedCurrentCardName = normalizeName(p.getName());
            if (!normalizedCurrentCardName.isBlank() && !normalizedCurrentCardName.equals(p.getName())) {
                p.setName(normalizedCurrentCardName);
                p.setSearchKey(toSearchKey(normalizedCurrentCardName));
                changed = true;
            }

            if (stock != null) {
                p.setStockQuantity(stock.qty());
                if (!stock.barcode().isBlank()) p.setBarcode(stock.barcode());
                if (stock.warehouseStock() != null) p.setWarehouseStock(stock.warehouseStock());
                changed = true;
            }
            if (price != null && price.price() > 0) {
                p.setPrice(price.price());
                changed = true;
            }

            if (!icName.isBlank()) {
                String currentName = normalizeName(p.getName());
                String normalizedIncomingName = normalizeName(icName);
                if (!currentName.equalsIgnoreCase(normalizedIncomingName)) {
                    Map<String, Object> nc = new LinkedHashMap<>();
                    nc.put("productId", p.getId());
                    nc.put("currentName", p.getName());
                    nc.put("icName", normalizedIncomingName);
                    nc.put("code", code);
                    nameChanges.add(nc);
                }
            }

            if (changed) {
                Product saved = productRepository.save(p);
                String savedCanonicalCode = normalizeCode(saved.getCode());
                productsByCanonicalCode.putIfAbsent(savedCanonicalCode, saved);
                if (!savedCanonicalCode.isBlank()) {
                    productsByCanonicalCodeGroup.computeIfAbsent(savedCanonicalCode, k -> new ArrayList<>()).add(saved);
                }
                if (saved.getSearchKey() != null && !saved.getSearchKey().isBlank()) {
                    productsBySearchKey.putIfAbsent(saved.getSearchKey().trim().toLowerCase(), saved);
                }

                if (stock != null) {
                    List<Product> siblings = productsByCanonicalCodeGroup.getOrDefault(savedCanonicalCode, List.of());
                    for (Product sibling : siblings) {
                        if (Objects.equals(sibling.getId(), saved.getId())) continue;
                        sibling.setStockQuantity(saved.getStockQuantity());
                        if (saved.getWarehouseStock() != null) sibling.setWarehouseStock(saved.getWarehouseStock());
                        if (saved.getBarcode() != null && !saved.getBarcode().isBlank() && (sibling.getBarcode() == null || sibling.getBarcode().isBlank())) {
                            sibling.setBarcode(saved.getBarcode());
                        }
                        productRepository.save(sibling);
                    }
                }

                updated++;
            }
        }

        log.info("1C two-file import store {}: updated={}, notFound={}, nameChanges={}",
                storeId, updated, notFound.size(), nameChanges.size());

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("updated", updated);
        result.put("notFound", notFound);
        result.put("nameChanges", nameChanges);
        return result;
    }

    private Map<String, StockRow> parseStockFile(MultipartFile stockFile) {
        Map<String, StockRow> stockMap = new LinkedHashMap<>();
        try (Workbook wb = WorkbookFactory.create(stockFile.getInputStream())) {
            Sheet sheet = wb.getSheetAt(0);
            Map<Integer, String> warehouseCols = new LinkedHashMap<>();
            Row headerRow = sheet.getRow(6);
            if (headerRow != null) {
                for (int c = 12; c <= headerRow.getLastCellNum(); c++) {
                    String hdr = getCellStr(headerRow.getCell(c));
                    if (!hdr.isBlank() && !hdr.equalsIgnoreCase("Итого")) {
                        warehouseCols.put(c, hdr);
                    }
                }
            }
            for (Row row : sheet) {
                int rowIdx = row.getRowNum();
                if (rowIdx < 8) continue;
                String barcode = getCellStr(row.getCell(0));
                String code = getCellStr(row.getCell(4));
                String icName = getCellStr(row.getCell(6));
                String qtyStr = getCellStr(row.getCell(11));
                if (code.isBlank() && barcode.isBlank()) continue;
                int qty = 0;
                try {
                    qty = (int) Double.parseDouble(qtyStr);
                } catch (Exception ignored) {
                }
                Map<String, Integer> whStock = new LinkedHashMap<>();
                for (Map.Entry<Integer, String> wh : warehouseCols.entrySet()) {
                    String qStr = getCellStr(row.getCell(wh.getKey()));
                    int wQty = 0;
                    try {
                        wQty = (int) Double.parseDouble(qStr);
                    } catch (Exception ignored) {
                    }
                    whStock.put(wh.getValue(), wQty);
                }
                if (!code.isBlank()) {
                    stockMap.put(code.trim(), new StockRow(barcode.trim(), normalizeName(icName), qty, whStock.isEmpty() ? null : whStock));
                }
            }
            return stockMap;
        } catch (Exception e) {
            throw new BusinessException("INVALID_IMPORT_FILE", "Не удалось прочитать stockFile. Проверьте формат и структуру файла.");
        }
    }

    private Map<String, PriceRow> parsePriceFile(MultipartFile priceFile) {
        Map<String, PriceRow> priceMap = new LinkedHashMap<>();
        try (Workbook wb = WorkbookFactory.create(priceFile.getInputStream())) {
            Sheet sheet = wb.getSheetAt(0);
            for (Row row : sheet) {
                int rowIdx = row.getRowNum();
                if (rowIdx < 2) continue;
                String code = getCellStr(row.getCell(1));
                String icName = getCellStr(row.getCell(6));
                String priceStr = getCellStr(row.getCell(10));
                if (code.isBlank()) continue;
                long price = 0;
                try {
                    price = (long) Double.parseDouble(priceStr);
                } catch (Exception ignored) {
                }
                priceMap.put(code.trim(), new PriceRow(normalizeName(icName), price));
            }
            return priceMap;
        } catch (Exception e) {
            throw new BusinessException("INVALID_IMPORT_FILE", "Не удалось прочитать priceFile. Проверьте формат и структуру файла.");
        }
    }

    private String normalizeName(String s) {
        if (s == null) return "";
        String cleaned = s.trim().replaceAll("\\s*\\(\\d+\\)\\s*$", "").trim();
        if (cleaned.isBlank()) return "";
        return ProductNameNormalizer.normalize(cleaned);
    }

    private String toSearchKey(String name) {
        if (name == null || name.isBlank()) return "";
        return ProductNameNormalizer.normalize(name).replaceAll("\\s+", "").toLowerCase();
    }

    private String normalizeCode(String code) {
        if (code == null) return "";
        String v = code.trim().toUpperCase().replaceAll("[^A-Z0-9]", "");
        if (v.matches("^[A-Z]\\d+$")) {
            return v.substring(1);
        }
        return v;
    }

    private void validateImportFile(MultipartFile file, Set<String> allowedExtensions, String fieldName) {
        if (file == null || file.isEmpty()) {
            throw new BusinessException("MISSING_FIELD", "Файл " + fieldName + " пустой или не передан");
        }
        String originalName = file.getOriginalFilename();
        if (originalName == null || !originalName.contains(".")) {
            throw new BusinessException("INVALID_IMPORT_FILE", "Файл " + fieldName + " должен иметь расширение .xls или .xlsx");
        }
        String ext = originalName.substring(originalName.lastIndexOf('.') + 1).toLowerCase();
        if (!allowedExtensions.contains(ext)) {
            throw new BusinessException("INVALID_IMPORT_FILE", "Неверный формат " + fieldName + ": разрешены только .xls и .xlsx");
        }
    }

    private String getCellStr(org.apache.poi.ss.usermodel.Cell cell) {
        if (cell == null) return "";
        return switch (cell.getCellType()) {
            case STRING -> cell.getStringCellValue().trim();
            case NUMERIC -> String.valueOf((long) cell.getNumericCellValue());
            default -> "";
        };
    }

    private record StockRow(String barcode, String icName, int qty, Map<String, Integer> warehouseStock) {}

    private record PriceRow(String icName, long price) {}
}
