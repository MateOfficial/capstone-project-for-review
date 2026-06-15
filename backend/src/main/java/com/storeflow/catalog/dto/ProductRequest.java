package com.storeflow.catalog.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

import java.util.List;

@Data
public class ProductRequest {
    private String code;

    @NotBlank(message = "Product name is required")
    private String name;

    private String searchKey;
    private String description;
    private String detailedDescription;
    private Long categoryId;
    private Long price;
    private Integer discount;
    private Integer stockQuantity;
    private List<String> features;
    private String characteristics;
}
