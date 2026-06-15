package com.storeflow.onboarding;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.storeflow.BaseIntegrationTest;
import com.storeflow.onboarding.repository.SetupStateRepository;
import com.storeflow.store.repository.StoreRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.util.Map;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@AutoConfigureMockMvc
class OnboardingControllerTest extends BaseIntegrationTest {

    @Autowired MockMvc mvc;
    @Autowired ObjectMapper mapper;
    @Autowired SetupStateRepository setupStateRepository;
    @Autowired StoreRepository storeRepository;

    @BeforeEach
    void cleanup() {
        setupStateRepository.deleteAll();
    }

    @Test
    void status_beforeInit_returnsNotInitialized() throws Exception {
        mvc.perform(get("/api/onboarding/status"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.initialized").value(false));
    }

    @Test
    void initialize_validRequest_setsUpSystem() throws Exception {
        var request = Map.of(
                "storeProfile", Map.of("name", "Test Shop", "phone", "+998901234567"),
                "adminAccount", Map.of("username", "admin", "password", "admin123", "fullName", "Admin")
        );

        mvc.perform(post("/api/onboarding/initialize")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(mapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.initialized").value(true))
                .andExpect(jsonPath("$.data.storeId").isNumber());
    }

    @Test
    void initialize_twice_returns400() throws Exception {
        var request = Map.of(
                "storeProfile", Map.of("name", "Shop 1"),
                "adminAccount", Map.of("username", "admin", "password", "pass123", "fullName", "A")
        );

        mvc.perform(post("/api/onboarding/initialize")
                .contentType(MediaType.APPLICATION_JSON)
                .content(mapper.writeValueAsString(request)));

        mvc.perform(post("/api/onboarding/initialize")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(mapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest());
    }
}
