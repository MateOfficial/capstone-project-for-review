package com.storeflow.catalog.entity;

import com.storeflow.common.entity.BaseEntity;
import com.storeflow.store.entity.Store;
import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "categories", uniqueConstraints = @UniqueConstraint(columnNames = {"store_id", "slug"}))
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Category extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "store_id", nullable = false)
    private Store store;

    @Column(nullable = false)
    private String name;

    @Column(nullable = false)
    private String slug;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "parent_id")
    private Category parent;

    @Column(name = "sort_order")
    @Builder.Default
    private Integer sortOrder = 0;

    @Builder.Default
    private Boolean active = true;
}
