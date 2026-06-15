package com.storeflow.hr.repository;

import com.storeflow.hr.entity.AttendanceRecord;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;

@Repository
public interface AttendanceRepository extends JpaRepository<AttendanceRecord, Long> {
    List<AttendanceRecord> findAllByStoreIdOrderByTimestampDesc(Long storeId);

    @Query("SELECT a FROM AttendanceRecord a WHERE a.store.id = :storeId AND a.timestamp BETWEEN :from AND :to ORDER BY a.timestamp DESC")
    List<AttendanceRecord> findByStoreIdAndDateRange(@Param("storeId") Long storeId, @Param("from") Instant from, @Param("to") Instant to);

    @Query("SELECT a FROM AttendanceRecord a WHERE a.employee.id = :employeeId AND a.timestamp BETWEEN :from AND :to")
    List<AttendanceRecord> findByEmployeeAndDateRange(@Param("employeeId") Long employeeId, @Param("from") Instant from, @Param("to") Instant to);

    @Query("SELECT COUNT(a) FROM AttendanceRecord a WHERE a.store.id = :storeId AND a.timestamp BETWEEN :from AND :to")
    long countByStoreIdAndDateRange(@Param("storeId") Long storeId, @Param("from") Instant from, @Param("to") Instant to);
}
