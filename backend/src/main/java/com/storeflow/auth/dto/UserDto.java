package com.storeflow.auth.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.Set;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UserDto {
    private Long id;
    private String username;
    private String email;
    private String fullName;
    private Boolean active;
    private Boolean systemAccount;
    private Set<String> roles;
    private Set<String> permissions;
    private Instant lastLoginAt;
    private Instant createdAt;
}
