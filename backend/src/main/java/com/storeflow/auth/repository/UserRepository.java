package com.storeflow.auth.repository;

import com.storeflow.auth.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface UserRepository extends JpaRepository<User, Long> {
    Optional<User> findByStoreIdAndUsername(Long storeId, String username);
    Optional<User> findByUsername(String username);
    boolean existsByStoreIdAndUsername(Long storeId, String username);
    List<User> findAllByStoreId(Long storeId);

    @Query("SELECT COUNT(u) FROM User u")
    long countAll();
}
