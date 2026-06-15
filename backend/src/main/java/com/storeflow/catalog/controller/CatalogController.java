package com.storeflow.catalog.controller;

import com.storeflow.auth.security.PlatformUserDetails;
import com.storeflow.catalog.dto.*;
import com.storeflow.catalog.service.CatalogService;
import com.storeflow.common.dto.ApiResponse;
import com.storeflow.common.dto.PageResponse;
import com.storeflow.store.service.StoreResolver;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.List;

@Tag(name = "Catalog", description = "Product and category management")
@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class CatalogController {

    private final CatalogService catalogService;
    private final StoreResolver storeResolver;

    // ===================== PUBLIC ENDPOINTS =====================

    @Operation(summary = "List active products (public)")
    @GetMapping("/public/products")
    public ResponseEntity<ApiResponse<PageResponse<ProductDto>>> listProducts(
            @RequestParam(required = false) Long storeId,
                        @RequestParam(required = false) Long categoryId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size) {
                Page<ProductDto> result = catalogService.listProducts(storeResolver.resolveStoreId(storeId), categoryId,
                PageRequest.of(page, size, Sort.by("name")));
        return ResponseEntity.ok(ApiResponse.ok(toPageResponse(result)));
    }

    @Operation(summary = "Search products (public)")
    @GetMapping("/public/products/search")
    public ResponseEntity<ApiResponse<PageResponse<ProductDto>>> searchProducts(
            @RequestParam(required = false) Long storeId,
            @RequestParam String q,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size) {
        Page<ProductDto> result = catalogService.searchProducts(storeResolver.resolveStoreId(storeId), q,
                PageRequest.of(page, size));
        return ResponseEntity.ok(ApiResponse.ok(toPageResponse(result)));
    }

    @Operation(summary = "Get product by ID (public)")
    @GetMapping("/public/products/{id}")
    public ResponseEntity<ApiResponse<ProductDto>> getProduct(
            @RequestParam(required = false) Long storeId,
            @PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.ok(catalogService.getProduct(storeResolver.resolveStoreId(storeId), id)));
    }

    @Operation(summary = "List categories (public)")
    @GetMapping("/public/categories")
    public ResponseEntity<ApiResponse<List<CategoryDto>>> listCategories(
            @RequestParam(required = false) Long storeId) {
        return ResponseEntity.ok(ApiResponse.ok(catalogService.listCategories(storeResolver.resolveStoreId(storeId))));
    }

    // ===================== ADMIN ENDPOINTS =====================

    @Operation(summary = "List all products (admin)")
    @GetMapping("/admin/products")
    @PreAuthorize("hasAuthority('catalog.view')")
    public ResponseEntity<ApiResponse<PageResponse<ProductDto>>> adminListProducts(
            @AuthenticationPrincipal PlatformUserDetails user,
            @RequestParam(required = false) String search,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size) {
        Page<ProductDto> result = search != null && !search.isBlank()
                ? catalogService.searchProducts(user.getStoreId(), search, PageRequest.of(page, size))
                : catalogService.listAllProducts(user.getStoreId(), PageRequest.of(page, size, Sort.by("name")));
        return ResponseEntity.ok(ApiResponse.ok(toPageResponse(result)));
    }

    @Operation(summary = "Create product")
    @PostMapping("/admin/products")
    @PreAuthorize("hasAuthority('catalog.manage')")
    public ResponseEntity<ApiResponse<ProductDto>> createProduct(
            @AuthenticationPrincipal PlatformUserDetails user,
            @Valid @RequestBody ProductRequest request) {
        return ResponseEntity.ok(ApiResponse.ok(
                catalogService.createProduct(user.getStoreId(), request)));
    }

    @Operation(summary = "Update product")
    @PutMapping("/admin/products/{id}")
    @PreAuthorize("hasAuthority('catalog.manage')")
    public ResponseEntity<ApiResponse<ProductDto>> updateProduct(
            @AuthenticationPrincipal PlatformUserDetails user,
            @PathVariable Long id,
            @Valid @RequestBody ProductRequest request) {
        return ResponseEntity.ok(ApiResponse.ok(
                catalogService.updateProduct(user.getStoreId(), id, request)));
    }

    @Operation(summary = "Delete product")
    @DeleteMapping("/admin/products/{id}")
    @PreAuthorize("hasAuthority('catalog.manage')")
    public ResponseEntity<ApiResponse<Void>> deleteProduct(
            @AuthenticationPrincipal PlatformUserDetails user,
            @PathVariable Long id) {
        catalogService.deleteProduct(user.getStoreId(), id);
        return ResponseEntity.ok(ApiResponse.ok(null, "Product deleted"));
    }

    @Operation(summary = "Upload product image")
    @PostMapping("/admin/products/{id}/image")
    @PreAuthorize("hasAuthority('catalog.manage')")
    public ResponseEntity<ApiResponse<ProductDto>> uploadImage(
            @AuthenticationPrincipal PlatformUserDetails user,
            @PathVariable Long id,
            @RequestParam("file") MultipartFile file) throws IOException {
        return ResponseEntity.ok(ApiResponse.ok(
                catalogService.uploadImage(user.getStoreId(), id, file)));
    }

    @Operation(summary = "Import products from CSV or Excel file")
    @PostMapping("/admin/products/import")
    @PreAuthorize("hasAuthority('catalog.manage')")
    public ResponseEntity<ApiResponse<ImportResult>> importProducts(
            @AuthenticationPrincipal PlatformUserDetails user,
            @RequestParam("file") MultipartFile file) throws IOException {
        ImportResult result = catalogService.importProducts(user.getStoreId(), file);
        return ResponseEntity.ok(ApiResponse.ok(result,
                "Import complete: " + result.getImported() + " imported, " + result.getSkipped() + " skipped"));
    }

    @Operation(summary = "Get catalog stats")
    @GetMapping("/admin/catalog/stats")
    @PreAuthorize("hasAuthority('catalog.view')")
    public ResponseEntity<ApiResponse<CatalogService.CatalogStats>> getStats(
            @AuthenticationPrincipal PlatformUserDetails user) {
        return ResponseEntity.ok(ApiResponse.ok(catalogService.getStats(user.getStoreId())));
    }

    // ===================== CATEGORY ADMIN =====================

    @Operation(summary = "List categories (admin)")
    @GetMapping("/admin/categories")
    @PreAuthorize("hasAuthority('catalog.view')")
    public ResponseEntity<ApiResponse<List<CategoryDto>>> adminListCategories(
            @AuthenticationPrincipal PlatformUserDetails user) {
        return ResponseEntity.ok(ApiResponse.ok(catalogService.listCategories(user.getStoreId())));
    }

    @Operation(summary = "Create category")
    @PostMapping("/admin/categories")
    @PreAuthorize("hasAuthority('catalog.manage')")
    public ResponseEntity<ApiResponse<CategoryDto>> createCategory(
            @AuthenticationPrincipal PlatformUserDetails user,
            @Valid @RequestBody CategoryRequest request) {
        return ResponseEntity.ok(ApiResponse.ok(
                catalogService.createCategory(user.getStoreId(), request)));
    }

    @Operation(summary = "Update category")
    @PutMapping("/admin/categories/{id}")
    @PreAuthorize("hasAuthority('catalog.manage')")
    public ResponseEntity<ApiResponse<CategoryDto>> updateCategory(
            @AuthenticationPrincipal PlatformUserDetails user,
            @PathVariable Long id,
            @Valid @RequestBody CategoryRequest request) {
        return ResponseEntity.ok(ApiResponse.ok(
                catalogService.updateCategory(user.getStoreId(), id, request)));
    }

    @Operation(summary = "Delete category")
    @DeleteMapping("/admin/categories/{id}")
    @PreAuthorize("hasAuthority('catalog.manage')")
    public ResponseEntity<ApiResponse<Void>> deleteCategory(
            @AuthenticationPrincipal PlatformUserDetails user,
            @PathVariable Long id) {
        catalogService.deleteCategory(user.getStoreId(), id);
        return ResponseEntity.ok(ApiResponse.ok(null, "Category deleted"));
    }

    private <T> PageResponse<T> toPageResponse(Page<T> page) {
        return PageResponse.<T>builder()
                .content(page.getContent())
                .page(page.getNumber())
                .size(page.getSize())
                .totalElements(page.getTotalElements())
                .totalPages(page.getTotalPages())
                .last(page.isLast())
                .build();
    }
}
