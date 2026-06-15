package com.storeflow.settings.repository;

import com.storeflow.settings.entity.Setting;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface SettingRepository extends JpaRepository<Setting, Long> {
    List<Setting> findAllByStoreId(Long storeId);
    Optional<Setting> findByStoreIdAndKey(Long storeId, String key);
}
