package com.storeflow.integration.repository;

import com.storeflow.integration.entity.IntegrationSettings;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;

public interface IntegrationSettingsRepository extends JpaRepository<IntegrationSettings, Long> {
    Optional<IntegrationSettings> findByStoreIdAndProvider(Long storeId, String provider);
    Optional<IntegrationSettings> findBySyncApiKey(String syncApiKey);
}
