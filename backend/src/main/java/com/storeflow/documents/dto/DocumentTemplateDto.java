package com.storeflow.documents.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DocumentTemplateDto {
    private Long id;
    private String type;
    private String name;
    private Integer version;
    private String content;
    private String status;
    private Instant publishedAt;
    private Instant createdAt;
    private Instant updatedAt;
}
