package com.storeflow.onboarding.dto;

import com.storeflow.auth.dto.CreateUserRequest;
import com.storeflow.hr.dto.EmployeeRequest;
import lombok.Data;

import java.util.List;
import java.util.Map;

@Data
public class OnboardingRequest {
    private StoreProfile storeProfile;
    private Branding branding;
    private CreateUserRequest adminAccount;
    private List<EmployeeRequest> employees;
    private Map<String, Boolean> modules;
    private List<WarrantyDefault> warrantyDefaults;

    @Data
    public static class StoreProfile {
        private String name;
        private String code;
        private String address;
        private String phone;
        private String email;
        private String website;
    }

    @Data
    public static class Branding {
        private String brandName;
        private String logoUrl;
        private String primaryColor;
        private String locale;
        private String currency;
        private String timezone;
    }

    @Data
    public static class WarrantyDefault {
        private String brand;
        private Integer durationMonths;
        private String terms;
    }
}
