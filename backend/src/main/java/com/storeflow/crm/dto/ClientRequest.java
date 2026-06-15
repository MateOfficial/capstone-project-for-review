package com.storeflow.crm.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class ClientRequest {
    @NotBlank(message = "Full name is required")
    private String fullName;
    private String phone;
    private String email;
    private String notes;
}
