package com.storeflow.documents.service;

import com.storeflow.common.exception.ResourceNotFoundException;
import com.storeflow.common.exception.BusinessException;
import com.storeflow.crm.entity.Client;
import com.storeflow.crm.repository.ClientRepository;
import com.storeflow.documents.dto.*;
import com.storeflow.documents.entity.*;
import com.storeflow.documents.repository.*;
import com.storeflow.store.entity.Store;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Locale;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class DocumentService {

    private final WarrantyRepository warrantyRepository;
    private final WarrantyRuleRepository warrantyRuleRepository;
    private final IssuanceActRepository issuanceActRepository;
    private final DocumentTemplateRepository documentTemplateRepository;
    private final ClientRepository clientRepository;

    private static final String READABLE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    private final SecureRandom random = new SecureRandom();

    // ===================== WARRANTIES =====================

    @Transactional
    public WarrantyDto createWarranty(Long storeId, WarrantyRequest request, String ipAddress) {
        Store store = new Store();
        store.setId(storeId);

        Integer duration = request.getDurationMonths();
        if (duration == null && request.getBrand() != null) {
            duration = warrantyRuleRepository.findByStoreIdAndBrand(storeId, request.getBrand().toLowerCase())
                    .map(WarrantyRule::getDurationMonths)
                    .orElse(12);
        }
        if (duration == null) duration = 12;

        Warranty warranty = Warranty.builder()
                .store(store)
                .warrantyNumber(generateWarrantyNumber())
                .model(request.getModel())
                .serialNumber(request.getSerialNumber())
                .brand(request.getBrand())
                .durationMonths(duration)
                .signatureData(request.getSignatureData())
                .ipAddress(ipAddress)
                .expiresAt(Instant.now().plus(Duration.ofDays(duration * 30L)))
                .build();

        String requestClientName = trimToNull(request.getClientName());
        String requestClientPhone = trimToNull(request.getClientPhone());
        warranty.setClientName(requestClientName);
        warranty.setClientPhone(requestClientPhone);

        Client resolvedClient = resolveOrCreateClient(storeId, request.getClientId(), requestClientName, requestClientPhone);
        if (resolvedClient != null) {
            warranty.setClient(resolvedClient);
            if (warranty.getClientName() == null) warranty.setClientName(trimToNull(resolvedClient.getFullName()));
            if (warranty.getClientPhone() == null) warranty.setClientPhone(trimToNull(resolvedClient.getPhone()));
        }

        warranty = warrantyRepository.save(warranty);
        log.info("Created warranty: {} for store: {}", warranty.getWarrantyNumber(), storeId);
        return toWarrantyDto(warranty);
    }

    @Transactional(readOnly = true)
    public Page<WarrantyDto> listWarranties(Long storeId, Pageable pageable) {
        return warrantyRepository.findAllByStoreIdOrderByCreatedAtDesc(storeId, pageable)
                .map(this::toWarrantyDto);
    }

    @Transactional(readOnly = true)
    public Page<WarrantyDto> searchWarranties(Long storeId, String query, Pageable pageable) {
        return warrantyRepository.search(storeId, query, pageable).map(this::toWarrantyDto);
    }

    @Transactional
    public void deleteWarranty(Long storeId, Long warrantyId) {
        Warranty warranty = warrantyRepository.findByIdAndStoreId(warrantyId, storeId)
                .orElseThrow(() -> new ResourceNotFoundException("Warranty", warrantyId));
        warrantyRepository.delete(warranty);
    }

    // ===================== WARRANTY RULES =====================

    @Transactional(readOnly = true)
    public List<WarrantyRuleDto> listWarrantyRules(Long storeId) {
        return warrantyRuleRepository.findAllByStoreId(storeId).stream()
                .map(this::toWarrantyRuleDto)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<WarrantyRuleDto> listActiveWarrantyRules(Long storeId) {
        return warrantyRuleRepository.findAllByStoreIdAndActiveTrue(storeId).stream()
                .map(this::toWarrantyRuleDto)
                .collect(Collectors.toList());
    }

    @Transactional
    public WarrantyRuleDto saveWarrantyRule(Long storeId, WarrantyRuleDto dto) {
        String normalizedBrand = dto.getBrand() == null ? "" : dto.getBrand().trim().toLowerCase(Locale.ROOT);
        if (normalizedBrand.isEmpty()) {
            throw new BusinessException("VALIDATION_ERROR", "Brand is required");
        }

        int normalizedDuration = dto.getDurationMonths() == null || dto.getDurationMonths() < 1
                ? 12
                : dto.getDurationMonths();

        WarrantyRule rule = warrantyRuleRepository.findByStoreIdAndBrand(storeId, normalizedBrand)
                .orElseGet(() -> {
                    Store store = new Store();
                    store.setId(storeId);
                    return WarrantyRule.builder().store(store).brand(normalizedBrand).build();
                });

        rule.setDurationMonths(normalizedDuration);
        rule.setTerms(dto.getTerms());
        if (dto.getActive() != null) rule.setActive(dto.getActive());

        rule = warrantyRuleRepository.save(rule);
        return toWarrantyRuleDto(rule);
    }

    // ===================== ISSUANCE ACTS =====================

    @Transactional
    public IssuanceActDto createIssuanceAct(Long storeId, IssuanceActRequest request, String ipAddress) {
        Store store = new Store();
        store.setId(storeId);

        IssuanceAct act = IssuanceAct.builder()
                .store(store)
                .actNumber("ACT-" + System.currentTimeMillis())
                .model(request.getModel())
                .serialNumber(request.getSerialNumber())
                .price(request.getPrice())
                .returnDate(request.getReturnDate())
                .clientName(trimToNull(request.getClientName()))
                .clientPhone(trimToNull(request.getClientPhone()))
                .condition(request.getCondition())
                .completeness(request.getCompleteness())
                .notes(request.getNotes())
                .signatureData(request.getSignatureData())
                .ipAddress(ipAddress)
                .build();

        Client resolvedClient = resolveOrCreateClient(
                storeId,
                request.getClientId(),
                trimToNull(request.getClientName()),
                trimToNull(request.getClientPhone())
        );
        if (resolvedClient != null) {
            act.setClient(resolvedClient);
            if (act.getClientName() == null || act.getClientName().isBlank()) {
                act.setClientName(trimToNull(resolvedClient.getFullName()));
            }
            if (act.getClientPhone() == null || act.getClientPhone().isBlank()) {
                act.setClientPhone(trimToNull(resolvedClient.getPhone()));
            }
        }

        act = issuanceActRepository.save(act);
        return toIssuanceActDto(act);
    }

    @Transactional(readOnly = true)
    public Page<IssuanceActDto> listIssuanceActs(Long storeId, Pageable pageable) {
        return issuanceActRepository.findAllByStoreIdOrderByCreatedAtDesc(storeId, pageable)
                .map(this::toIssuanceActDto);
    }

    @Transactional
    public void deleteIssuanceAct(Long storeId, Long actId) {
        IssuanceAct act = issuanceActRepository.findByIdAndStoreId(actId, storeId)
                .orElseThrow(() -> new ResourceNotFoundException("IssuanceAct", actId));
        issuanceActRepository.delete(act);
    }

    // ===================== TEMPLATES =====================

    @Transactional(readOnly = true)
    public List<DocumentTemplateDto> listTemplates(Long storeId, String type) {
        return documentTemplateRepository.findAllByStoreIdAndType(storeId, type).stream()
                .map(this::toTemplateDto)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public DocumentTemplateDto getPublishedTemplate(Long storeId, String type) {
        return documentTemplateRepository.findByStoreIdAndTypeAndStatus(storeId, type, "published")
                .map(this::toTemplateDto)
                .orElse(null);
    }

    @Transactional
    public DocumentTemplateDto saveTemplate(Long storeId, DocumentTemplateDto dto) {
        Store store = new Store();
        store.setId(storeId);

        DocumentTemplate template;
        if (dto.getId() != null) {
            template = documentTemplateRepository.findByIdAndStoreId(dto.getId(), storeId)
                    .orElseThrow(() -> new ResourceNotFoundException("DocumentTemplate", dto.getId()));
            template.setName(dto.getName());
            template.setContent(dto.getContent());
        } else {
            template = DocumentTemplate.builder()
                    .store(store)
                    .type(dto.getType())
                    .name(dto.getName())
                    .content(dto.getContent())
                    .status("draft")
                    .build();
        }

        template = documentTemplateRepository.save(template);
        return toTemplateDto(template);
    }

    @Transactional
    public DocumentTemplateDto publishTemplate(Long storeId, Long templateId) {
        DocumentTemplate template = documentTemplateRepository.findByIdAndStoreId(templateId, storeId)
                .orElseThrow(() -> new ResourceNotFoundException("DocumentTemplate", templateId));

        // Archive current published version of same type
        documentTemplateRepository.findByStoreIdAndTypeAndStatus(storeId, template.getType(), "published")
                .ifPresent(old -> {
                    old.setStatus("archived");
                    documentTemplateRepository.save(old);
                });

        template.setStatus("published");
        template.setPublishedAt(Instant.now());
        template.setVersion(template.getVersion() + 1);
        template = documentTemplateRepository.save(template);
        return toTemplateDto(template);
    }

    // ===================== HELPERS =====================

    public WarrantyDto toWarrantyDtoPublic(Warranty w) {
        return toWarrantyDto(w);
    }

    public IssuanceActDto toIssuanceActDtoPublic(IssuanceAct a) {
        return toIssuanceActDto(a);
    }

    private String generateWarrantyNumber() {
        StringBuilder sb = new StringBuilder("W-");
        for (int i = 0; i < 6; i++) {
            sb.append(READABLE_CHARS.charAt(random.nextInt(READABLE_CHARS.length())));
        }
        return sb.toString();
    }

    private Client resolveOrCreateClient(Long storeId, Long clientId, String clientName, String clientPhone) {
        if (clientId != null) {
            return clientRepository.findByIdAndStoreId(clientId, storeId).orElse(null);
        }

        String normalizedName = trimToNull(clientName);
        String normalizedPhone = trimToNull(clientPhone);
        if (normalizedName == null && normalizedPhone == null) {
            return null;
        }

        if (normalizedPhone != null) {
            Client existing = clientRepository.findByStoreIdAndPhone(storeId, normalizedPhone).orElse(null);
            if (existing != null) {
                if ((existing.getFullName() == null || existing.getFullName().isBlank()) && normalizedName != null) {
                    existing.setFullName(normalizedName);
                    return clientRepository.save(existing);
                }
                return existing;
            }
        }

        Store store = new Store();
        store.setId(storeId);
        return clientRepository.save(Client.builder()
                .store(store)
                .fullName(normalizedName != null ? normalizedName : "Клиент")
                .phone(normalizedPhone)
                .build());
    }

    private String trimToNull(String value) {
        if (value == null) return null;
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private WarrantyDto toWarrantyDto(Warranty w) {
        return WarrantyDto.builder()
                .id(w.getId())
                .warrantyNumber(w.getWarrantyNumber())
                .model(w.getModel())
                .serialNumber(w.getSerialNumber())
                .brand(w.getBrand())
                .durationMonths(w.getDurationMonths())
                .clientId(w.getClient() != null ? w.getClient().getId() : null)
                .clientName(w.getClientName() != null ? w.getClientName() : (w.getClient() != null ? w.getClient().getFullName() : null))
                .clientPhone(w.getClientPhone() != null ? w.getClientPhone() : (w.getClient() != null ? w.getClient().getPhone() : null))
                .signatureData(w.getSignatureData())
                .expiresAt(w.getExpiresAt())
                .createdAt(w.getCreatedAt())
                .build();
    }

    private WarrantyRuleDto toWarrantyRuleDto(WarrantyRule r) {
        return WarrantyRuleDto.builder()
                .id(r.getId())
                .brand(r.getBrand())
                .durationMonths(r.getDurationMonths())
                .terms(r.getTerms())
                .active(r.getActive())
                .build();
    }

    private IssuanceActDto toIssuanceActDto(IssuanceAct a) {
        return IssuanceActDto.builder()
                .id(a.getId())
                .actNumber(a.getActNumber())
                .model(a.getModel())
                .serialNumber(a.getSerialNumber())
                .price(a.getPrice())
                .returnDate(a.getReturnDate())
                .clientId(a.getClient() != null ? a.getClient().getId() : null)
                .clientName(a.getClientName())
                .clientPhone(a.getClientPhone())
                .condition(a.getCondition())
                .completeness(a.getCompleteness())
                .notes(a.getNotes())
                .signatureData(a.getSignatureData())
                .status(a.getStatus())
                .createdAt(a.getCreatedAt())
                .build();
    }

    private DocumentTemplateDto toTemplateDto(DocumentTemplate t) {
        return DocumentTemplateDto.builder()
                .id(t.getId())
                .type(t.getType())
                .name(t.getName())
                .version(t.getVersion())
                .content(t.getContent())
                .status(t.getStatus())
                .publishedAt(t.getPublishedAt())
                .createdAt(t.getCreatedAt())
                .updatedAt(t.getUpdatedAt())
                .build();
    }
}
