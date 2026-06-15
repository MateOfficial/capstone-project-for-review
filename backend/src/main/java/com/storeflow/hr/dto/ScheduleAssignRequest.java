package com.storeflow.hr.dto;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.time.LocalDate;
import java.util.List;

@Data
public class ScheduleAssignRequest {
    @NotNull
    private Long employeeId;

    @NotNull
    private List<LocalDate> dates;

    @NotNull
    private String type;
}
