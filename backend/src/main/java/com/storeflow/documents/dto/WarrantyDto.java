package com.storeflow.documents.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class WarrantyDto {
    private Long id;
    private String warrantyNumber;
    private String model;
    private String serialNumber;
    private String brand;
    private Integer durationMonths;
    private Long clientId;
    private String clientName;
    private String clientPhone;
    private String signatureData;
    private Instant expiresAt;
    private Instant createdAt;
}
