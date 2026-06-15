package com.storeflow.documents.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class IssuanceActDto {
    private Long id;
    private String actNumber;
    private String model;
    private String serialNumber;
    private String price;
    private LocalDate returnDate;
    private Long clientId;
    private String clientName;
    private String clientPhone;
    private String condition;
    private List<String> completeness;
    private String notes;
    private String signatureData;
    private String status;
    private Instant createdAt;
}
