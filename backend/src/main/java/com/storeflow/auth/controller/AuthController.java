package com.storeflow.auth.controller;

import com.storeflow.auth.dto.*;
import com.storeflow.auth.security.PlatformUserDetails;
import com.storeflow.auth.service.AuthService;
import com.storeflow.common.dto.ApiResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@Tag(name = "Authentication", description = "Auth and user management")
@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;

    @Operation(summary = "Login")
    @PostMapping("/auth/login")
    public ResponseEntity<ApiResponse<AuthResponse>> login(@Valid @RequestBody LoginRequest request) {
        return ResponseEntity.ok(ApiResponse.ok(authService.login(request)));
    }

    @Operation(summary = "Refresh token")
    @PostMapping("/auth/refresh")
    public ResponseEntity<ApiResponse<AuthResponse>> refresh(@Valid @RequestBody RefreshTokenRequest request) {
        return ResponseEntity.ok(ApiResponse.ok(authService.refreshToken(request.getRefreshToken())));
    }

    @Operation(summary = "Verify current token")
    @GetMapping("/auth/verify")
    public ResponseEntity<ApiResponse<AuthResponse.UserInfo>> verify(
            @AuthenticationPrincipal PlatformUserDetails user) {
        return ResponseEntity.ok(ApiResponse.ok(authService.verifyToken(user.getUserId())));
    }

    @Operation(summary = "Change own password")
    @PostMapping("/auth/change-password")
    public ResponseEntity<ApiResponse<Void>> changePassword(
            @AuthenticationPrincipal PlatformUserDetails user,
            @Valid @RequestBody ChangePasswordRequest request) {
        authService.changePassword(user.getUserId(), request);
        return ResponseEntity.ok(ApiResponse.ok(null, "Password changed successfully"));
    }

    @Operation(summary = "List all users")
    @GetMapping("/admin/users")
    @PreAuthorize("hasAuthority('admin.users')")
    public ResponseEntity<ApiResponse<List<UserDto>>> listUsers(
            @AuthenticationPrincipal PlatformUserDetails user) {
        return ResponseEntity.ok(ApiResponse.ok(authService.listUsers(user.getStoreId())));
    }

    @Operation(summary = "Create user")
    @PostMapping("/admin/users")
    @PreAuthorize("hasAuthority('admin.users')")
    public ResponseEntity<ApiResponse<UserDto>> createUser(
            @AuthenticationPrincipal PlatformUserDetails user,
            @Valid @RequestBody CreateUserRequest request) {
        return ResponseEntity.ok(ApiResponse.ok(
                authService.createUser(user.getStoreId(), request, user.getUserId())));
    }

    @Operation(summary = "Update user")
    @PutMapping("/admin/users/{id}")
    @PreAuthorize("hasAuthority('admin.users')")
    public ResponseEntity<ApiResponse<UserDto>> updateUser(
            @AuthenticationPrincipal PlatformUserDetails user,
            @PathVariable Long id,
            @Valid @RequestBody UpdateUserRequest request) {
        return ResponseEntity.ok(ApiResponse.ok(
                authService.updateUser(user.getStoreId(), id, request)));
    }

    @Operation(summary = "Delete user")
    @DeleteMapping("/admin/users/{id}")
    @PreAuthorize("hasAuthority('admin.users')")
    public ResponseEntity<ApiResponse<Void>> deleteUser(
            @AuthenticationPrincipal PlatformUserDetails user,
            @PathVariable Long id) {
        authService.deleteUser(user.getStoreId(), id);
        return ResponseEntity.ok(ApiResponse.ok(null, "User deleted"));
    }
}
