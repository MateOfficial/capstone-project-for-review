package com.storeflow.documents.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class WarrantyRequest {
    @NotBlank(message = "Model is required")
    private String model;
    private String serialNumber;
    private String brand;
    private Integer durationMonths;
    private Long clientId;
    private String clientPhone;
    private String clientName;
    private String signatureData;
}
