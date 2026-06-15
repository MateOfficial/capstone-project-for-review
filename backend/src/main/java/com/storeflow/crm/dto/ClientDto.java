package com.storeflow.crm.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ClientDto {
    private Long id;
    private String fullName;
    private String phone;
    private String email;
    private String notes;
    private Instant createdAt;
    private Instant updatedAt;
}
