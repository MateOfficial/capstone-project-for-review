package com.storeflow.migration;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.storeflow.auth.entity.Permission;
import com.storeflow.auth.entity.Role;
import com.storeflow.auth.entity.User;
import com.storeflow.auth.repository.PermissionRepository;
import com.storeflow.auth.repository.RoleRepository;
import com.storeflow.auth.repository.UserRepository;
import com.storeflow.catalog.entity.Category;
import com.storeflow.catalog.entity.Product;
import com.storeflow.catalog.repository.CategoryRepository;
import com.storeflow.catalog.repository.ProductRepository;
import com.storeflow.common.util.ProductNameNormalizer;
import com.storeflow.common.util.SlugUtils;
import com.storeflow.crm.entity.Client;
import com.storeflow.crm.repository.ClientRepository;
import com.storeflow.documents.entity.IssuanceAct;
import com.storeflow.documents.entity.Warranty;
import com.storeflow.documents.repository.IssuanceActRepository;
import com.storeflow.documents.repository.WarrantyRepository;
import com.storeflow.hr.entity.AttendanceRecord;
import com.storeflow.hr.entity.Employee;
import com.storeflow.hr.repository.AttendanceRepository;
import com.storeflow.hr.repository.EmployeeRepository;
import com.storeflow.onboarding.entity.SetupState;
import com.storeflow.onboarding.repository.SetupStateRepository;
import com.storeflow.settings.entity.Setting;
import com.storeflow.settings.repository.SettingRepository;
import com.storeflow.store.entity.Store;
import com.storeflow.store.repository.StoreRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.io.File;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.*;

/**
 * One-time migration from legacy JSON database files to PostgreSQL.
 * Activate with: --spring.profiles.active=migrate
 */
@Slf4j
@Component
@Profile("migrate")
@RequiredArgsConstructor
public class LegacyMigrationRunner implements CommandLineRunner {

    private final ObjectMapper mapper;
    private final StoreRepository storeRepository;
    private final SetupStateRepository setupStateRepository;
    private final UserRepository userRepository;
    private final RoleRepository roleRepository;
    private final PermissionRepository permissionRepository;
    private final ProductRepository productRepository;
    private final CategoryRepository categoryRepository;
    private final ClientRepository clientRepository;
    private final EmployeeRepository employeeRepository;
    private final AttendanceRepository attendanceRepository;
    private final WarrantyRepository warrantyRepository;
    private final IssuanceActRepository issuanceActRepository;
    private final SettingRepository settingRepository;

    private Store store;
    private final Map<String, Long> employeeIdMap = new HashMap<>();

    @Override
    @Transactional
    public void run(String... args) throws Exception {
        String basePath = System.getProperty("legacy.data.path",
                "../database");
        File dir = new File(basePath);
        if (!dir.exists()) {
            log.error("Legacy data directory not found: {}", dir.getAbsolutePath());
            return;
        }

        log.info("=== Starting legacy data migration from {} ===", dir.getAbsolutePath());

        createStore();
        migrateAdmins(new File(dir, "admins.json"));
        migrateProducts(new File(dir, "products.json"));
        migrateClients(new File(dir, "clients.json"));
        migrateEmployees(new File(dir, "employees.json"));
        migrateAttendance(new File(dir, "attendance.json"));
        migrateWarranties(new File(dir, "warranties.json"));
        migrateIssuances(new File(dir, "issuances.json"));
        migrateSettings(new File(dir, "settings.json"));
        markInitialized();

        log.info("=== Migration complete ===");
    }

    private void createStore() {
        store = storeRepository.save(Store.builder()
                .name("Yamaha Music Store")
                .code("yamaha")
                .currency("UZS")
                .locale("en")
                .timezone("Asia/Tashkent")
                .build());
        log.info("Created store: {}", store.getName());
    }

