package com.storeflow.integration.util;

/**
 * Fuzzy string matching for 1С SKU normalization.
 * Strips spaces/dashes, normalizes digits, computes similarity 0.0–1.0.
 */
public final class FuzzyMatcher {

    private FuzzyMatcher() {}

    /** Returns similarity score 0.0 (no match) to 1.0 (exact). */
    public static double similarity(String a, String b) {
        if (a == null || b == null) return 0.0;
        String na = normalize(a);
        String nb = normalize(b);
        if (na.isEmpty() && nb.isEmpty()) return 1.0;
        if (na.isEmpty() || nb.isEmpty()) return 0.0;
        if (na.equals(nb)) return 1.0;

        // Check if one contains the other (partial match bonus)
        if (na.contains(nb) || nb.contains(na)) {
            int longer = Math.max(na.length(), nb.length());
            int shorter = Math.min(na.length(), nb.length());
            return 0.7 + 0.3 * ((double) shorter / longer);
        }

        int dist = levenshtein(na, nb);
        int maxLen = Math.max(na.length(), nb.length());
        return 1.0 - (double) dist / maxLen;
    }

    /** Normalize: lowercase, remove spaces/dashes/dots, collapse repeated chars variant. */
    public static String normalize(String s) {
        if (s == null) return "";
        return s.toLowerCase()
                .replaceAll("[\\s\\-_./]", "")   // remove separators
                .replaceAll("([a-z])\\s*([0-9])", "$1$2")  // "tlm 103" → "tlm103"
                .replaceAll("([0-9])\\s*([a-z])", "$1$2");
    }

    private static int levenshtein(String a, String b) {
        int la = a.length(), lb = b.length();
        int[][] dp = new int[la + 1][lb + 1];
        for (int i = 0; i <= la; i++) dp[i][0] = i;
        for (int j = 0; j <= lb; j++) dp[0][j] = j;
        for (int i = 1; i <= la; i++) {
            for (int j = 1; j <= lb; j++) {
                int cost = a.charAt(i - 1) == b.charAt(j - 1) ? 0 : 1;
                dp[i][j] = Math.min(Math.min(dp[i-1][j] + 1, dp[i][j-1] + 1), dp[i-1][j-1] + cost);
            }
        }
        return dp[la][lb];
    }
}
