package com.storeflow.common.util;

public final class ProductNameNormalizer {

    private ProductNameNormalizer() {
    }

    public static String normalize(String source) {
        if (source == null) {
            return "";
        }

        String value = source.trim().replaceAll("\\s+", " ");

        // D SP 4SEU -> DSP4SEU
        value = value.replaceFirst("(?i)^([a-z])\\s+([a-z]{1,4})\\s+(\\d[a-z0-9-]*)", "$1$2$3");
        // C LP735B / Y DP65 / A 1031-U -> CLP735B / YDP65 / A1031-U
        value = value.replaceFirst("(?i)^([a-z])\\s+([a-z0-9-]*\\d[a-z0-9-]*)", "$1$2");
        // DBR1 0 -> DBR10
        value = value.replaceFirst("(?i)^([a-z0-9-]*\\d)\\s+(\\d+)(\\b|$)", "$1$2$3");
        // CSP150 B -> CSP150B
        value = value.replaceFirst("(?i)^([a-z0-9-]*\\d[a-z0-9-]*)\\s+([a-z])(\\b|$)", "$1$2$3");

        String[] parts = value.split(" ", 2);
        if (parts.length > 0 && parts[0].matches(".*[A-Za-z].*")) {
            parts[0] = parts[0].toUpperCase();
            value = parts.length > 1 ? parts[0] + " " + parts[1] : parts[0];
        }

        return value;
    }
}