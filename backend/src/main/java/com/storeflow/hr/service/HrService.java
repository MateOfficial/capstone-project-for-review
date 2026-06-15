package com.storeflow.hr.service;

import com.storeflow.common.exception.BusinessException;
import com.storeflow.common.exception.ResourceNotFoundException;
import com.storeflow.hr.dto.*;
import com.storeflow.hr.entity.AttendanceRecord;
import com.storeflow.hr.entity.Employee;
import com.storeflow.hr.entity.Schedule;
import com.storeflow.hr.repository.AttendanceRepository;
import com.storeflow.hr.repository.EmployeeRepository;
import com.storeflow.hr.repository.ScheduleRepository;
import com.storeflow.store.entity.Store;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.*;
import java.time.temporal.ChronoUnit;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class HrService {

    private final EmployeeRepository employeeRepository;
    private final AttendanceRepository attendanceRepository;
    private final ScheduleRepository scheduleRepository;

    // ===================== EMPLOYEES =====================

    @Transactional(readOnly = true)
    public List<EmployeeDto> listEmployees(Long storeId) {
        return employeeRepository.findAllByStoreIdAndActiveTrue(storeId).stream()
                .map(this::toEmployeeDto)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<EmployeeDto> listActiveEmployees(Long storeId) {
        return employeeRepository.findAllByStoreIdAndActiveTrue(storeId).stream()
                .map(this::toEmployeeDto)
                .collect(Collectors.toList());
    }

    @Transactional
    public EmployeeDto createEmployee(Long storeId, EmployeeRequest request) {
        Store store = new Store();
        store.setId(storeId);

        Employee employee = Employee.builder()
                .store(store)
                .name(request.getName())
                .phone(request.getPhone())
                .position(request.getPosition())
                .hireDate(request.getHireDate())
                .email(request.getEmail())
                .emergencyContact(request.getEmergencyContact())
                .hrNotes(request.getHrNotes())
                .active(true)
                .build();

        employee = employeeRepository.save(employee);
        log.info("Created employee: {} for store: {}", employee.getName(), storeId);
        return toEmployeeDto(employee);
    }

    @Transactional
    public void deleteEmployee(Long storeId, Long employeeId) {
        Employee employee = employeeRepository.findByIdAndStoreId(employeeId, storeId)
                .orElseThrow(() -> new ResourceNotFoundException("Employee", employeeId));
        employee.setActive(false);
        employeeRepository.save(employee);
    }

    // ===================== ATTENDANCE =====================

    @Transactional
    public AttendanceDto checkIn(Long storeId, Long employeeId, String ipAddress) {
        Employee employee = employeeRepository.findByIdAndStoreId(employeeId, storeId)
                .orElseThrow(() -> new ResourceNotFoundException("Employee", employeeId));

        // Enforce strict daily flow: one check-in and one check-out only.
        ZoneId zone = ZoneId.of("Asia/Tashkent");
        LocalDate today = LocalDate.now(zone);
        Instant startOfDay = today.atStartOfDay(zone).toInstant();
        Instant endOfDay = today.plusDays(1).atStartOfDay(zone).toInstant();

        List<AttendanceRecord> todayRecords = attendanceRepository
                .findByEmployeeAndDateRange(employeeId, startOfDay, endOfDay);

        boolean hasCheckIn = todayRecords.stream().anyMatch(r -> "check-in".equals(r.getType()));
        boolean hasCheckOut = todayRecords.stream().anyMatch(r -> "check-out".equals(r.getType()));

        String nextType;
        if (!hasCheckIn) {
            nextType = "check-in";
        } else if (!hasCheckOut) {
            nextType = "check-out";
        } else {
            throw new BusinessException("DAY_ATTENDANCE_COMPLETED", "Приход и уход уже отмечены за сегодня");
        }

        Store store = new Store();
        store.setId(storeId);

        AttendanceRecord record = AttendanceRecord.builder()
                .store(store)
                .employee(employee)
                .employeeName(employee.getName())
                .type(nextType)
                .ipAddress(ipAddress)
                .timestamp(Instant.now())
                .build();

        record = attendanceRepository.save(record);
            return toAttendanceDto(record, null);
    }

    @Transactional(readOnly = true)
    public List<AttendanceDto> getAttendance(Long storeId, LocalDate from, LocalDate to) {
        ZoneId zone = ZoneId.of("Asia/Tashkent");
        Instant fromInstant = from.atStartOfDay(zone).toInstant();
        Instant toInstant = to.plusDays(1).atStartOfDay(zone).toInstant();

        List<AttendanceRecord> records = attendanceRepository.findByStoreIdAndDateRange(storeId, fromInstant, toInstant);
        Map<String, Instant> dayCheckIn = new HashMap<>();
        Map<String, Instant> dayCheckOut = new HashMap<>();

        for (AttendanceRecord r : records) {
            String key = buildWorkKey(r.getEmployee().getId(), r.getTimestamp(), zone);
            if ("check-in".equals(r.getType())) {
                dayCheckIn.merge(key, r.getTimestamp(), (oldVal, newVal) -> oldVal.isBefore(newVal) ? oldVal : newVal);
            } else if ("check-out".equals(r.getType())) {
                dayCheckOut.merge(key, r.getTimestamp(), (oldVal, newVal) -> oldVal.isAfter(newVal) ? oldVal : newVal);
            }
        }

        Map<String, Long> workedMinutesByDay = new HashMap<>();
        for (Map.Entry<String, Instant> e : dayCheckIn.entrySet()) {
            Instant checkIn = e.getValue();
            Instant checkOut = dayCheckOut.get(e.getKey());
            if (checkOut != null && checkOut.isAfter(checkIn)) {
                workedMinutesByDay.put(e.getKey(), ChronoUnit.MINUTES.between(checkIn, checkOut));
            }
        }

        return records.stream()
                .map(a -> toAttendanceDto(a, workedMinutesByDay.get(buildWorkKey(a.getEmployee().getId(), a.getTimestamp(), zone))))
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<AttendanceDto> getTodayCheckins(Long storeId) {
        ZoneId zone = ZoneId.of("Asia/Tashkent");
        LocalDate today = LocalDate.now(zone);
        return getAttendance(storeId, today, today);
    }

    // ===================== SCHEDULES =====================

    @Transactional(readOnly = true)
    public List<ScheduleDto> getSchedules(Long storeId, int year, int month) {
        LocalDate from = LocalDate.of(year, month, 1);
        LocalDate to = from.withDayOfMonth(from.lengthOfMonth());

        return scheduleRepository.findByStoreIdAndDateRange(storeId, from, to).stream()
                .map(this::toScheduleDto)
                .collect(Collectors.toList());
    }

    @Transactional
    public List<ScheduleDto> assignSchedule(Long storeId, ScheduleAssignRequest request) {
        Employee employee = employeeRepository.findByIdAndStoreId(request.getEmployeeId(), storeId)
                .orElseThrow(() -> new ResourceNotFoundException("Employee", request.getEmployeeId()));

        Store store = new Store();
        store.setId(storeId);

        List<Schedule> schedules = request.getDates().stream().map(date -> {
            // Remove existing schedule for this date
            scheduleRepository.findByEmployeeAndDate(employee.getId(), date)
                    .forEach(scheduleRepository::delete);

            return Schedule.builder()
                    .store(store)
                    .employee(employee)
                    .date(date)
                    .type(request.getType())
                    .build();
        }).collect(Collectors.toList());

        schedules = scheduleRepository.saveAll(schedules);

        return schedules.stream().map(this::toScheduleDto).collect(Collectors.toList());
    }

    @Transactional
    public void deleteSchedule(Long storeId, Long scheduleId) {
        scheduleRepository.deleteByIdAndStoreId(scheduleId, storeId);
    }

    @Transactional
    public List<ScheduleDto> copyScheduleToNextMonth(Long storeId, Long employeeId) {
        ZoneId zone = ZoneId.of("Asia/Tashkent");
        LocalDate today = LocalDate.now(zone);
        LocalDate currentMonthStart = today.withDayOfMonth(1);
        LocalDate currentMonthEnd = today.withDayOfMonth(today.lengthOfMonth());

        List<Schedule> currentSchedules = scheduleRepository
                .findByStoreIdAndDateRange(storeId, currentMonthStart, currentMonthEnd).stream()
                .filter(s -> s.getEmployee().getId().equals(employeeId))
                .filter(s -> "dayoff-stable".equals(s.getType()))
                .toList();

        LocalDate nextMonthStart = currentMonthStart.plusMonths(1);
        Store store = new Store();
        store.setId(storeId);

        Employee employee = employeeRepository.findByIdAndStoreId(employeeId, storeId)
                .orElseThrow(() -> new ResourceNotFoundException("Employee", employeeId));

        List<Schedule> newSchedules = currentSchedules.stream().map(s -> {
            // Find same day-of-week in next month
            DayOfWeek dow = s.getDate().getDayOfWeek();
            int weekOfMonth = (s.getDate().getDayOfMonth() - 1) / 7;
            LocalDate nextDate = nextMonthStart.with(java.time.temporal.TemporalAdjusters.dayOfWeekInMonth(
                    weekOfMonth + 1, dow));
            if (nextDate.getMonth() != nextMonthStart.getMonth()) return null;

            return Schedule.builder()
                    .store(store)
                    .employee(employee)
                    .date(nextDate)
                    .type(s.getType())
                    .build();
        }).filter(java.util.Objects::nonNull).collect(Collectors.toList());

        newSchedules = scheduleRepository.saveAll(newSchedules);
        return newSchedules.stream().map(this::toScheduleDto).collect(Collectors.toList());
    }

    // ===================== MAPPERS =====================

    private EmployeeDto toEmployeeDto(Employee e) {
        return EmployeeDto.builder()
                .id(e.getId())
                .name(e.getName())
                .phone(e.getPhone())
                .position(e.getPosition())
                .hireDate(e.getHireDate())
                .email(e.getEmail())
                .emergencyContact(e.getEmergencyContact())
                .hrNotes(e.getHrNotes())
                .active(e.getActive())
                .createdAt(e.getCreatedAt())
                .build();
    }

    private AttendanceDto toAttendanceDto(AttendanceRecord a, Long workedMinutes) {
        return AttendanceDto.builder()
                .id(a.getId())
                .employeeId(a.getEmployee().getId())
                .employeeName(a.getEmployeeName())
                .type(a.getType())
                .ipAddress(a.getIpAddress())
                .timestamp(a.getTimestamp())
                .workedMinutes(workedMinutes)
                .build();
    }

    private String buildWorkKey(Long employeeId, Instant timestamp, ZoneId zone) {
        LocalDate date = timestamp.atZone(zone).toLocalDate();
        return employeeId + "_" + date;
    }

    private ScheduleDto toScheduleDto(Schedule s) {
        return ScheduleDto.builder()
                .id(s.getId())
                .employeeId(s.getEmployee().getId())
                .employeeName(s.getEmployee().getName())
                .date(s.getDate())
                .type(s.getType())
                .build();
    }
}
