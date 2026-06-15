package com.storeflow.catalog.repository;

import com.storeflow.catalog.entity.Product;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ProductRepository extends JpaRepository<Product, Long> {

    Page<Product> findAllByStoreIdAndActiveTrue(Long storeId, Pageable pageable);

       Page<Product> findAllByStoreIdAndCategoryIdAndActiveTrue(Long storeId, Long categoryId, Pageable pageable);

    Page<Product> findAllByStoreId(Long storeId, Pageable pageable);

    Optional<Product> findByIdAndStoreId(Long id, Long storeId);

    @Query("SELECT p FROM Product p WHERE p.store.id = :storeId AND p.active = true AND " +
           "(LOWER(p.name) LIKE LOWER(CONCAT('%', :query, '%')) OR " +
           "LOWER(p.searchKey) LIKE LOWER(CONCAT('%', :query, '%')) OR " +
           "LOWER(p.code) LIKE LOWER(CONCAT('%', :query, '%')))")
    Page<Product> search(@Param("storeId") Long storeId, @Param("query") String query, Pageable pageable);

    List<Product> findAllByStoreIdAndCategoryId(Long storeId, Long categoryId);

    @Query("SELECT COUNT(p) FROM Product p WHERE p.store.id = :storeId AND p.active = true")
    long countActiveByStoreId(@Param("storeId") Long storeId);

    @Query("SELECT COUNT(p) FROM Product p WHERE p.store.id = :storeId AND p.discount > 0")
    long countDiscountedByStoreId(@Param("storeId") Long storeId);

    @Query("SELECT p.category.id, COUNT(p) FROM Product p " +
           "WHERE p.store.id = :storeId AND p.active = true AND p.category IS NOT NULL " +
           "GROUP BY p.category.id")
    List<Object[]> countActiveByStoreIdGroupedByCategory(@Param("storeId") Long storeId);

       @Query("SELECT p.store.id FROM Product p WHERE p.active = true GROUP BY p.store.id ORDER BY COUNT(p) DESC")
       List<Long> findStoreIdsByActiveProductCount(Pageable pageable);

    Optional<Product> findByStoreIdAndCode(Long storeId, String code);

    Optional<Product> findByStoreIdAndBarcode(Long storeId, String barcode);

    @Query("SELECT p FROM Product p WHERE p.store.id = :storeId AND " +
           "LOWER(REPLACE(p.name, ' ', '')) = LOWER(REPLACE(:name, ' ', ''))")
    Optional<Product> findByStoreIdAndNameNormalized(@Param("storeId") Long storeId, @Param("name") String name);

    @Query("SELECT p FROM Product p LEFT JOIN FETCH p.category WHERE p.store.id = :storeId AND p.active = true")
    List<Product> findActiveWithCategoryByStoreId(@Param("storeId") Long storeId, Pageable pageable);
}
