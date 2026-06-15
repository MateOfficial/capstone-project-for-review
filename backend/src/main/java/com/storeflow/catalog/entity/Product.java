package com.storeflow.catalog.entity;

import com.storeflow.auth.entity.User;
import com.storeflow.common.entity.BaseEntity;
import com.storeflow.store.entity.Store;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "products")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Product extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "store_id", nullable = false)
    private Store store;

    private String code;

    @Column(nullable = false)
    private String name;

    @Column(name = "search_key")
    private String searchKey;

    private String description;

    @Column(name = "detailed_description")
    private String detailedDescription;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "category_id")
    private Category category;

    @Builder.Default
    private Long price = 0L;

    @Builder.Default
    private Integer discount = 0;

    @Column(name = "stock_quantity")
    private Integer stockQuantity;

    @Builder.Default
    private Boolean active = true;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    @Builder.Default
    private List<String> features = new ArrayList<>();

    private String characteristics;

    /** External SKU for 1С / ERP integration */
    @Column(name = "external_sku")
    private String externalSku;

    /** Barcode (штрихкод) from 1С — used for two-file import matching */
    @Column(name = "barcode", length = 50)
    private String barcode;

    /** Per-warehouse stock quantities from 1С, e.g. {"Склад 1": 5, "Склад 2": 3} */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "warehouse_stock", columnDefinition = "jsonb")
    private java.util.Map<String, Integer> warehouseStock;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "created_by")
    private User createdByUser;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "updated_by")
    private User updatedByUser;

    @OneToMany(mappedBy = "product", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    private List<ProductImage> images = new ArrayList<>();
}
