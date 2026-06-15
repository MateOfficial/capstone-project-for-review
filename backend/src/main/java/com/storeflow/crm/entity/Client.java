package com.storeflow.crm.entity;

import com.storeflow.auth.entity.User;
import com.storeflow.common.entity.BaseEntity;
import com.storeflow.store.entity.Store;
import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "clients")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Client extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "store_id", nullable = false)
    private Store store;

    @Column(name = "full_name", nullable = false)
    private String fullName;

    private String phone;
    private String email;
    private String notes;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "created_by")
    private User createdByUser;
}
