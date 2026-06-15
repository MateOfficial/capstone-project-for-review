package com.storeflow.hr.controller;

import com.storeflow.auth.security.PlatformUserDetails;
import com.storeflow.common.dto.ApiResponse;
import com.storeflow.hr.dto.*;
import com.storeflow.hr.service.HrService;
import com.storeflow.store.service.StoreResolver;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;

@Tag(name = "HR", description = "Employee, attendance, and schedule management")
@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class HrController {

    private final HrService hrService;
    private final StoreResolver storeResolver;

    // ===================== PUBLIC EMPLOYEE ENDPOINTS =====================

    @Operation(summary = "Employee check-in (public)")
    @PostMapping("/employee/checkin")
    public ResponseEntity<ApiResponse<AttendanceDto>> checkIn(
            @RequestParam(required = false) Long storeId,
            @RequestBody CheckInRequest request,
            HttpServletRequest httpRequest) {
        return ResponseEntity.ok(ApiResponse.ok(
                hrService.checkIn(storeResolver.resolveStoreId(storeId), request.getEmployeeId(), httpRequest.getRemoteAddr())));
    }

    @Operation(summary = "List active employees (public)")
    @GetMapping("/employee/list")
    public ResponseEntity<ApiResponse<List<EmployeeDto>>> listActiveEmployees(
            @RequestParam(required = false) Long storeId) {
        return ResponseEntity.ok(ApiResponse.ok(hrService.listActiveEmployees(storeResolver.resolveStoreId(storeId))));
    }

    @Operation(summary = "Today's check-ins (public)")
    @GetMapping("/employee/checkins/today")
    public ResponseEntity<ApiResponse<List<AttendanceDto>>> todayCheckins(
            @RequestParam(required = false) Long storeId) {
        return ResponseEntity.ok(ApiResponse.ok(hrService.getTodayCheckins(storeResolver.resolveStoreId(storeId))));
    }

    @Operation(summary = "Get schedule for month (public)")
    @GetMapping("/employee/schedule/{year}/{month}")
    public ResponseEntity<ApiResponse<List<ScheduleDto>>> publicSchedule(
            @RequestParam(required = false) Long storeId,
            @PathVariable int year,
            @PathVariable int month) {
        return ResponseEntity.ok(ApiResponse.ok(hrService.getSchedules(storeResolver.resolveStoreId(storeId), year, month)));
    }

    // ===================== ADMIN HR ENDPOINTS =====================

    @Operation(summary = "List all employees")
    @GetMapping("/admin/hr/employees")
    @PreAuthorize("hasAuthority('hr.view')")
    public ResponseEntity<ApiResponse<List<EmployeeDto>>> listEmployees(
            @AuthenticationPrincipal PlatformUserDetails user) {
        return ResponseEntity.ok(ApiResponse.ok(hrService.listEmployees(user.getStoreId())));
    }

    @Operation(summary = "Create employee")
    @PostMapping("/admin/hr/employees")
    @PreAuthorize("hasAuthority('hr.manage')")
    public ResponseEntity<ApiResponse<EmployeeDto>> createEmployee(
            @AuthenticationPrincipal PlatformUserDetails user,
            @Valid @RequestBody EmployeeRequest request) {
        return ResponseEntity.ok(ApiResponse.ok(hrService.createEmployee(user.getStoreId(), request)));
    }

    @Operation(summary = "Delete employee")
    @DeleteMapping("/admin/hr/employees/{id}")
    @PreAuthorize("hasAuthority('hr.manage')")
    public ResponseEntity<ApiResponse<Void>> deleteEmployee(
            @AuthenticationPrincipal PlatformUserDetails user,
            @PathVariable Long id) {
        hrService.deleteEmployee(user.getStoreId(), id);
        return ResponseEntity.ok(ApiResponse.ok(null, "Employee deactivated"));
    }

    @Operation(summary = "Get attendance records")
    @GetMapping("/admin/hr/attendance")
    @PreAuthorize("hasAuthority('hr.view')")
    public ResponseEntity<ApiResponse<List<AttendanceDto>>> getAttendance(
            @AuthenticationPrincipal PlatformUserDetails user,
            @RequestParam(required = false) LocalDate from,
            @RequestParam(required = false) LocalDate to) {
        if (from == null) from = LocalDate.now().minusDays(30);
        if (to == null) to = LocalDate.now();
        return ResponseEntity.ok(ApiResponse.ok(hrService.getAttendance(user.getStoreId(), from, to)));
    }

    @Operation(summary = "Get schedules for month")
    @GetMapping("/admin/hr/schedules/{year}/{month}")
    @PreAuthorize("hasAuthority('hr.view')")
    public ResponseEntity<ApiResponse<List<ScheduleDto>>> getSchedules(
            @AuthenticationPrincipal PlatformUserDetails user,
            @PathVariable int year,
            @PathVariable int month) {
        return ResponseEntity.ok(ApiResponse.ok(hrService.getSchedules(user.getStoreId(), year, month)));
    }

    @Operation(summary = "Assign schedule")
    @PostMapping("/admin/hr/schedules/assign")
    @PreAuthorize("hasAuthority('hr.manage')")
    public ResponseEntity<ApiResponse<List<ScheduleDto>>> assignSchedule(
            @AuthenticationPrincipal PlatformUserDetails user,
            @Valid @RequestBody ScheduleAssignRequest request) {
        return ResponseEntity.ok(ApiResponse.ok(hrService.assignSchedule(user.getStoreId(), request)));
    }

    @Operation(summary = "Copy schedule to next month")
    @PostMapping("/admin/hr/schedules/copy-next/{employeeId}")
    @PreAuthorize("hasAuthority('hr.manage')")
    public ResponseEntity<ApiResponse<List<ScheduleDto>>> copyNext(
            @AuthenticationPrincipal PlatformUserDetails user,
            @PathVariable Long employeeId) {
        return ResponseEntity.ok(ApiResponse.ok(
                hrService.copyScheduleToNextMonth(user.getStoreId(), employeeId)));
    }

    @Operation(summary = "Delete schedule entry")
    @DeleteMapping("/admin/hr/schedules/{id}")
    @PreAuthorize("hasAuthority('hr.manage')")
    public ResponseEntity<ApiResponse<Void>> deleteSchedule(
            @AuthenticationPrincipal PlatformUserDetails user,
            @PathVariable Long id) {
        hrService.deleteSchedule(user.getStoreId(), id);
        return ResponseEntity.ok(ApiResponse.ok(null, "Schedule entry deleted"));
    }
}
