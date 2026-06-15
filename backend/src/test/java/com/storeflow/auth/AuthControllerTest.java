package com.storeflow.auth;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.storeflow.BaseIntegrationTest;
import com.storeflow.auth.entity.Permission;
import com.storeflow.auth.entity.Role;
import com.storeflow.auth.entity.User;
import com.storeflow.auth.repository.PermissionRepository;
import com.storeflow.auth.repository.RoleRepository;
import com.storeflow.auth.repository.UserRepository;
import com.storeflow.store.entity.Store;
import com.storeflow.store.repository.StoreRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;

import java.util.HashSet;
import java.util.Map;
import java.util.Set;

import static org.hamcrest.Matchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@AutoConfigureMockMvc
class AuthControllerTest extends BaseIntegrationTest {

    @Autowired MockMvc mvc;
    @Autowired ObjectMapper mapper;
    @Autowired StoreRepository storeRepository;
    @Autowired UserRepository userRepository;
    @Autowired RoleRepository roleRepository;
    @Autowired PermissionRepository permissionRepository;
    @Autowired PasswordEncoder passwordEncoder;

    private Store store;

    @BeforeEach
    void setup() {
        userRepository.deleteAll();
        roleRepository.deleteAll();
        storeRepository.deleteAll();

        store = storeRepository.save(Store.builder().name("Test Store").code("test").build());

        Set<Permission> perms = new HashSet<>(permissionRepository.findAll());
        Role role = roleRepository.save(Role.builder()
                .store(store).code("admin").name("Admin")
                .permissions(perms).build());

        userRepository.save(User.builder()
                .store(store).username("testadmin")
                .passwordHash(passwordEncoder.encode("password123"))
                .active(true).roles(Set.of(role)).build());
    }

    @Test
    void login_validCredentials_returnsTokens() throws Exception {
        mvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(mapper.writeValueAsString(Map.of(
                                "username", "testadmin",
                                "password", "password123",
                                "storeId", store.getId()))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.accessToken").isNotEmpty())
                .andExpect(jsonPath("$.data.refreshToken").isNotEmpty())
                .andExpect(jsonPath("$.data.user.username").value("testadmin"));
    }

    @Test
    void login_wrongPassword_returns401() throws Exception {
        mvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(mapper.writeValueAsString(Map.of(
                                "username", "testadmin",
                                "password", "wrongpass",
                                "storeId", store.getId()))))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void refresh_validToken_returnsNewTokens() throws Exception {
        // First login
        String loginResponse = mvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(mapper.writeValueAsString(Map.of(
                                "username", "testadmin",
                                "password", "password123",
                                "storeId", store.getId()))))
                .andReturn().getResponse().getContentAsString();

        String refreshToken = mapper.readTree(loginResponse).at("/data/refreshToken").asText();

        mvc.perform(post("/api/auth/refresh")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(mapper.writeValueAsString(Map.of("refreshToken", refreshToken))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.accessToken").isNotEmpty());
    }
}
