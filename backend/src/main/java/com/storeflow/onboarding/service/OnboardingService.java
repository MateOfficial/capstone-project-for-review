package com.storeflow.onboarding.service;

import com.storeflow.auth.dto.CreateUserRequest;
import com.storeflow.auth.entity.Permission;
import com.storeflow.auth.entity.Role;
import com.storeflow.auth.entity.User;
import com.storeflow.auth.repository.PermissionRepository;
import com.storeflow.auth.repository.RoleRepository;
import com.storeflow.auth.repository.UserRepository;
import com.storeflow.common.exception.BusinessException;
import com.storeflow.documents.entity.WarrantyRule;
import com.storeflow.documents.repository.WarrantyRuleRepository;
import com.storeflow.hr.entity.Employee;
import com.storeflow.hr.repository.EmployeeRepository;
import com.storeflow.onboarding.dto.OnboardingRequest;
import com.storeflow.onboarding.dto.OnboardingStatus;
import com.storeflow.onboarding.entity.SetupState;
import com.storeflow.onboarding.repository.SetupStateRepository;
import com.storeflow.settings.entity.ModuleConfig;
import com.storeflow.settings.repository.ModuleConfigRepository;
import com.storeflow.settings.service.SettingsService;
import com.storeflow.store.entity.Store;
import com.storeflow.store.repository.StoreRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

@Slf4j
@Service
@RequiredArgsConstructor
public class OnboardingService {

    private final StoreRepository storeRepository;
    private final SetupStateRepository setupStateRepository;
    private final SettingsService settingsService;
    private final UserRepository userRepository;
    private final RoleRepository roleRepository;
    private final PermissionRepository permissionRepository;
    private final EmployeeRepository employeeRepository;
    private final WarrantyRuleRepository warrantyRuleRepository;
    private final ModuleConfigRepository moduleConfigRepository;
    private final PasswordEncoder passwordEncoder;

    @Transactional(readOnly = true)
    public OnboardingStatus getStatus() {
        List<SetupState> states = setupStateRepository.findAll();
        if (states.isEmpty()) {
            return OnboardingStatus.builder()
                    .initialized(false)
                    .currentStep("store_profile")
                    .completedSteps(List.of())
                    .build();
        }

        SetupState state = states.getFirst();
        return OnboardingStatus.builder()
                .initialized(state.getInitialized())
                .currentStep(state.getCurrentStep())
                .completedSteps(state.getCompletedSteps())
                .storeId(state.getStore() != null ? state.getStore().getId() : null)
                .build();
    }

    @Transactional
    public OnboardingStatus initialize(OnboardingRequest request) {
        if (setupStateRepository.existsByInitializedTrue()) {
            throw new BusinessException("ALREADY_INITIALIZED", "System is already initialized");
        }

        // Step 1: Create store
        OnboardingRequest.StoreProfile profile = request.getStoreProfile();
        Store store = Store.builder()
                .name(profile.getName())
                .code(profile.getCode() != null ? profile.getCode() :
                        profile.getName().toLowerCase().replaceAll("[^a-z0-9]", "-"))
                .address(profile.getAddress())
                .phone(profile.getPhone())
                .email(profile.getEmail())
                .website(profile.getWebsite())
                .build();

        // Step 2: Apply branding
        if (request.getBranding() != null) {
            OnboardingRequest.Branding b = request.getBranding();
            if (b.getBrandName() != null) store.setBrandName(b.getBrandName());
            if (b.getLogoUrl() != null) store.setLogoUrl(b.getLogoUrl());
            if (b.getLocale() != null) store.setLocale(b.getLocale());
            if (b.getCurrency() != null) store.setCurrency(b.getCurrency());
            if (b.getTimezone() != null) store.setTimezone(b.getTimezone());
        }

        store = storeRepository.save(store);

        // Save company info as settings
        OnboardingRequest.StoreProfile prof = request.getStoreProfile();
        settingsService.saveSetting(store.getId(), "company.name", store.getName(), "string");
        if (prof.getPhone() != null) settingsService.saveSetting(store.getId(), "company.phone", prof.getPhone(), "string");
        if (prof.getAddress() != null) settingsService.saveSetting(store.getId(), "company.address", prof.getAddress(), "string");
        if (prof.getEmail() != null) settingsService.saveSetting(store.getId(), "company.email", prof.getEmail(), "string");
        if (request.getBranding() != null) {
            OnboardingRequest.Branding b = request.getBranding();
            if (b.getPrimaryColor() != null) settingsService.saveSetting(store.getId(), "company.primaryColor", b.getPrimaryColor(), "string");
            if (b.getLogoUrl() != null) settingsService.saveSetting(store.getId(), "company.logo", b.getLogoUrl(), "image");
        }
        log.info("Created store: {} ({})", store.getName(), store.getCode());

        // Step 3: Create default roles
        createDefaultRoles(store);

        // Step 4: Create admin account
        createAdminUser(store, request.getAdminAccount());

        // Step 5: Create employees
        if (request.getEmployees() != null) {
            for (var empReq : request.getEmployees()) {
                Employee employee = Employee.builder()
                        .store(store)
                        .name(empReq.getName())
                        .phone(empReq.getPhone())
                        .position(empReq.getPosition())
                        .active(true)
                        .build();
                employeeRepository.save(employee);
            }
        }

        // Step 6: Configure modules
        if (request.getModules() != null) {
            for (var entry : request.getModules().entrySet()) {
                ModuleConfig config = ModuleConfig.builder()
                        .store(store)
                        .moduleCode(entry.getKey())
                        .enabled(entry.getValue())
                        .build();
                moduleConfigRepository.save(config);
            }
        } else {
            // Enable all modules by default
            for (String module : List.of("catalog", "crm", "hr", "documents", "reporting")) {
                ModuleConfig config = ModuleConfig.builder()
                        .store(store)
                        .moduleCode(module)
                        .enabled(true)
                        .build();
                moduleConfigRepository.save(config);
            }
        }

        // Step 7: Warranty defaults
        if (request.getWarrantyDefaults() != null) {
            for (var wd : request.getWarrantyDefaults()) {
                WarrantyRule rule = WarrantyRule.builder()
                        .store(store)
                        .brand(wd.getBrand().toLowerCase())
                        .durationMonths(wd.getDurationMonths())
                        .terms(wd.getTerms())
                        .active(true)
                        .build();
                warrantyRuleRepository.save(rule);
            }
        }

        // Mark as initialized
        SetupState setupState = SetupState.builder()
                .store(store)
                .initialized(true)
                .currentStep("completed")
                .completedSteps(List.of("store_profile", "branding", "admin_account",
                        "employees", "modules", "warranty_defaults"))
                .completedAt(Instant.now())
                .build();
        setupStateRepository.save(setupState);

        log.info("Onboarding completed for store: {}", store.getName());

        return OnboardingStatus.builder()
                .initialized(true)
                .currentStep("completed")
                .completedSteps(setupState.getCompletedSteps())
                .storeId(store.getId())
                .build();
    }

