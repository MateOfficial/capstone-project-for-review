package com.storeflow.audit.repository;

import com.storeflow.audit.entity.AuditLog;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface AuditLogRepository extends JpaRepository<AuditLog, Long> {
    Page<AuditLog> findAllByStoreIdOrderByTimestampDesc(Long storeId, Pageable pageable);
    Page<AuditLog> findAllByStoreIdAndEntityTypeOrderByTimestampDesc(Long storeId, String entityType, Pageable pageable);
}
