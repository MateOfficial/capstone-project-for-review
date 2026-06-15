package com.storeflow.settings.repository;

import com.storeflow.settings.entity.ModuleConfig;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ModuleConfigRepository extends JpaRepository<ModuleConfig, Long> {
    List<ModuleConfig> findAllByStoreId(Long storeId);
    Optional<ModuleConfig> findByStoreIdAndModuleCode(Long storeId, String moduleCode);
}
