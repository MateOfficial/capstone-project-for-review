package com.storeflow.auth.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.util.Set;

@Data
public class CreateUserRequest {
    @NotBlank(message = "Username is required")
    @Size(min = 3, max = 100)
    private String username;

    @NotBlank(message = "Password is required")
    @Size(min = 6, max = 100)
    private String password;

    private String email;
    private String fullName;
    private Set<String> roles;
}
