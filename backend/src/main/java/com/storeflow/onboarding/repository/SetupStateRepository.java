package com.storeflow.onboarding.repository;

import com.storeflow.onboarding.entity.SetupState;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface SetupStateRepository extends JpaRepository<SetupState, Long> {
    Optional<SetupState> findByStoreId(Long storeId);
    boolean existsByInitializedTrue();
}
