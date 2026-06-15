package com.storeflow.hr.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AttendanceDto {
    private Long id;
    private Long employeeId;
    private String employeeName;
    private String type;
    private String ipAddress;
    private Instant timestamp;
    private Long workedMinutes;
}
