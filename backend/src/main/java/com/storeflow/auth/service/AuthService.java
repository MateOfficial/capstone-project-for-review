package com.storeflow.auth.service;

import com.storeflow.auth.dto.*;
import com.storeflow.auth.entity.RefreshToken;
import com.storeflow.auth.entity.Role;
import com.storeflow.auth.entity.User;
import com.storeflow.auth.repository.RefreshTokenRepository;
import com.storeflow.auth.repository.RoleRepository;
import com.storeflow.auth.repository.UserRepository;
import com.storeflow.auth.security.JwtTokenProvider;
import com.storeflow.common.exception.BusinessException;
import com.storeflow.common.exception.DuplicateResourceException;
import com.storeflow.common.exception.ResourceNotFoundException;
import com.storeflow.store.entity.Store;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class AuthService {

    private final UserRepository userRepository;
    private final RoleRepository roleRepository;
    private final RefreshTokenRepository refreshTokenRepository;
    private final JwtTokenProvider tokenProvider;
    private final PasswordEncoder passwordEncoder;

    @Transactional
    public AuthResponse login(LoginRequest request) {
        Long storeId = request.getStoreId();

        User user;
        if (storeId == null) {
            // Single-store setup: find user by username across all stores
            user = userRepository.findByUsername(request.getUsername())
                    .orElseThrow(() -> new BadCredentialsException("Invalid credentials"));
        } else {
            user = userRepository.findByStoreIdAndUsername(storeId, request.getUsername())
                    .orElseThrow(() -> new BadCredentialsException("Invalid credentials"));
        }

        if (!user.getActive()) {
            throw new BusinessException("ACCOUNT_DISABLED", "Account is disabled");
        }

        if (!passwordEncoder.matches(request.getPassword(), user.getPasswordHash())) {
            throw new BadCredentialsException("Invalid credentials");
        }

        user.setLastLoginAt(Instant.now());
        userRepository.save(user);

        return buildAuthResponse(user);
    }

    @Transactional
    public AuthResponse refreshToken(String refreshTokenStr) {
        RefreshToken refreshToken = refreshTokenRepository.findByToken(refreshTokenStr)
                .orElseThrow(() -> new BusinessException("INVALID_TOKEN", "Invalid refresh token"));

        if (refreshToken.getExpiresAt().isBefore(Instant.now())) {
            refreshTokenRepository.delete(refreshToken);
            throw new BusinessException("TOKEN_EXPIRED", "Refresh token has expired");
        }

        User user = refreshToken.getUser();
        refreshTokenRepository.delete(refreshToken);

        return buildAuthResponse(user);
    }

    @Transactional
    public UserDto createUser(Long storeId, CreateUserRequest request, Long createdBy) {
        if (userRepository.existsByStoreIdAndUsername(storeId, request.getUsername())) {
            throw new DuplicateResourceException("User", "username", request.getUsername());
        }

        Store store = new Store();
        store.setId(storeId);

        User user = User.builder()
                .store(store)
                .username(request.getUsername())
                .passwordHash(passwordEncoder.encode(request.getPassword()))
                .email(request.getEmail())
                .fullName(request.getFullName())
                .active(true)
                .createdBy(createdBy)
                .build();

        if (request.getRoles() != null && !request.getRoles().isEmpty()) {
            Set<Role> roles = new HashSet<>();
            for (String roleCode : request.getRoles()) {
                roleRepository.findByStoreIdAndCode(storeId, roleCode)
                        .ifPresent(roles::add);
            }
            user.setRoles(roles);
        }

        user = userRepository.save(user);
        log.info("Created user: {} for store: {}", user.getUsername(), storeId);
        return toDto(user);
    }

    @Transactional
    public UserDto updateUser(Long storeId, Long userId, UpdateUserRequest request) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User", userId));

        if (!user.getStore().getId().equals(storeId)) {
            throw new ResourceNotFoundException("User", userId);
        }

        if (request.getEmail() != null) user.setEmail(request.getEmail());
        if (request.getFullName() != null) user.setFullName(request.getFullName());
        if (request.getActive() != null) user.setActive(request.getActive());

        if (request.getRoles() != null) {
            Set<Role> roles = new HashSet<>();
            for (String roleCode : request.getRoles()) {
                roleRepository.findByStoreIdAndCode(storeId, roleCode)
                        .ifPresent(roles::add);
            }
            user.setRoles(roles);
        }

        user = userRepository.save(user);
        return toDto(user);
    }

    @Transactional
    public void deleteUser(Long storeId, Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User", userId));

        if (!user.getStore().getId().equals(storeId)) {
            throw new ResourceNotFoundException("User", userId);
        }

        if (user.getSystemAccount()) {
            throw new BusinessException("SYSTEM_ACCOUNT", "Cannot delete system account");
        }

        refreshTokenRepository.deleteAllByUserId(userId);
        userRepository.delete(user);
        log.info("Deleted user: {} from store: {}", user.getUsername(), storeId);
    }

    @Transactional
    public void changePassword(Long userId, ChangePasswordRequest request) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User", userId));

        if (!passwordEncoder.matches(request.getCurrentPassword(), user.getPasswordHash())) {
            throw new BusinessException("WRONG_PASSWORD", "Current password is incorrect");
        }

        user.setPasswordHash(passwordEncoder.encode(request.getNewPassword()));
        userRepository.save(user);
    }

    @Transactional(readOnly = true)
    public List<UserDto> listUsers(Long storeId) {
        return userRepository.findAllByStoreId(storeId).stream()
                .map(this::toDto)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public AuthResponse.UserInfo verifyToken(Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User", userId));
        return AuthResponse.UserInfo.builder()
                .id(user.getId())
                .username(user.getUsername())
                .fullName(user.getFullName())
                .email(user.getEmail())
                .storeId(user.getStore().getId())
                .storeName(user.getStore().getName())
                .permissions(user.getPermissionCodes())
                .roles(user.getRoles().stream().map(Role::getCode).collect(Collectors.toSet()))
                .build();
    }

    private AuthResponse buildAuthResponse(User user) {
        String accessToken = tokenProvider.generateAccessToken(
                user.getId(), user.getUsername(), user.getStore().getId());
        String refreshTokenStr = tokenProvider.generateRefreshToken();

        RefreshToken refreshToken = RefreshToken.builder()
                .user(user)
                .token(refreshTokenStr)
                .expiresAt(Instant.now().plusMillis(tokenProvider.getRefreshTokenExpiration()))
                .build();
        refreshTokenRepository.save(refreshToken);

        return AuthResponse.builder()
                .accessToken(accessToken)
                .refreshToken(refreshTokenStr)
                .tokenType("Bearer")
                .user(AuthResponse.UserInfo.builder()
                        .id(user.getId())
                        .username(user.getUsername())
                        .fullName(user.getFullName())
                        .email(user.getEmail())
                        .storeId(user.getStore().getId())
                        .storeName(user.getStore().getName())
                        .permissions(user.getPermissionCodes())
                        .roles(user.getRoles().stream().map(Role::getCode).collect(Collectors.toSet()))
                        .build())
                .build();
    }

    private UserDto toDto(User user) {
        return UserDto.builder()
                .id(user.getId())
                .username(user.getUsername())
                .email(user.getEmail())
                .fullName(user.getFullName())
                .active(user.getActive())
                .systemAccount(user.getSystemAccount())
                .roles(user.getRoles().stream().map(Role::getCode).collect(Collectors.toSet()))
                .permissions(user.getPermissionCodes())
                .lastLoginAt(user.getLastLoginAt())
                .createdAt(user.getCreatedAt())
                .build();
    }
}
