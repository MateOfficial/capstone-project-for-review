package com.storeflow.hr.repository;

import com.storeflow.hr.entity.Schedule;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;

@Repository
public interface ScheduleRepository extends JpaRepository<Schedule, Long> {
    List<Schedule> findAllByStoreId(Long storeId);

    @Query("SELECT s FROM Schedule s WHERE s.store.id = :storeId AND s.date BETWEEN :from AND :to AND s.employee.active = true")
    List<Schedule> findByStoreIdAndDateRange(@Param("storeId") Long storeId, @Param("from") LocalDate from, @Param("to") LocalDate to);

    @Query("SELECT s FROM Schedule s WHERE s.employee.id = :employeeId AND s.date = :date")
    List<Schedule> findByEmployeeAndDate(@Param("employeeId") Long employeeId, @Param("date") LocalDate date);

    void deleteByIdAndStoreId(Long id, Long storeId);
}
