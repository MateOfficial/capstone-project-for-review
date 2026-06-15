package com.storeflow.auth.security;

import lombok.Getter;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.userdetails.User;

import java.util.Collection;

@Getter
public class PlatformUserDetails extends User {

    private final Long userId;
    private final Long storeId;

    public PlatformUserDetails(Long userId, Long storeId, String username, String password,
                                boolean enabled, Collection<? extends GrantedAuthority> authorities) {
        super(username, password, enabled, true, true, true, authorities);
        this.userId = userId;
        this.storeId = storeId;
    }
}
