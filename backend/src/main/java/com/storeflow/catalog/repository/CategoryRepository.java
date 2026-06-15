package com.storeflow.catalog.repository;

import com.storeflow.catalog.entity.Category;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface CategoryRepository extends JpaRepository<Category, Long> {
    List<Category> findAllByStoreIdAndActiveTrue(Long storeId);
    List<Category> findAllByStoreId(Long storeId);
    Optional<Category> findByStoreIdAndSlug(Long storeId, String slug);
    boolean existsByStoreIdAndSlug(Long storeId, String slug);
}
