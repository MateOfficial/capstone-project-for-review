package com.storeflow.reporting.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ReportSummary {
    private long totalProducts;
    private long totalClients;
    private long totalWarranties;
    private long totalEmployees;
    private long recentAttendance;
    private long discountedProducts;
}
