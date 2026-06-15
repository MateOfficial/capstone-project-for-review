package com.storeflow.store.entity;

import com.storeflow.common.entity.BaseEntity;
import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "stores")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Store extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String name;

    @Column(unique = true, nullable = false)
    private String code;

    @Column(name = "brand_name")
    private String brandName;

    @Column(name = "logo_url", columnDefinition = "TEXT")
    private String logoUrl;

    private String address;
    private String phone;
    private String email;
    private String website;

    @Builder.Default
    private String locale = "en";

    @Builder.Default
    private String currency = "UZS";

    @Builder.Default
    private String timezone = "Asia/Tashkent";

    @Builder.Default
    private Boolean active = true;
}
