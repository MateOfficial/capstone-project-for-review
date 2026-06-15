package com.storeflow.hr.dto;

import lombok.Data;

@Data
public class CheckInRequest {
    private Long employeeId;
    private String name;
}
