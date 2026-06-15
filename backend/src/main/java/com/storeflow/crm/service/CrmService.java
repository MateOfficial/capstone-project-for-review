package com.storeflow.crm.service;

import com.storeflow.common.exception.DuplicateResourceException;
import com.storeflow.common.exception.ResourceNotFoundException;
import com.storeflow.crm.dto.ClientDto;
import com.storeflow.crm.dto.ClientHistoryDto;
import com.storeflow.crm.dto.ClientRequest;
import com.storeflow.crm.entity.Client;
import com.storeflow.crm.repository.ClientRepository;
import com.storeflow.documents.dto.IssuanceActDto;
import com.storeflow.documents.dto.WarrantyDto;
import com.storeflow.documents.repository.IssuanceActRepository;
import com.storeflow.documents.repository.WarrantyRepository;
import com.storeflow.documents.service.DocumentService;
import com.storeflow.store.entity.Store;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class CrmService {

    private final ClientRepository clientRepository;
    private final WarrantyRepository warrantyRepository;
    private final IssuanceActRepository issuanceActRepository;
    private final DocumentService documentService;

    @Transactional(readOnly = true)
    public Page<ClientDto> listClients(Long storeId, Pageable pageable) {
        return clientRepository.findAllByStoreId(storeId, pageable).map(this::toDto);
    }

    @Transactional(readOnly = true)
    public Page<ClientDto> searchClients(Long storeId, String query, Pageable pageable) {
        return clientRepository.search(storeId, query, pageable).map(this::toDto);
    }

    @Transactional(readOnly = true)
    public ClientDto getClient(Long storeId, Long clientId) {
        Client client = clientRepository.findByIdAndStoreId(clientId, storeId)
                .orElseThrow(() -> new ResourceNotFoundException("Client", clientId));
        return toDto(client);
    }

    @Transactional
    public ClientDto createClient(Long storeId, ClientRequest request) {
        if (request.getPhone() != null && !request.getPhone().isBlank()) {
            if (clientRepository.existsByStoreIdAndPhone(storeId, request.getPhone())) {
                throw new DuplicateResourceException("Client", "phone", request.getPhone());
            }
        }

        Store store = new Store();
        store.setId(storeId);

        Client client = Client.builder()
                .store(store)
                .fullName(request.getFullName())
                .phone(request.getPhone())
                .email(request.getEmail())
                .notes(request.getNotes())
                .build();

        client = clientRepository.save(client);
        log.info("Created client: {} for store: {}", client.getFullName(), storeId);
        return toDto(client);
    }

    @Transactional
    public ClientDto updateClient(Long storeId, Long clientId, ClientRequest request) {
        Client client = clientRepository.findByIdAndStoreId(clientId, storeId)
                .orElseThrow(() -> new ResourceNotFoundException("Client", clientId));

        if (request.getPhone() != null && !request.getPhone().equals(client.getPhone())) {
            if (clientRepository.existsByStoreIdAndPhone(storeId, request.getPhone())) {
                throw new DuplicateResourceException("Client", "phone", request.getPhone());
            }
        }

        if (request.getFullName() != null) client.setFullName(request.getFullName());
        if (request.getPhone() != null) client.setPhone(request.getPhone());
        if (request.getEmail() != null) client.setEmail(request.getEmail());
        if (request.getNotes() != null) client.setNotes(request.getNotes());

        client = clientRepository.save(client);
        return toDto(client);
    }

    @Transactional
    public void deleteClient(Long storeId, Long clientId) {
        Client client = clientRepository.findByIdAndStoreId(clientId, storeId)
                .orElseThrow(() -> new ResourceNotFoundException("Client", clientId));
        clientRepository.delete(client);
    }

    public long countClients(Long storeId) {
        return clientRepository.countByStoreId(storeId);
    }

    @Transactional(readOnly = true)
    public ClientHistoryDto getClientHistory(Long storeId, Long clientId) {
        Client client = clientRepository.findByIdAndStoreId(clientId, storeId)
                .orElseThrow(() -> new ResourceNotFoundException("Client", clientId));

        List<WarrantyDto> warranties = warrantyRepository.findAllByClientIdOrderByCreatedAtDesc(clientId)
                .stream().map(documentService::toWarrantyDtoPublic).toList();

        List<IssuanceActDto> acts = issuanceActRepository.findAllByClientIdOrderByCreatedAtDesc(clientId)
                .stream().map(documentService::toIssuanceActDtoPublic).toList();

        return ClientHistoryDto.builder()
                .client(toDto(client))
                .warranties(warranties)
                .issuanceActs(acts)
                .build();
    }

    private ClientDto toDto(Client c) {
        return ClientDto.builder()
                .id(c.getId())
                .fullName(c.getFullName())
                .phone(c.getPhone())
                .email(c.getEmail())
                .notes(c.getNotes())
                .createdAt(c.getCreatedAt())
                .updatedAt(c.getUpdatedAt())
                .build();
    }
}
