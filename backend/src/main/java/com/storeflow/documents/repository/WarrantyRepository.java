package com.storeflow.documents.repository;

import com.storeflow.documents.entity.Warranty;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface WarrantyRepository extends JpaRepository<Warranty, Long> {
    Page<Warranty> findAllByStoreIdOrderByCreatedAtDesc(Long storeId, Pageable pageable);
    Optional<Warranty> findByWarrantyNumber(String warrantyNumber);
    Optional<Warranty> findByIdAndStoreId(Long id, Long storeId);

    @Query("SELECT w FROM Warranty w WHERE w.store.id = :storeId AND " +
           "(LOWER(w.model) LIKE LOWER(CONCAT('%', :query, '%')) OR " +
           "LOWER(w.warrantyNumber) LIKE LOWER(CONCAT('%', :query, '%')) OR " +
           "LOWER(w.serialNumber) LIKE LOWER(CONCAT('%', :query, '%')))")
    Page<Warranty> search(@Param("storeId") Long storeId, @Param("query") String query, Pageable pageable);

    long countByStoreId(Long storeId);

    List<Warranty> findAllByClientIdOrderByCreatedAtDesc(Long clientId);
}
