package com.storeflow.documents.entity;

import com.storeflow.auth.entity.User;
import com.storeflow.crm.entity.Client;
import com.storeflow.store.entity.Store;
import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

@Entity
@Table(name = "warranties")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Warranty {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "store_id", nullable = false)
    private Store store;

    @Column(name = "warranty_number", unique = true, nullable = false)
    private String warrantyNumber;

    @Column(nullable = false)
    private String model;

    @Column(name = "serial_number")
    private String serialNumber;

    private String brand;

    @Column(name = "duration_months", nullable = false)
    @Builder.Default
    private Integer durationMonths = 12;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "client_id")
    private Client client;

    @Column(name = "client_name")
    private String clientName;

    @Column(name = "client_phone")
    private String clientPhone;

    @Column(name = "signature_data")
    private String signatureData;

    @Column(name = "ip_address")
    private String ipAddress;

    @Column(name = "expires_at")
    private Instant expiresAt;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "created_by")
    private User createdByUser;

    @PrePersist
    protected void onCreate() {
        this.createdAt = Instant.now();
        if (this.expiresAt == null && this.durationMonths != null) {
            this.expiresAt = this.createdAt.plus(java.time.Duration.ofDays(this.durationMonths * 30L));
        }
    }
}
