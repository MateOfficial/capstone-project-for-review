package com.storeflow.hr.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.time.LocalDate;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class EmployeeDto {
    private Long id;
    private String name;
    private String phone;
    private String position;
    private LocalDate hireDate;
    private String email;
    private String emergencyContact;
    private String hrNotes;
    private Boolean active;
    private Instant createdAt;
}
