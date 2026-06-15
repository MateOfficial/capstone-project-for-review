package com.storeflow.auth.entity;

import com.storeflow.common.entity.BaseEntity;
import com.storeflow.store.entity.Store;
import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;
import java.util.HashSet;
import java.util.Set;

@Entity
@Table(name = "users", uniqueConstraints = @UniqueConstraint(columnNames = {"store_id", "username"}))
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class User extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "store_id")
    private Store store;

    @Column(nullable = false)
    private String username;

    @Column(name = "password_hash", nullable = false)
    private String passwordHash;

    private String email;

    @Column(name = "full_name")
    private String fullName;

    @Builder.Default
    private Boolean active = true;

    @Column(name = "system_account")
    @Builder.Default
    private Boolean systemAccount = false;

    @Column(name = "last_login_at")
    private Instant lastLoginAt;

    @Column(name = "created_by")
    private Long createdBy;

    @ManyToMany(fetch = FetchType.EAGER)
    @JoinTable(name = "user_roles",
            joinColumns = @JoinColumn(name = "user_id"),
            inverseJoinColumns = @JoinColumn(name = "role_id"))
    @Builder.Default
    private Set<Role> roles = new HashSet<>();

    public Set<String> getPermissionCodes() {
        Set<String> codes = new HashSet<>();
        for (Role role : roles) {
            for (Permission p : role.getPermissions()) {
                codes.add(p.getCode());
            }
        }
        return codes;
    }

    public boolean hasPermission(String permissionCode) {
        return getPermissionCodes().contains(permissionCode);
    }
}
