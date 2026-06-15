package com.storeflow.documents.entity;

import com.storeflow.common.entity.BaseEntity;
import com.storeflow.store.entity.Store;
import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "warranty_rules", uniqueConstraints = @UniqueConstraint(columnNames = {"store_id", "brand"}))
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class WarrantyRule extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "store_id", nullable = false)
    private Store store;

    @Column(nullable = false)
    private String brand;

    @Column(name = "duration_months", nullable = false)
    @Builder.Default
    private Integer durationMonths = 12;

    private String terms;

    @Builder.Default
    private Boolean active = true;
}
