package com.storeflow.catalog.dto;

import lombok.Builder;
import lombok.Data;

import java.util.List;

@Data
@Builder
public class ImportResult {
    private int total;
    private int imported;
    private int skipped;
    private List<String> errors;
}
