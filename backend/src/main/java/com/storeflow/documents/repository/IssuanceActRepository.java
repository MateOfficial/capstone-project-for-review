package com.storeflow.documents.repository;

import com.storeflow.documents.entity.IssuanceAct;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface IssuanceActRepository extends JpaRepository<IssuanceAct, Long> {
    Page<IssuanceAct> findAllByStoreIdOrderByCreatedAtDesc(Long storeId, Pageable pageable);
    Optional<IssuanceAct> findByIdAndStoreId(Long id, Long storeId);
    List<IssuanceAct> findAllByClientIdOrderByCreatedAtDesc(Long clientId);
}
