package com.storeflow.documents.repository;

import com.storeflow.documents.entity.WarrantyRule;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface WarrantyRuleRepository extends JpaRepository<WarrantyRule, Long> {
    List<WarrantyRule> findAllByStoreId(Long storeId);
    Optional<WarrantyRule> findByStoreIdAndBrand(Long storeId, String brand);
    List<WarrantyRule> findAllByStoreIdAndActiveTrue(Long storeId);
}
