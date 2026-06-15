package com.storeflow.integration.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "integration_settings",
       uniqueConstraints = @UniqueConstraint(columnNames = {"store_id", "provider"}))
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class IntegrationSettings {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "store_id", nullable = false)
    private Long storeId;

    @Column(nullable = false, length = 50)
    private String provider;

    @Column(name = "base_url", length = 500)
    private String baseUrl;

    @Column(length = 255)
    private String username;

    @Column(name = "password_hash", length = 500)
    private String passwordHash;

    @Column(name = "sync_enabled")
    private Boolean syncEnabled = false;

    @Column(name = "sync_interval_minutes")
    private Integer syncIntervalMinutes = 60;

    @Column(name = "last_sync_at")
    private LocalDateTime lastSyncAt;

    @Column(name = "last_sync_count")
    private Integer lastSyncCount = 0;

    @Column(name = "sync_api_key", length = 64, unique = true)
    private String syncApiKey;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @PrePersist
    void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
    }

    @PreUpdate
    void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
