package com.storeflow.common.util;

import java.util.HashMap;
import java.util.Locale;
import java.util.Map;

public final class SlugUtils {

    private static final Map<Character, String> CYR_TO_LAT = new HashMap<>();

    static {
        CYR_TO_LAT.put('а', "a");
        CYR_TO_LAT.put('б', "b");
        CYR_TO_LAT.put('в', "v");
        CYR_TO_LAT.put('г', "g");
        CYR_TO_LAT.put('д', "d");
        CYR_TO_LAT.put('е', "e");
        CYR_TO_LAT.put('ё', "e");
        CYR_TO_LAT.put('ж', "zh");
        CYR_TO_LAT.put('з', "z");
        CYR_TO_LAT.put('и', "i");
        CYR_TO_LAT.put('й', "y");
        CYR_TO_LAT.put('к', "k");
        CYR_TO_LAT.put('л', "l");
        CYR_TO_LAT.put('м', "m");
        CYR_TO_LAT.put('н', "n");
        CYR_TO_LAT.put('о', "o");
        CYR_TO_LAT.put('п', "p");
        CYR_TO_LAT.put('р', "r");
        CYR_TO_LAT.put('с', "s");
        CYR_TO_LAT.put('т', "t");
        CYR_TO_LAT.put('у', "u");
        CYR_TO_LAT.put('ф', "f");
        CYR_TO_LAT.put('х', "h");
        CYR_TO_LAT.put('ц', "ts");
        CYR_TO_LAT.put('ч', "ch");
        CYR_TO_LAT.put('ш', "sh");
        CYR_TO_LAT.put('щ', "sch");
        CYR_TO_LAT.put('ъ', "");
        CYR_TO_LAT.put('ы', "y");
        CYR_TO_LAT.put('ь', "");
        CYR_TO_LAT.put('э', "e");
        CYR_TO_LAT.put('ю', "yu");
        CYR_TO_LAT.put('я', "ya");
    }

    private SlugUtils() {
    }

    public static String normalizeSlug(String source) {
        if (source == null || source.isBlank()) {
            return "item";
        }

        StringBuilder transliterated = new StringBuilder();
        for (char ch : source.toLowerCase(Locale.ROOT).toCharArray()) {
            if (CYR_TO_LAT.containsKey(ch)) {
                transliterated.append(CYR_TO_LAT.get(ch));
            } else {
                transliterated.append(ch);
            }
        }

        String slug = transliterated.toString()
                .replaceAll("[^a-z0-9]+", "-")
                .replaceAll("-+", "-")
                .replaceAll("^-|-$", "");

        return slug.isBlank() ? "item" : slug;
    }
}