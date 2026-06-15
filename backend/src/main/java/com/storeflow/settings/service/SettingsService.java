package com.storeflow.settings.service;

import com.storeflow.settings.entity.ModuleConfig;
import com.storeflow.settings.entity.Setting;
import com.storeflow.settings.repository.ModuleConfigRepository;
import com.storeflow.settings.repository.SettingRepository;
import com.storeflow.auth.entity.User;
import com.storeflow.auth.repository.UserRepository;
import com.storeflow.common.exception.BusinessException;
import com.storeflow.store.entity.Store;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Slf4j
@Service
@RequiredArgsConstructor
public class SettingsService {

    private static final String FACTORY_RESET_PASSWORD = "192168130";

    private final SettingRepository settingRepository;
    private final ModuleConfigRepository moduleConfigRepository;
    private final UserRepository userRepository;
    private final JdbcTemplate jdbcTemplate;

    @Value("${app.upload.dir:./uploads}")
    private String uploadDir;

    @Transactional(readOnly = true)
    public Map<String, String> getAllSettings(Long storeId) {
        Map<String, String> result = new HashMap<>();
        settingRepository.findAllByStoreId(storeId)
                .forEach(s -> result.put(s.getKey(), s.getValue()));
        return result;
    }

    @Transactional
    public void saveSetting(Long storeId, String key, String value, String type) {
        Setting setting = settingRepository.findByStoreIdAndKey(storeId, key)
                .orElseGet(() -> {
                    Store store = new Store();
                    store.setId(storeId);
                    return Setting.builder().store(store).key(key).build();
                });
        setting.setValue(value);
        if (type != null) setting.setType(type);
        settingRepository.save(setting);
    }

    @Transactional
    public void saveSettings(Long storeId, Map<String, String> settings) {
        settings.forEach((key, value) -> saveSetting(storeId, key, value, "string"));
    }

    @Transactional(readOnly = true)
    public List<ModuleConfig> getModuleConfigs(Long storeId) {
        return moduleConfigRepository.findAllByStoreId(storeId);
    }

    @Transactional
    public void updateModuleConfig(Long storeId, String moduleCode, boolean enabled) {
        ModuleConfig config = moduleConfigRepository.findByStoreIdAndModuleCode(storeId, moduleCode)
                .orElseGet(() -> {
                    Store store = new Store();
                    store.setId(storeId);
                    return ModuleConfig.builder().store(store).moduleCode(moduleCode).build();
                });
        config.setEnabled(enabled);
        moduleConfigRepository.save(config);
    }

    @Transactional
    public void factoryResetToOnboarding(Long storeId, Long userId, String password) {
        if (!FACTORY_RESET_PASSWORD.equals(password)) {
            throw new BusinessException("INVALID_RESET_PASSWORD", "Invalid reset password");
        }

        User user = userRepository.findById(userId)
                .orElseThrow(() -> new BusinessException("USER_NOT_FOUND", "User not found"));

        boolean isSuperAdmin = user.getRoles().stream()
                .anyMatch(role -> "super_admin".equals(role.getCode()));
        if (!isSuperAdmin) {
            throw new BusinessException("FORBIDDEN", "Only super admin can perform factory reset");
        }

        if (user.getStore() == null || !storeId.equals(user.getStore().getId())) {
            throw new BusinessException("FORBIDDEN", "Store mismatch for factory reset");
        }

        jdbcTemplate.execute("""
                TRUNCATE TABLE
                    audit_log,
                    attendance_records,
                    schedules,
                    issuance_acts,
                    warranties,
                    warranty_rules,
                    document_templates,
                    product_images,
                    products,
                    categories,
                    clients,
                    employees,
                    refresh_tokens,
                    user_roles,
                    role_permissions,
                    roles,
                    users,
                    settings,
                    module_config,
                    integration_settings,
                    setup_state,
                    stores
                RESTART IDENTITY CASCADE
                """);

        wipeUploadsDirectory();
        log.warn("Factory reset executed by userId={} for storeId={}", userId, storeId);
    }

    private void wipeUploadsDirectory() {
        try {
            Path root = Path.of(uploadDir);
            if (!Files.exists(root)) {
                return;
            }
            try (var stream = Files.walk(root)) {
                stream.sorted(Comparator.reverseOrder())
                        .forEach(path -> {
                            if (path.equals(root)) {
                                return;
                            }
                            try {
                                Files.deleteIfExists(path);
                            } catch (IOException e) {
                                log.warn("Failed to delete {} during factory reset", path, e);
                            }
                        });
            }
        } catch (IOException e) {
            log.warn("Failed to clean uploads directory during factory reset", e);
        }
    }
}
