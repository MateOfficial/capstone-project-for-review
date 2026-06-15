package com.storeflow.ai.controller;

import com.storeflow.ai.dto.AiChatRequest;
import com.storeflow.ai.dto.AiChatResponse;
import com.storeflow.ai.service.AiService;
import com.storeflow.auth.security.PlatformUserDetails;
import com.storeflow.common.dto.ApiResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.Optional;

@Tag(name = "AI Assistant", description = "OpenRouter-powered AI assistant for admin panel")
@RestController
@RequestMapping("/api/admin/ai")
@RequiredArgsConstructor
public class AiController {

    private final AiService aiService;

    @Operation(summary = "Check if AI assistant is configured")
    @GetMapping("/status")
    @PreAuthorize("hasAuthority('settings.view')")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getStatus(
            @AuthenticationPrincipal PlatformUserDetails user) {
        Optional<String> apiKey = aiService.getApiKey(user.getStoreId());
        return ResponseEntity.ok(ApiResponse.ok(Map.of("configured", apiKey.isPresent())));
    }

    @Operation(summary = "Send a message to AI assistant")
    @PostMapping("/chat")
    @PreAuthorize("hasAuthority('settings.view')")
    public ResponseEntity<ApiResponse<AiChatResponse>> chat(
            @AuthenticationPrincipal PlatformUserDetails user,
            @Valid @RequestBody AiChatRequest request) {
        try {
            String reply = aiService.chat(user.getStoreId(), request.getMessage(), request.getHistory());
            return ResponseEntity.ok(ApiResponse.ok(AiChatResponse.ok(reply)));
        } catch (IllegalStateException e) {
            // API key not configured
            return ResponseEntity.ok(ApiResponse.ok(AiChatResponse.fail("API key not configured")));
        } catch (Exception e) {
            return ResponseEntity.ok(ApiResponse.ok(AiChatResponse.fail(e.getMessage())));
        }
    }
}
