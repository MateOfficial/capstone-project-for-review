package com.storeflow.reporting.service;

import com.storeflow.catalog.repository.ProductRepository;
import com.storeflow.crm.repository.ClientRepository;
import com.storeflow.documents.repository.WarrantyRepository;
import com.storeflow.hr.repository.AttendanceRepository;
import com.storeflow.hr.repository.EmployeeRepository;
import com.storeflow.reporting.dto.ReportSummary;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;

@Service
@RequiredArgsConstructor
public class ReportingService {

    private final ProductRepository productRepository;
    private final ClientRepository clientRepository;
    private final WarrantyRepository warrantyRepository;
    private final EmployeeRepository employeeRepository;
    private final AttendanceRepository attendanceRepository;

    @Transactional(readOnly = true)
    public ReportSummary getSummary(Long storeId) {
        ZoneId zone = ZoneId.of("Asia/Tashkent");
        LocalDate weekAgo = LocalDate.now(zone).minusDays(7);
        Instant weekAgoInstant = weekAgo.atStartOfDay(zone).toInstant();

        return ReportSummary.builder()
                .totalProducts(productRepository.countActiveByStoreId(storeId))
                .discountedProducts(productRepository.countDiscountedByStoreId(storeId))
                .totalClients(clientRepository.countByStoreId(storeId))
                .totalWarranties(warrantyRepository.countByStoreId(storeId))
                .totalEmployees(employeeRepository.findAllByStoreIdAndActiveTrue(storeId).size())
                .recentAttendance(attendanceRepository.countByStoreIdAndDateRange(
                        storeId, weekAgoInstant, Instant.now()))
                .build();
    }
}
