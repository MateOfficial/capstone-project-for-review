package com.storeflow.crm.dto;

import com.storeflow.documents.dto.IssuanceActDto;
import com.storeflow.documents.dto.WarrantyDto;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ClientHistoryDto {
    private ClientDto client;
    private List<WarrantyDto> warranties;
    private List<IssuanceActDto> issuanceActs;
}