    private void createDefaultRoles(Store store) {
        List<Permission> allPermissions = permissionRepository.findAll();

        // Super Admin - all permissions
        Role superAdmin = Role.builder()
                .store(store)
                .code("super_admin")
                .name("Super Admin")
                .description("Full access to all features")
                .systemRole(true)
                .permissions(new HashSet<>(allPermissions))
                .build();
        roleRepository.save(superAdmin);

        // Admin
        Set<Permission> adminPerms = new HashSet<>(allPermissions);
        adminPerms.removeIf(p -> "admin.users".equals(p.getCode()) || "admin.audit".equals(p.getCode()));
        Role admin = Role.builder()
                .store(store)
                .code("admin")
                .name("Admin")
                .description("Store administration access")
                .systemRole(true)
                .permissions(adminPerms)
                .build();
        roleRepository.save(admin);

        // Sales
        Set<Permission> salesPerms = new HashSet<>();
        allPermissions.stream()
                .filter(p -> p.getCode().startsWith("catalog.view") || p.getCode().startsWith("crm.") ||
                             p.getCode().startsWith("documents.view") || p.getCode().startsWith("documents.manage"))
                .forEach(salesPerms::add);
        Role sales = Role.builder()
                .store(store)
                .code("sales")
                .name("Sales")
                .description("Sales staff access")
                .permissions(salesPerms)
                .build();
        roleRepository.save(sales);

        // Viewer
        Set<Permission> viewerPerms = new HashSet<>();
        allPermissions.stream()
                .filter(p -> p.getCode().endsWith(".view"))
                .forEach(viewerPerms::add);
        Role viewer = Role.builder()
                .store(store)
                .code("viewer")
                .name("Viewer")
                .description("Read-only access")
                .permissions(viewerPerms)
                .build();
        roleRepository.save(viewer);
    }

    private void createAdminUser(Store store, CreateUserRequest request) {
        String username = request != null ? request.getUsername() : "admin";
        String password = request != null ? request.getPassword() : "admin123";

        Role superAdminRole = roleRepository.findByStoreIdAndCode(store.getId(), "super_admin")
                .orElseThrow(() -> new BusinessException("SETUP_ERROR", "Super admin role not created"));

        User user = User.builder()
                .store(store)
                .username(username)
                .passwordHash(passwordEncoder.encode(password))
                .email(request != null ? request.getEmail() : null)
                .fullName(request != null ? request.getFullName() : "Administrator")
                .active(true)
                .systemAccount(true)
                .roles(Set.of(superAdminRole))
                .build();

        userRepository.save(user);
        log.info("Created admin user: {} for store: {}", username, store.getName());
    }
}
