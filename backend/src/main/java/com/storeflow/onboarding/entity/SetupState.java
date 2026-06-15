package com.storeflow.onboarding.entity;

import com.storeflow.common.entity.BaseEntity;
import com.storeflow.store.entity.Store;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "setup_state")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SetupState extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "store_id", unique = true)
    private Store store;

    @Builder.Default
    private Boolean initialized = false;

    @Column(name = "current_step")
    @Builder.Default
    private String currentStep = "store_profile";

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "completed_steps", columnDefinition = "jsonb")
    @Builder.Default
    private List<String> completedSteps = new ArrayList<>();

    @Column(name = "completed_at")
    private Instant completedAt;
}
