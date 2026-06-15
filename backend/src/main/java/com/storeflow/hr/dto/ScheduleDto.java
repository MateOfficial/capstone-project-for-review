package com.storeflow.hr.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ScheduleDto {
    private Long id;
    private Long employeeId;
    private String employeeName;
    private LocalDate date;
    private String type;
}
