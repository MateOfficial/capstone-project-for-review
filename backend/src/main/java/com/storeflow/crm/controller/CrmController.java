package com.storeflow.crm.controller;

import com.storeflow.auth.security.PlatformUserDetails;
import com.storeflow.common.dto.ApiResponse;
import com.storeflow.common.dto.PageResponse;
import com.storeflow.crm.dto.ClientDto;
import com.storeflow.crm.dto.ClientHistoryDto;
import com.storeflow.crm.dto.ClientRequest;
import com.storeflow.crm.service.CrmService;
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

@Tag(name = "CRM", description = "Client management")
@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class CrmController {

    private final CrmService crmService;
    private final StoreResolver storeResolver;

    @Operation(summary = "Register client (public)")
    @PostMapping("/public/clients")
    public ResponseEntity<ApiResponse<ClientDto>> publicRegister(
            @RequestParam(required = false) Long storeId,
            @Valid @RequestBody ClientRequest request) {
        return ResponseEntity.ok(ApiResponse.ok(crmService.createClient(storeResolver.resolveStoreId(storeId), request)));
    }

    @Operation(summary = "Search clients (public — for employee document forms)")
    @GetMapping("/public/clients/search")
    public ResponseEntity<ApiResponse<PageResponse<ClientDto>>> publicSearch(
            @RequestParam(required = false) Long storeId,
            @RequestParam(required = false) String q,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "30") int size) {
        Page<ClientDto> result = (q != null && !q.isBlank())
                ? crmService.searchClients(storeResolver.resolveStoreId(storeId), q, PageRequest.of(page, size))
                : crmService.listClients(storeResolver.resolveStoreId(storeId), PageRequest.of(page, size, Sort.by("fullName")));
        return ResponseEntity.ok(ApiResponse.ok(PageResponse.<ClientDto>builder()
            .content(result.getContent()).page(result.getNumber())
            .size(result.getSize()).totalElements(result.getTotalElements())
            .totalPages(result.getTotalPages()).last(result.isLast()).build()));
    }

    @Operation(summary = "List clients")
    @GetMapping("/admin/clients")
    @PreAuthorize("hasAuthority('crm.view')")
    public ResponseEntity<ApiResponse<PageResponse<ClientDto>>> list(
            @AuthenticationPrincipal PlatformUserDetails user,
            @RequestParam(required = false) String q,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size) {
        Page<ClientDto> result = q != null
                ? crmService.searchClients(user.getStoreId(), q, PageRequest.of(page, size))
                : crmService.listClients(user.getStoreId(), PageRequest.of(page, size, Sort.by("fullName")));
        return ResponseEntity.ok(ApiResponse.ok(PageResponse.<ClientDto>builder()
                .content(result.getContent()).page(result.getNumber())
                .size(result.getSize()).totalElements(result.getTotalElements())
                .totalPages(result.getTotalPages()).last(result.isLast()).build()));
    }

    @Operation(summary = "Get client")
    @GetMapping("/admin/clients/{id}")
    @PreAuthorize("hasAuthority('crm.view')")
    public ResponseEntity<ApiResponse<ClientDto>> get(
            @AuthenticationPrincipal PlatformUserDetails user,
            @PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.ok(crmService.getClient(user.getStoreId(), id)));
    }

    @Operation(summary = "Create client")
    @PostMapping("/admin/clients")
    @PreAuthorize("hasAuthority('crm.manage')")
    public ResponseEntity<ApiResponse<ClientDto>> create(
            @AuthenticationPrincipal PlatformUserDetails user,
            @Valid @RequestBody ClientRequest request) {
        return ResponseEntity.ok(ApiResponse.ok(crmService.createClient(user.getStoreId(), request)));
    }

    @Operation(summary = "Update client")
    @PutMapping("/admin/clients/{id}")
    @PreAuthorize("hasAuthority('crm.manage')")
    public ResponseEntity<ApiResponse<ClientDto>> update(
            @AuthenticationPrincipal PlatformUserDetails user,
            @PathVariable Long id,
            @Valid @RequestBody ClientRequest request) {
        return ResponseEntity.ok(ApiResponse.ok(crmService.updateClient(user.getStoreId(), id, request)));
    }

    @Operation(summary = "Delete client")
    @DeleteMapping("/admin/clients/{id}")
    @PreAuthorize("hasAuthority('crm.manage')")
    public ResponseEntity<ApiResponse<Void>> delete(
            @AuthenticationPrincipal PlatformUserDetails user,
            @PathVariable Long id) {
        crmService.deleteClient(user.getStoreId(), id);
        return ResponseEntity.ok(ApiResponse.ok(null, "Client deleted"));
    }

    @Operation(summary = "Get client purchase history")
    @GetMapping("/admin/clients/{id}/history")
    @PreAuthorize("hasAuthority('crm.view')")
    public ResponseEntity<ApiResponse<ClientHistoryDto>> history(
            @AuthenticationPrincipal PlatformUserDetails user,
            @PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.ok(crmService.getClientHistory(user.getStoreId(), id)));
    }
}
