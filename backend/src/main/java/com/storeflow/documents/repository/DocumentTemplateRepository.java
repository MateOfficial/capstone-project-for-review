package com.storeflow.documents.repository;

import com.storeflow.documents.entity.DocumentTemplate;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface DocumentTemplateRepository extends JpaRepository<DocumentTemplate, Long> {
    List<DocumentTemplate> findAllByStoreIdAndType(Long storeId, String type);
    Optional<DocumentTemplate> findByStoreIdAndTypeAndStatus(Long storeId, String type, String status);
    Optional<DocumentTemplate> findByIdAndStoreId(Long id, Long storeId);
}
