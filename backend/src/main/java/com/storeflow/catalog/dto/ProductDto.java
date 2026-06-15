package com.storeflow.catalog.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ProductDto {
    private Long id;
    private String code;
    private String name;
    private String searchKey;
    private String description;
    private String detailedDescription;
    private Long categoryId;
    private String categoryName;
    private Long price;
    private Integer discount;
    private Long discountedPrice;
    private Integer stockQuantity;
    private Boolean active;
    private List<String> features;
    private String characteristics;
    private List<ImageDto> images;
    private java.util.Map<String, Integer> warehouseStock;
    private Instant createdAt;
    private Instant updatedAt;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ImageDto {
        private Long id;
        private String url;
        private String altText;
        private Boolean primaryImage;
    }
}
