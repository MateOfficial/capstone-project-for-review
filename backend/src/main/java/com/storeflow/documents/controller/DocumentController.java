package com.storeflow.documents.controller;

import com.storeflow.auth.security.PlatformUserDetails;
import com.storeflow.common.dto.ApiResponse;
import com.storeflow.common.dto.PageResponse;
import com.storeflow.documents.dto.*;
import com.storeflow.documents.service.DocumentService;
import com.storeflow.documents.service.PdfGenerationService;
import com.storeflow.store.service.StoreResolver;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@Tag(name = "Documents", description = "Warranty, issuance acts, and template management")
@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class DocumentController {

    private final DocumentService documentService;
    private final PdfGenerationService pdfGenerationService;
    private final StoreResolver storeResolver;

    // ===================== PUBLIC WARRANTY =====================

    @Operation(summary = "Create warranty (public)")
    @PostMapping("/public/warranties")
    public ResponseEntity<ApiResponse<WarrantyDto>> publicCreateWarranty(
            @RequestParam(required = false) Long storeId,
            @Valid @RequestBody WarrantyRequest request,
            HttpServletRequest httpRequest) {
        return ResponseEntity.ok(ApiResponse.ok(
                documentService.createWarranty(storeResolver.resolveStoreId(storeId), request, httpRequest.getRemoteAddr())));
    }

    @Operation(summary = "Create issuance act (public)")
    @PostMapping("/public/issuances")
    public ResponseEntity<ApiResponse<IssuanceActDto>> publicCreateIssuance(
            @RequestParam(required = false) Long storeId,
            @Valid @RequestBody IssuanceActRequest request,
            HttpServletRequest httpRequest) {
        return ResponseEntity.ok(ApiResponse.ok(
                documentService.createIssuanceAct(storeResolver.resolveStoreId(storeId), request, httpRequest.getRemoteAddr())));
    }

    @Operation(summary = "List active warranty rules (public)")
    @GetMapping("/public/warranty-rules")
    public ResponseEntity<ApiResponse<List<WarrantyRuleDto>>> publicListWarrantyRules(
            @RequestParam(required = false) Long storeId) {
        return ResponseEntity.ok(ApiResponse.ok(
                documentService.listActiveWarrantyRules(storeResolver.resolveStoreId(storeId))));
    }

    @Operation(summary = "Get active published template (public)")
    @GetMapping("/public/templates/active")
    public ResponseEntity<ApiResponse<DocumentTemplateDto>> publicGetActiveTemplate(
            @RequestParam(required = false) Long storeId,
            @RequestParam String type) {
        return ResponseEntity.ok(ApiResponse.ok(
                documentService.getPublishedTemplate(storeResolver.resolveStoreId(storeId), type)));
    }

    // ===================== ADMIN WARRANTIES =====================

    @Operation(summary = "List warranties")
    @GetMapping("/admin/warranties")
    @PreAuthorize("hasAuthority('documents.view')")
    public ResponseEntity<ApiResponse<PageResponse<WarrantyDto>>> listWarranties(
            @AuthenticationPrincipal PlatformUserDetails user,
            @RequestParam(required = false) String q,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size) {
        Page<WarrantyDto> result = q != null
                ? documentService.searchWarranties(user.getStoreId(), q, PageRequest.of(page, size))
                : documentService.listWarranties(user.getStoreId(), PageRequest.of(page, size));
        return ResponseEntity.ok(ApiResponse.ok(PageResponse.<WarrantyDto>builder()
                .content(result.getContent()).page(result.getNumber())
                .size(result.getSize()).totalElements(result.getTotalElements())
                .totalPages(result.getTotalPages()).last(result.isLast()).build()));
    }

    @Operation(summary = "Create warranty (admin)")
    @PostMapping("/admin/warranties")
    @PreAuthorize("hasAuthority('documents.manage')")
    public ResponseEntity<ApiResponse<WarrantyDto>> createWarranty(
            @AuthenticationPrincipal PlatformUserDetails user,
            @Valid @RequestBody WarrantyRequest request,
            HttpServletRequest httpRequest) {
        return ResponseEntity.ok(ApiResponse.ok(
                documentService.createWarranty(user.getStoreId(), request, httpRequest.getRemoteAddr())));
    }

    @Operation(summary = "Delete warranty")
    @DeleteMapping("/admin/warranties/{id}")
    @PreAuthorize("hasAuthority('documents.manage')")
    public ResponseEntity<ApiResponse<Void>> deleteWarranty(
            @AuthenticationPrincipal PlatformUserDetails user,
            @PathVariable Long id) {
        documentService.deleteWarranty(user.getStoreId(), id);
        return ResponseEntity.ok(ApiResponse.ok(null, "Warranty deleted"));
    }

    // ===================== WARRANTY RULES =====================

    @Operation(summary = "List warranty rules")
    @GetMapping("/admin/warranty-rules")
    @PreAuthorize("hasAuthority('settings.view')")
    public ResponseEntity<ApiResponse<List<WarrantyRuleDto>>> listRules(
            @AuthenticationPrincipal PlatformUserDetails user) {
        return ResponseEntity.ok(ApiResponse.ok(documentService.listWarrantyRules(user.getStoreId())));
    }

    @Operation(summary = "Save warranty rule")
    @PostMapping("/admin/warranty-rules")
    @PreAuthorize("hasAuthority('settings.manage')")
    public ResponseEntity<ApiResponse<WarrantyRuleDto>> saveRule(
            @AuthenticationPrincipal PlatformUserDetails user,
            @Valid @RequestBody WarrantyRuleDto dto) {
        return ResponseEntity.ok(ApiResponse.ok(documentService.saveWarrantyRule(user.getStoreId(), dto)));
    }

    // ===================== ISSUANCE ACTS =====================

    @Operation(summary = "List issuance acts")
    @GetMapping("/admin/issuances")
    @PreAuthorize("hasAuthority('documents.view')")
    public ResponseEntity<ApiResponse<PageResponse<IssuanceActDto>>> listIssuances(
            @AuthenticationPrincipal PlatformUserDetails user,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size) {
        Page<IssuanceActDto> result = documentService.listIssuanceActs(user.getStoreId(), PageRequest.of(page, size));
        return ResponseEntity.ok(ApiResponse.ok(PageResponse.<IssuanceActDto>builder()
                .content(result.getContent()).page(result.getNumber())
                .size(result.getSize()).totalElements(result.getTotalElements())
                .totalPages(result.getTotalPages()).last(result.isLast()).build()));
    }

    @Operation(summary = "Delete issuance act")
    @DeleteMapping("/admin/issuances/{id}")
    @PreAuthorize("hasAuthority('documents.manage')")
    public ResponseEntity<ApiResponse<Void>> deleteIssuance(
            @AuthenticationPrincipal PlatformUserDetails user,
            @PathVariable Long id) {
        documentService.deleteIssuanceAct(user.getStoreId(), id);
        return ResponseEntity.ok(ApiResponse.ok(null, "Issuance act deleted"));
    }

    @Operation(summary = "Create issuance act (admin)")
    @PostMapping("/admin/issuances")
    @PreAuthorize("hasAuthority('documents.manage')")
    public ResponseEntity<ApiResponse<IssuanceActDto>> createIssuance(
            @AuthenticationPrincipal PlatformUserDetails user,
            @Valid @RequestBody IssuanceActRequest request,
            HttpServletRequest httpRequest) {
        return ResponseEntity.ok(ApiResponse.ok(
                documentService.createIssuanceAct(user.getStoreId(), request, httpRequest.getRemoteAddr())));
    }

    // ===================== TEMPLATES =====================

    @Operation(summary = "List templates by type")
    @GetMapping("/admin/templates")
    @PreAuthorize("hasAuthority('documents.templates')")
    public ResponseEntity<ApiResponse<List<DocumentTemplateDto>>> listTemplates(
            @AuthenticationPrincipal PlatformUserDetails user,
            @RequestParam String type) {
        return ResponseEntity.ok(ApiResponse.ok(documentService.listTemplates(user.getStoreId(), type)));
    }

    @Operation(summary = "Save template (create or update)")
    @PostMapping("/admin/templates")
    @PreAuthorize("hasAuthority('documents.templates')")
    public ResponseEntity<ApiResponse<DocumentTemplateDto>> saveTemplate(
            @AuthenticationPrincipal PlatformUserDetails user,
            @Valid @RequestBody DocumentTemplateDto dto) {
        return ResponseEntity.ok(ApiResponse.ok(documentService.saveTemplate(user.getStoreId(), dto)));
    }

    @Operation(summary = "Publish template")
    @PostMapping("/admin/templates/{id}/publish")
    @PreAuthorize("hasAuthority('documents.templates')")
    public ResponseEntity<ApiResponse<DocumentTemplateDto>> publishTemplate(
            @AuthenticationPrincipal PlatformUserDetails user,
            @PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.ok(documentService.publishTemplate(user.getStoreId(), id)));
    }

    // ===================== PDF GENERATION =====================

    @Operation(summary = "Download warranty card PDF")
    @GetMapping("/admin/warranties/{id}/pdf")
    @PreAuthorize("hasAuthority('documents.view')")
    public ResponseEntity<byte[]> downloadWarrantyPdf(
            @AuthenticationPrincipal PlatformUserDetails user,
            @PathVariable Long id) {
        byte[] pdf = pdfGenerationService.generateWarrantyCard(user.getStoreId(), id);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=warranty-" + id + ".pdf")
                .contentType(MediaType.APPLICATION_PDF)
                .body(pdf);
    }

    @Operation(summary = "Download issuance act PDF")
    @GetMapping("/admin/issuances/{id}/pdf")
    @PreAuthorize("hasAuthority('documents.view')")
    public ResponseEntity<byte[]> downloadIssuancePdf(
            @AuthenticationPrincipal PlatformUserDetails user,
            @PathVariable Long id) {
        byte[] pdf = pdfGenerationService.generateIssuanceAct(user.getStoreId(), id);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=act-" + id + ".pdf")
                .contentType(MediaType.APPLICATION_PDF)
                .body(pdf);
    }
}
