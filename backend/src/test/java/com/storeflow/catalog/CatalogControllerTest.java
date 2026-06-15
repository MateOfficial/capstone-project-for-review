package com.storeflow.catalog;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.storeflow.BaseIntegrationTest;
import com.storeflow.auth.entity.Permission;
import com.storeflow.auth.entity.Role;
import com.storeflow.auth.entity.User;
import com.storeflow.auth.repository.PermissionRepository;
import com.storeflow.auth.repository.RoleRepository;
import com.storeflow.auth.repository.UserRepository;
import com.storeflow.auth.security.JwtTokenProvider;
import com.storeflow.catalog.repository.CategoryRepository;
import com.storeflow.catalog.repository.ProductRepository;
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

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@AutoConfigureMockMvc
class CatalogControllerTest extends BaseIntegrationTest {

    @Autowired MockMvc mvc;
    @Autowired ObjectMapper mapper;
    @Autowired StoreRepository storeRepository;
    @Autowired UserRepository userRepository;
    @Autowired RoleRepository roleRepository;
    @Autowired PermissionRepository permissionRepository;
    @Autowired PasswordEncoder passwordEncoder;
    @Autowired JwtTokenProvider jwtTokenProvider;
    @Autowired ProductRepository productRepository;
    @Autowired CategoryRepository categoryRepository;

    private String token;
    private Store store;

    @BeforeEach
    void setup() {
        productRepository.deleteAll();
        categoryRepository.deleteAll();
        userRepository.deleteAll();
        roleRepository.deleteAll();
        storeRepository.deleteAll();

        store = storeRepository.save(Store.builder().name("Test").code("test").build());
        Set<Permission> perms = new HashSet<>(permissionRepository.findAll());
        Role role = roleRepository.save(Role.builder()
                .store(store).code("admin").name("Admin").permissions(perms).build());
        User user = userRepository.save(User.builder()
                .store(store).username("admin")
                .passwordHash(passwordEncoder.encode("pass"))
                .active(true).roles(Set.of(role)).build());
        token = jwtTokenProvider.generateAccessToken(user);
    }

    @Test
    void createCategory_andListIt() throws Exception {
        mvc.perform(post("/api/admin/categories")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(mapper.writeValueAsString(Map.of("name", "Guitars"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.name").value("Guitars"))
                .andExpect(jsonPath("$.data.slug").value("guitars"));

        mvc.perform(get("/api/admin/categories")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.length()").value(1));
    }

    @Test
    void createProduct_andSearch() throws Exception {
        // Create category first
        String catResp = mvc.perform(post("/api/admin/categories")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(mapper.writeValueAsString(Map.of("name", "Keys"))))
                .andReturn().getResponse().getContentAsString();
        long catId = mapper.readTree(catResp).at("/data/id").asLong();

        // Create product
        mvc.perform(post("/api/admin/products")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(mapper.writeValueAsString(Map.of(
                                "name", "Yamaha PSR-E373",
                                "price", 3500000,
                                "categoryId", catId))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.name").value("Yamaha PSR-E373"));

        // Search
        mvc.perform(get("/api/public/products?storeId=" + store.getId() + "&search=PSR")
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.content.length()").value(1));
    }
}
