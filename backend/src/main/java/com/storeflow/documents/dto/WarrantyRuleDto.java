package com.storeflow.documents.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class WarrantyRuleDto {
    private Long id;
    private String brand;
    private Integer durationMonths;
    private String terms;
    private Boolean active;
}
