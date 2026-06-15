package com.storeflow.onboarding.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class OnboardingStatus {
    private boolean initialized;
    private String currentStep;
    private List<String> completedSteps;
    private Long storeId;
}
