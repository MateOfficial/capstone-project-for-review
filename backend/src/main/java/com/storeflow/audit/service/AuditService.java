package com.storeflow.audit.service;

import com.storeflow.audit.entity.AuditLog;
import com.storeflow.audit.repository.AuditLogRepository;
import com.storeflow.store.entity.Store;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class AuditService {

    private final AuditLogRepository auditLogRepository;

    @Async
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void log(Long storeId, Long userId, String username, String action,
                    String entityType, String entityId, Map<String, Object> details, String ipAddress) {
        Store store = null;
        if (storeId != null) {
            store = new Store();
            store.setId(storeId);
        }

        AuditLog entry = AuditLog.builder()
                .store(store)
                .username(username)
                .action(action)
                .entityType(entityType)
                .entityId(entityId)
                .details(details)
                .ipAddress(ipAddress)
                .timestamp(Instant.now())
                .build();

        auditLogRepository.save(entry);
    }

    @Transactional(readOnly = true)
    public Page<AuditLog> getAuditLog(Long storeId, Pageable pageable) {
        return auditLogRepository.findAllByStoreIdOrderByTimestampDesc(storeId, pageable);
    }

    @Transactional(readOnly = true)
    public Page<AuditLog> getAuditLogByEntity(Long storeId, String entityType, Pageable pageable) {
        return auditLogRepository.findAllByStoreIdAndEntityTypeOrderByTimestampDesc(storeId, entityType, pageable);
    }
}
