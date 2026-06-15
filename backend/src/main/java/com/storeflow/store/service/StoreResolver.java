package com.storeflow.store.service;

import com.storeflow.store.entity.Store;
import com.storeflow.store.repository.StoreRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class StoreResolver {

    private final StoreRepository storeRepository;

    public Long resolveStoreId(Long storeId) {
        if (storeId != null) {
            return storeId;
        }
        return storeRepository.findAll().stream()
                .findFirst()
                .map(Store::getId)
                .orElse(1L);
    }
}
