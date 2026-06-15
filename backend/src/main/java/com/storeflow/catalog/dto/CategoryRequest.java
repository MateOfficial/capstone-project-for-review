package com.storeflow.catalog.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class CategoryRequest {
    @NotBlank(message = "Category name is required")
    private String name;
    private String slug;
    private Long parentId;
    private Integer sortOrder;
}
