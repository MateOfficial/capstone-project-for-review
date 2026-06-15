package com.storeflow.crm.repository;

import com.storeflow.crm.entity.Client;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface ClientRepository extends JpaRepository<Client, Long> {
    Page<Client> findAllByStoreId(Long storeId, Pageable pageable);
    Optional<Client> findByIdAndStoreId(Long id, Long storeId);
    Optional<Client> findByStoreIdAndPhone(Long storeId, String phone);
    boolean existsByStoreIdAndPhone(Long storeId, String phone);

    @Query("SELECT c FROM Client c WHERE c.store.id = :storeId AND " +
           "(LOWER(c.fullName) LIKE LOWER(CONCAT('%', :query, '%')) OR " +
           "c.phone LIKE CONCAT('%', :query, '%'))")
    Page<Client> search(@Param("storeId") Long storeId, @Param("query") String query, Pageable pageable);

    long countByStoreId(Long storeId);
}
