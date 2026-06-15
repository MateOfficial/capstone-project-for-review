package com.storeflow.hr.entity;

import com.storeflow.auth.entity.User;
import com.storeflow.common.entity.BaseEntity;
import com.storeflow.store.entity.Store;
import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDate;

@Entity
@Table(name = "employees")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Employee extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "store_id", nullable = false)
    private Store store;

    @Column(nullable = false)
    private String name;

    @JsonIgnore
    private String pin;
    private String phone;
    private String position;
    private LocalDate hireDate;
    private String email;
    private String emergencyContact;

    @Column(columnDefinition = "TEXT")
    private String hrNotes;

    @Builder.Default
    private Boolean active = true;

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id")
    private User user;
}
