package com.storeflow.catalog.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CategoryDto {
    private Long id;
    private String name;
    private String slug;
    private Long parentId;
    private Integer sortOrder;
    private Boolean active;
    private Long productCount;
}
