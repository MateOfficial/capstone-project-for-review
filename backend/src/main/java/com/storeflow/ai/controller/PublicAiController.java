package com.storeflow.ai.controller;

import com.storeflow.ai.dto.AiChatRequest;
import com.storeflow.ai.dto.AiChatResponse;
import com.storeflow.ai.service.AiService;
import com.storeflow.common.dto.ApiResponse;
import com.storeflow.store.service.StoreResolver;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * Public AI endpoint for employee-facing pages.
 * No JWT required — accessible by all employees without login.
 * Mapped under /api/employee/** which is whitelisted in SecurityConfig.
 */
@Tag(name = "Employee AI", description = "AI product assistant for employee pages (no auth required)")
@RestController
@RequestMapping("/api/employee/ai")
@RequiredArgsConstructor
public class PublicAiController {

    private final AiService aiService;
    private final StoreResolver storeResolver;

    @Operation(summary = "Check if AI assistant is configured for the store")
    @GetMapping("/status")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getStatus() {
        Long storeId = storeResolver.resolveStoreId(null);
        boolean configured = aiService.getApiKey(storeId).isPresent();
        return ResponseEntity.ok(ApiResponse.ok(Map.of("configured", configured)));
    }

    @Operation(summary = "Send a product query to the AI assistant")
    @PostMapping("/chat")
    public ResponseEntity<ApiResponse<AiChatResponse>> chat(
            @Valid @RequestBody AiChatRequest request) {
        Long storeId = storeResolver.resolveStoreId(null);
        try {
            String reply = aiService.chat(storeId, request.getMessage(), request.getHistory());
            return ResponseEntity.ok(ApiResponse.ok(AiChatResponse.ok(reply)));
        } catch (IllegalStateException e) {
            return ResponseEntity.ok(ApiResponse.ok(AiChatResponse.fail("AI ключ не настроен")));
        } catch (Exception e) {
            return ResponseEntity.ok(ApiResponse.ok(AiChatResponse.fail(e.getMessage())));
        }
    }
}
