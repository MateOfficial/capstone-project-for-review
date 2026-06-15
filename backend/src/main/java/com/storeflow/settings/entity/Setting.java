package com.storeflow.settings.entity;

import com.storeflow.common.entity.BaseEntity;
import com.storeflow.store.entity.Store;
import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "settings", uniqueConstraints = @UniqueConstraint(columnNames = {"store_id", "setting_key"}))
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Setting extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "store_id", nullable = false)
    private Store store;

    @Column(name = "setting_key", nullable = false)
    private String key;

    private String value;

    @Builder.Default
    private String type = "string";
}
