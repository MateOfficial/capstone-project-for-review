package com.storeflow.documents.entity;

import com.storeflow.auth.entity.User;
import com.storeflow.crm.entity.Client;
import com.storeflow.store.entity.Store;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "issuance_acts")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class IssuanceAct {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "store_id", nullable = false)
    private Store store;

    @Column(name = "act_number", unique = true, nullable = false)
    private String actNumber;

    @Column(nullable = false)
    private String model;

    @Column(name = "serial_number")
    private String serialNumber;

    private String price;

    @Column(name = "return_date")
    private LocalDate returnDate;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "client_id")
    private Client client;

    @Column(name = "client_name")
    private String clientName;

    @Column(name = "client_phone")
    private String clientPhone;

    @Column(name = "condition")
    private String condition;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    @Builder.Default
    private List<String> completeness = new ArrayList<>();

    private String notes;

    @Column(name = "signature_data")
    private String signatureData;

    @Column(name = "ip_address")
    private String ipAddress;

    @Builder.Default
    private String status = "active";

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "created_by")
    private User createdByUser;

    @PrePersist
    protected void onCreate() {
        this.createdAt = Instant.now();
    }
}