    private void migrateAdmins(File file) throws Exception {
        if (!file.exists()) { log.warn("admins.json not found, skipping"); return; }

        List<JsonNode> admins = mapper.readValue(file, new TypeReference<>() {});
        List<Permission> allPerms = permissionRepository.findAll();

        // Create super_admin role
        Role superAdmin = roleRepository.save(Role.builder()
                .store(store).code("super_admin").name("Super Admin")
                .systemRole(true).permissions(new HashSet<>(allPerms)).build());

        int count = 0;
        for (JsonNode a : admins) {
            String username = a.get("username").asText();
            if (userRepository.findByStoreIdAndUsername(store.getId(), username).isPresent()) continue;

            User user = User.builder()
                    .store(store)
                    .username(username)
                    .passwordHash(a.get("password").asText()) // already bcrypt
                    .active(true)
                    .systemAccount("super_admin".equals(a.path("role").asText()))
                    .roles(Set.of(superAdmin))
                    .build();
            if (a.has("createdAt")) user.setCreatedAt(Instant.parse(a.get("createdAt").asText()));
            userRepository.save(user);
            count++;
        }
        log.info("Migrated {} admins", count);
    }

    private void migrateProducts(File file) throws Exception {
        if (!file.exists()) { log.warn("products.json not found, skipping"); return; }

        List<JsonNode> products = mapper.readValue(file, new TypeReference<>() {});
        Map<String, Category> categoryCache = new HashMap<>();

        int count = 0;
        for (JsonNode p : products) {
            String catName = p.path("category").asText("");
            Category category = null;
            if (!catName.isBlank()) {
                category = categoryCache.computeIfAbsent(catName, name -> {
                    String slug = SlugUtils.normalizeSlug(name);
                    return categoryRepository.save(Category.builder()
                            .store(store).name(name).slug(slug).build());
                });
            }

            Product product = Product.builder()
                    .store(store)
                    .name(ProductNameNormalizer.normalize(p.path("name").asText("")))
                    .code(p.path("code").asText(null))
                    .searchKey(p.path("searchKey").asText(null))
                    .price(p.path("price").asLong(0))
                    .discount(p.path("discount").asInt(0))
                    .description(p.path("description").asText(null))
                    .category(category)
                    .active(true)
                    .build();
            if (p.has("createdAt")) product.setCreatedAt(Instant.parse(p.get("createdAt").asText()));
            productRepository.save(product);
            count++;
        }
        log.info("Migrated {} products across {} categories", count, categoryCache.size());
    }

    private void migrateClients(File file) throws Exception {
        if (!file.exists()) { log.warn("clients.json not found, skipping"); return; }

        List<JsonNode> clients = mapper.readValue(file, new TypeReference<>() {});
        int count = 0;
        for (JsonNode c : clients) {
            String phone = c.path("phone").asText("");
            if (phone.isBlank()) continue;
            if (clientRepository.findByStoreIdAndPhone(store.getId(), phone).isPresent()) continue;

            Client client = Client.builder()
                    .store(store)
                    .fullName(c.path("fullName").asText(""))
                    .phone(phone)
                    .notes(c.path("notes").asText(null))
                    .build();
            if (c.has("createdAt")) client.setCreatedAt(Instant.parse(c.get("createdAt").asText()));
            clientRepository.save(client);
            count++;
        }
        log.info("Migrated {} clients", count);
    }

    private void migrateEmployees(File file) throws Exception {
        if (!file.exists()) { log.warn("employees.json not found, skipping"); return; }

        List<JsonNode> employees = mapper.readValue(file, new TypeReference<>() {});
        int count = 0;
        for (JsonNode e : employees) {
            Employee emp = Employee.builder()
                    .store(store)
                    .name(e.path("name").asText(""))
                    .pin(e.path("pin").asText(null))
                    .active(e.path("active").asBoolean(true))
                    .build();
            if (e.has("createdAt")) emp.setCreatedAt(Instant.parse(e.get("createdAt").asText()));
            Employee saved = employeeRepository.save(emp);
            employeeIdMap.put(e.path("id").asText(), saved.getId());
            count++;
        }
        log.info("Migrated {} employees", count);
    }

