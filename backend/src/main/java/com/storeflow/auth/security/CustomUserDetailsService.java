package com.storeflow.auth.security;

import com.storeflow.auth.entity.User;
import com.storeflow.auth.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class CustomUserDetailsService implements UserDetailsService {

    private final UserRepository userRepository;

    @Override
    @Transactional(readOnly = true)
    public UserDetails loadUserByUsername(String username) throws UsernameNotFoundException {
        // username is formatted as "storeId:username"
        String[] parts = username.split(":", 2);
        if (parts.length != 2) {
            throw new UsernameNotFoundException("Invalid username format");
        }
        Long storeId = Long.parseLong(parts[0]);
        String uname = parts[1];

        User user = userRepository.findByStoreIdAndUsername(storeId, uname)
                .orElseThrow(() -> new UsernameNotFoundException("User not found: " + uname));

        var authorities = user.getPermissionCodes().stream()
                .map(SimpleGrantedAuthority::new)
                .collect(Collectors.toSet());

        return new PlatformUserDetails(user.getId(), user.getStore().getId(), user.getUsername(),
                user.getPasswordHash(), user.getActive(), authorities);
    }

    @Transactional(readOnly = true)
    public UserDetails loadUserById(Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new UsernameNotFoundException("User not found: " + userId));

        var authorities = user.getPermissionCodes().stream()
                .map(SimpleGrantedAuthority::new)
                .collect(Collectors.toSet());

        return new PlatformUserDetails(user.getId(), user.getStore().getId(), user.getUsername(),
                user.getPasswordHash(), user.getActive(), authorities);
    }
}
