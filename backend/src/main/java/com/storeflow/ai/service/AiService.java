package com.storeflow.ai.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.storeflow.catalog.repository.ProductRepository;
import com.storeflow.crm.repository.ClientRepository;
import com.storeflow.documents.repository.WarrantyRepository;
import com.storeflow.hr.repository.EmployeeRepository;
import com.storeflow.settings.repository.SettingRepository;
import com.storeflow.store.repository.StoreRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class AiService {

    private static final String OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
    private static final String DEFAULT_MODEL = "openai/gpt-4o-mini";
    private static final String BASE_PROMPT =
            "Ты — ИИ-ассистент встроенный в систему управления магазином StoreFlow. " +
            "Всегда отвечай на том языке, на котором написан вопрос (по умолчанию — русский). " +
            "\n\n" +
            "КРИТИЧЕСКИ ВАЖНО: В конце этого промпта содержатся РЕАЛЬНЫЕ АКТУАЛЬНЫЕ ДАННЫЕ этого " +
            "конкретного магазина из базы данных (товары, клиенты, сотрудники и т.д.). " +
            "Ты ОБЯЗАН использовать эти данные при ответе. " +
            "НИКОГДА не говори что у тебя нет доступа к данным магазина — они предоставлены ниже. " +
            "НИКОГДА не предлагай пользователю самому проверить каталог, если данные уже есть в промпте.\n" +
            "\n=== ЧТО УМЕЕТ STOREFLOW ===\n" +
            "1. КАТАЛОГ ТОВАРОВ: добавление/редактирование товаров, категории, цены в сумах, скидки (%), " +
            "   штрихкоды, QR-коды, остатки на складе, активация/деактивация, поиск и фильтрация.\n" +
            "2. CRM (КЛИЕНТЫ): база клиентов, ФИО, телефон, история покупок, рассрочки.\n" +
            "3. ГАРАНТИИ: выдача гарантийных талонов, условия по брендам (YAMAHA, SHURE и др.), " +
            "   PDF-печать с логотипом, шаблоны с drag-drop редактором.\n" +
            "4. АКТЫ ПЕРЕДАЧИ: документы о выдаче товара клиенту, PDF.\n" +
            "5. HR (СОТРУДНИКИ): список, должности, PIN-входы, посещаемость, расписание, Excel.\n" +
            "6. НАСТРОЙКИ: лого, фирменный цвет, модули, роли, ИИ-ключ.\n" +
            "7. ОНБОРДИНГ: мастер первоначальной настройки магазина.\n" +
            "8. АНАЛИТИКА: дашборд со статистикой.\n" +
            "\n=== КАК ОТВЕЧАТЬ ===\n" +
            "- Отвечай конкретно, используя данные из раздела ниже.\n" +
            "- Если товар найден в данных каталога — обязательно назови цену, категорию, остаток.\n" +
            "- Если в данных нет описания/характеристик товара — используй свои знания об этой " +
            "  модели/бренде (Yamaha DM3S, Shure и т.д.) и опиши её. " +
            "  Раздели: «В каталоге: цена X сум, остаток Y» и «Об этой модели: ...».\n" +
            "- Если товара нет в найденных результатах — скажи что поиск не нашёл совпадений.\n" +
            "- Считай скидки и итоговые цены по запросу.\n" +
            "- Объясняй как работать с системой пошагово.\n" +
            "\n=== ТЕКУЩИЕ ДАННЫЕ МАГАЗИНА (из базы данных, актуальны на момент запроса) ===\n";

    private final SettingRepository settingRepository;
    private final ObjectMapper objectMapper;
    private final ProductRepository productRepository;
    private final ClientRepository clientRepository;
    private final WarrantyRepository warrantyRepository;
    private final EmployeeRepository employeeRepository;
    private final StoreRepository storeRepository;

    public Optional<String> getApiKey(Long storeId) {
        return settingRepository.findByStoreIdAndKey(storeId, "openrouter_api_key")
                .map(s -> s.getValue())
                .filter(v -> v != null && !v.isBlank());
    }

    /**
     * Builds a context snapshot of real store data to inject into the system prompt.
     * Also searches products relevant to the user's query.
     */
    private String buildStoreContext(Long storeId, String userMessage) {
        try {
            StringBuilder sb = new StringBuilder();

            // Store info
            storeRepository.findById(storeId).ifPresent(store ->
                sb.append("Магазин: ").append(store.getName()).append("\n")
            );

            // Products summary
            long totalProducts = productRepository.countActiveByStoreId(storeId);
            long discountedProducts = productRepository.countDiscountedByStoreId(storeId);
            sb.append("Товары: ").append(totalProducts).append(" активных");
            if (discountedProducts > 0) sb.append(", ").append(discountedProducts).append(" со скидкой");
            sb.append("\n");

            // Extract individual tokens from message (words 2+ chars, skip stop-words)
            java.util.Set<String> stopWords = java.util.Set.of(
                "у", "нас", "в", "есть", "что", "это", "как", "для", "по", "на", "не",
                "с", "и", "или", "да", "то", "если", "ли", "бы", "из", "он", "она",
                "мне", "нет", "все", "при", "за", "о", "от", "до", "со"
            );
            String[] words = userMessage.toLowerCase().split("[\\s\\p{Punct}]+");
            java.util.LinkedHashSet<String> tokens = new java.util.LinkedHashSet<>();
            for (String w : words) {
                if (w.length() >= 2 && !stopWords.contains(w)) tokens.add(w);
            }

            // Search for each token, collect unique products
            java.util.LinkedHashMap<Long, com.storeflow.catalog.entity.Product> found = new java.util.LinkedHashMap<>();
            for (String token : tokens) {
                productRepository.search(storeId, token, PageRequest.of(0, 10))
                    .getContent()
                    .forEach(p -> found.putIfAbsent(p.getId(), p));
                if (found.size() >= 15) break;
            }

            if (!found.isEmpty()) {
                sb.append("Найденные товары по запросу пользователя:\n");
                found.values().forEach(p -> {
                    sb.append("  - ").append(p.getName());
                    if (p.getCategory() != null) sb.append(" [").append(p.getCategory().getName()).append("]");
                    sb.append(", цена: ").append(p.getPrice()).append(" сум");
                    if (p.getDiscount() != null && p.getDiscount() > 0)
                        sb.append(", скидка: ").append(p.getDiscount()).append("%");
                    if (p.getStockQuantity() != null)
                        sb.append(", остаток: ").append(p.getStockQuantity());
                    if (p.getDescription() != null && !p.getDescription().isBlank())
                        sb.append(", описание: ").append(p.getDescription());
                    if (p.getCharacteristics() != null && !p.getCharacteristics().isBlank())
                        sb.append(", характеристики: ").append(p.getCharacteristics());
                    sb.append("\n");
                });
            }

            // Clients
            long totalClients = clientRepository.countByStoreId(storeId);
            sb.append("Клиентов: ").append(totalClients).append("\n");

            // Warranties
            long totalWarranties = warrantyRepository.countByStoreId(storeId);
            sb.append("Гарантий выдано: ").append(totalWarranties).append("\n");

            // Employees
            var employees = employeeRepository.findAllByStoreIdAndActiveTrue(storeId);
            sb.append("Сотрудников активных: ").append(employees.size()).append("\n");
            if (!employees.isEmpty()) {
                String names = employees.stream()
                        .map(e -> e.getName() + (e.getPosition() != null ? " (" + e.getPosition() + ")" : ""))
                        .collect(Collectors.joining(", "));
                sb.append("Список: ").append(names).append("\n");
            }

            return sb.toString();
        } catch (Exception e) {
            log.warn("Failed to build store context for AI: {}", e.getMessage());
            return "(данные магазина временно недоступны)\n";
        }
    }

    /**
     * Sends a chat message to OpenRouter and returns the AI reply.
     */
    @Transactional(readOnly = true)
    public String chat(Long storeId, String userMessage,
                        List<com.storeflow.ai.dto.AiChatRequest.HistoryMessage> history) {
        String apiKey = getApiKey(storeId)
                .orElseThrow(() -> new IllegalStateException("OpenRouter API key is not configured"));

        String model = settingRepository.findByStoreIdAndKey(storeId, "openrouter_model")
                .map(s -> s.getValue())
                .filter(v -> v != null && !v.isBlank())
                .orElse(DEFAULT_MODEL);

        String storeContext = buildStoreContext(storeId, userMessage);
        String systemPrompt = BASE_PROMPT + storeContext;
        log.info("AI context for storeId={}: {} chars, preview: {}", storeId, storeContext.length(),
                storeContext.substring(0, Math.min(300, storeContext.length())));

        // Build messages: [system, ...history (last 20 turns), current user]
        var messages = new java.util.ArrayList<Map<String, Object>>();
        messages.add(Map.of("role", "system", "content", systemPrompt));
        if (history != null) {
            int start = Math.max(0, history.size() - 20);
            for (int i = start; i < history.size(); i++) {
                var h = history.get(i);
                if (h.getRole() != null && h.getContent() != null) {
                    messages.add(Map.of("role", h.getRole(), "content", h.getContent()));
                }
            }
        }
        messages.add(Map.of("role", "user", "content", userMessage));

        Map<String, Object> requestBody = Map.of(
                "model", model,
                "messages", messages
        );

        try {
            String jsonBody = objectMapper.writeValueAsString(requestBody);

            HttpURLConnection conn = (HttpURLConnection) new URL(OPENROUTER_URL).openConnection();
            conn.setRequestMethod("POST");
            conn.setRequestProperty("Authorization", "Bearer " + apiKey);
            conn.setRequestProperty("Content-Type", "application/json");
            conn.setRequestProperty("HTTP-Referer", "https://storeflow.app");
            conn.setRequestProperty("X-Title", "StoreFlow AI Assistant");
            conn.setDoOutput(true);
            conn.setConnectTimeout(15000);
            conn.setReadTimeout(30000);

            try (OutputStream os = conn.getOutputStream()) {
                os.write(jsonBody.getBytes(StandardCharsets.UTF_8));
            }

            String responseBody = new String(conn.getInputStream().readAllBytes(), StandardCharsets.UTF_8);
            JsonNode root = objectMapper.readTree(responseBody);

            JsonNode choices = root.path("choices");
            if (choices.isArray() && choices.size() > 0) {
                return choices.get(0).path("message").path("content").asText();
            }
            JsonNode errorNode = root.path("error").path("message");
            if (!errorNode.isMissingNode()) {
                throw new RuntimeException("OpenRouter error: " + errorNode.asText());
            }
            throw new RuntimeException("Unexpected response from OpenRouter");
        } catch (IllegalStateException e) {
            throw e;
        } catch (Exception e) {
            log.error("AI chat request failed: {}", e.getMessage());
            throw new RuntimeException("AI request failed: " + e.getMessage());
        }
    }
}