    private void migrateAttendance(File file) throws Exception {
        if (!file.exists()) { log.warn("attendance.json not found, skipping"); return; }

        List<JsonNode> records = mapper.readValue(file, new TypeReference<>() {});
        int count = 0;
        for (JsonNode r : records) {
            // Only migrate employee attendance (skip admin check-ins)
            if (!r.has("employeeId")) continue;

            String legacyEmpId = r.get("employeeId").asText();
            Long empId = employeeIdMap.get(legacyEmpId);
            if (empId == null) continue;

            Employee emp = employeeRepository.findById(empId).orElse(null);
            if (emp == null) continue;

            Instant ts = Instant.parse(r.get("timestamp").asText());
            LocalDate date = ts.atZone(java.time.ZoneId.of("Asia/Tashkent")).toLocalDate();

            AttendanceRecord att = AttendanceRecord.builder()
                    .store(store)
                    .employee(emp)
                    .employeeName(emp.getName())
                    .type("check-in")
                    .timestamp(ts)
                    .ipAddress(r.path("ip").asText(null))
                    .build();
            attendanceRepository.save(att);
            count++;
        }
        log.info("Migrated {} attendance records", count);
    }

    private void migrateWarranties(File file) throws Exception {
        if (!file.exists()) { log.warn("warranties.json not found, skipping"); return; }

        List<JsonNode> warranties = mapper.readValue(file, new TypeReference<>() {});
        int count = 0;
        for (JsonNode w : warranties) {
            Warranty warranty = Warranty.builder()
                    .store(store)
                    .warrantyNumber(w.path("id").asText())
                    .model(w.path("model").asText(""))
                    .serialNumber(w.path("serial").asText(null))
                    .build();
            if (w.has("createdAt")) {
                Instant created = Instant.parse(w.get("createdAt").asText());
                warranty.setCreatedAt(created);
            }
            warrantyRepository.save(warranty);
            count++;
        }
        log.info("Migrated {} warranties", count);
    }

    private void migrateIssuances(File file) throws Exception {
        if (!file.exists()) { log.warn("issuances.json not found, skipping"); return; }

        List<JsonNode> acts = mapper.readValue(file, new TypeReference<>() {});
        int count = 0;
        for (JsonNode a : acts) {
            // Parse price string: "5 330 000 сум" → 5330000
            String priceStr = a.path("price").asText("0")
                    .replaceAll("[^0-9]", "");
            BigDecimal total = priceStr.isEmpty() ? BigDecimal.ZERO : new BigDecimal(priceStr);

            IssuanceAct act = IssuanceAct.builder()
                    .store(store)
                    .actNumber(a.path("id").asText())
                    .clientName(a.path("clientName").asText(""))
                    .clientPhone(a.path("clientPhone").asText(null))
                    .model(a.path("model").asText(""))
                    .price(priceStr)
                    .notes(a.path("notes").asText(null))
                    .build();
            if (a.has("createdAt")) {
                act.setCreatedAt(Instant.parse(a.get("createdAt").asText()));
            }
            issuanceActRepository.save(act);
            count++;
        }
        log.info("Migrated {} issuance acts", count);
    }

    private void migrateSettings(File file) throws Exception {
        if (!file.exists()) { log.warn("settings.json not found, skipping"); return; }

        JsonNode settings = mapper.readTree(file);
        int count = 0;
        var fields = settings.fields();
        while (fields.hasNext()) {
            var entry = fields.next();
            settingRepository.save(Setting.builder()
                    .store(store)
                    .key(entry.getKey())
                    .value(entry.getValue().asText())
                    .type("string")
                    .build());
            count++;
        }
        log.info("Migrated {} settings", count);
    }

    private void markInitialized() {
        setupStateRepository.save(SetupState.builder()
                .store(store)
                .initialized(true)
                .currentStep("completed")
                .completedSteps(List.of("migration"))
                .completedAt(Instant.now())
                .build());
    }
}
