package com.storeflow.documents.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

import java.time.LocalDate;
import java.util.List;

@Data
public class IssuanceActRequest {
    @NotBlank(message = "Model is required")
    private String model;
    private Long clientId;
    private String serialNumber;
    private String price;
    private LocalDate returnDate;
    private String clientName;
    private String clientPhone;
    private String condition;
    private List<String> completeness;
    private String notes;
    private String signatureData;
}
