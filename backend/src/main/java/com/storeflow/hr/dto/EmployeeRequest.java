package com.storeflow.hr.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

import java.time.LocalDate;

@Data
public class EmployeeRequest {
    @NotBlank(message = "Employee name is required")
    private String name;
    private String phone;
    private String position;
    private LocalDate hireDate;
    private String email;
    private String emergencyContact;
    private String hrNotes;
}
