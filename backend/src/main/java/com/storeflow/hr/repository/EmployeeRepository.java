package com.storeflow.hr.repository;

import com.storeflow.hr.entity.Employee;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface EmployeeRepository extends JpaRepository<Employee, Long> {
    List<Employee> findAllByStoreId(Long storeId);
    List<Employee> findAllByStoreIdAndActiveTrue(Long storeId);
    Optional<Employee> findByIdAndStoreId(Long id, Long storeId);
    Optional<Employee> findByStoreIdAndPin(Long storeId, String pin);
}
