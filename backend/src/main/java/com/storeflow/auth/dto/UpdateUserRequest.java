package com.storeflow.auth.dto;

import lombok.Data;

import java.util.Set;

@Data
public class UpdateUserRequest {
    private String email;
    private String fullName;
    private Boolean active;
    private Set<String> roles;
}
