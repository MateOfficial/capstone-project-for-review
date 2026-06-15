package com.storeflow.settings.controller;

import com.storeflow.auth.security.PlatformUserDetails;
import com.storeflow.common.dto.ApiResponse;
import com.storeflow.common.exception.BusinessException;
import com.storeflow.settings.entity.ModuleConfig;
import com.storeflow.settings.dto.FactoryResetRequest;
import com.storeflow.settings.service.SettingsService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.IOException;
import java.util.Base64;
import java.util.List;
import java.util.Map;
import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Tag(name = "Settings", description = "Store settings and module configuration")
@RestController
@RequestMapping("/api/admin/settings")
@RequiredArgsConstructor
public class SettingsController {

    private static final int LOGO_MIN_WIDTH = 180;
    private static final int LOGO_MIN_HEIGHT = 180;
    private static final int LOGO_MAX_WIDTH = 3000;
    private static final int LOGO_MAX_HEIGHT = 3000;
    private static final double LOGO_MIN_RATIO = 0.95;
    private static final double LOGO_MAX_RATIO = 1.05;

    private final SettingsService settingsService;

    @Operation(summary = "Get all settings")
    @GetMapping
    @PreAuthorize("hasAuthority('settings.view')")
    public ResponseEntity<ApiResponse<Map<String, String>>> getSettings(
            @AuthenticationPrincipal PlatformUserDetails user) {
        return ResponseEntity.ok(ApiResponse.ok(settingsService.getAllSettings(user.getStoreId())));
    }

    @Operation(summary = "Save settings")
    @PutMapping
    @PreAuthorize("hasAuthority('settings.manage')")
    public ResponseEntity<ApiResponse<Void>> saveSettings(
            @AuthenticationPrincipal PlatformUserDetails user,
            @RequestBody Map<String, String> settings) {
        settingsService.saveSettings(user.getStoreId(), settings);
        return ResponseEntity.ok(ApiResponse.ok(null, "Settings saved"));
    }

    @Operation(summary = "Get module configurations")
    @GetMapping("/modules")
    @PreAuthorize("hasAuthority('settings.view')")
    public ResponseEntity<ApiResponse<List<ModuleConfig>>> getModules(
            @AuthenticationPrincipal PlatformUserDetails user) {
        return ResponseEntity.ok(ApiResponse.ok(settingsService.getModuleConfigs(user.getStoreId())));
    }

    @Operation(summary = "Toggle module")
    @PutMapping("/modules/{moduleCode}")
    @PreAuthorize("hasAuthority('settings.manage')")
    public ResponseEntity<ApiResponse<Void>> toggleModule(
            @AuthenticationPrincipal PlatformUserDetails user,
            @PathVariable String moduleCode,
            @RequestParam boolean enabled) {
        settingsService.updateModuleConfig(user.getStoreId(), moduleCode, enabled);
        return ResponseEntity.ok(ApiResponse.ok(null, "Module updated"));
    }

    @Operation(summary = "Upload company logo (stored as base64)")
    @PostMapping("/logo")
    @PreAuthorize("hasAuthority('settings.manage')")
    public ResponseEntity<ApiResponse<String>> uploadLogo(
            @AuthenticationPrincipal PlatformUserDetails user,
            @RequestParam("file") MultipartFile file) throws IOException {
        validateLogo(file);
        String base64 = "data:" + file.getContentType() + ";base64," +
                Base64.getEncoder().encodeToString(file.getBytes());
        settingsService.saveSetting(user.getStoreId(), "company.logo", base64, "image");
        return ResponseEntity.ok(ApiResponse.ok(base64, "Logo saved"));
    }

    private void validateLogo(MultipartFile file) throws IOException {
        if (file == null || file.isEmpty()) {
            throw new BusinessException("VALIDATION_ERROR", "Файл логотипа не выбран");
        }

        String fileName = file.getOriginalFilename() == null ? "" : file.getOriginalFilename().toLowerCase(Locale.ROOT);
        String contentType = file.getContentType() == null ? "" : file.getContentType().toLowerCase(Locale.ROOT);

        boolean isSvg = fileName.endsWith(".svg") || contentType.contains("svg");
        boolean isPng = fileName.endsWith(".png") || contentType.equals("image/png");
        boolean isJpeg = fileName.endsWith(".jpg") || fileName.endsWith(".jpeg") || contentType.equals("image/jpeg");

        if (!(isSvg || isPng || isJpeg)) {
            throw new BusinessException("VALIDATION_ERROR", "Разрешены только PNG, JPEG или SVG логотипы");
        }

        int width;
        int height;
        if (isSvg) {
            String svg = new String(file.getBytes());
            int[] size = extractSvgSize(svg);
            width = size[0];
            height = size[1];
        } else {
            BufferedImage image = ImageIO.read(file.getInputStream());
            if (image == null) {
                throw new BusinessException("VALIDATION_ERROR", "Не удалось прочитать изображение логотипа");
            }
            width = image.getWidth();
            height = image.getHeight();
        }

        if (width < LOGO_MIN_WIDTH || height < LOGO_MIN_HEIGHT || width > LOGO_MAX_WIDTH || height > LOGO_MAX_HEIGHT) {
            throw new BusinessException(
                    "VALIDATION_ERROR",
                    "Размер логотипа должен быть от " + LOGO_MIN_WIDTH + "x" + LOGO_MIN_HEIGHT +
                            " до " + LOGO_MAX_WIDTH + "x" + LOGO_MAX_HEIGHT + " пикселей"
            );
        }

        double ratio = (double) width / (double) height;
        if (ratio < LOGO_MIN_RATIO || ratio > LOGO_MAX_RATIO) {
            throw new BusinessException("VALIDATION_ERROR", "Принимается только квадратный логотип (соотношение сторон около 1:1)");
        }
    }

    private int[] extractSvgSize(String svgContent) {
        Pattern widthPattern = Pattern.compile("width\\s*=\\s*\"([0-9.]+)");
        Pattern heightPattern = Pattern.compile("height\\s*=\\s*\"([0-9.]+)");
        Matcher widthMatcher = widthPattern.matcher(svgContent);
        Matcher heightMatcher = heightPattern.matcher(svgContent);

        if (widthMatcher.find() && heightMatcher.find()) {
            int width = Math.round(Float.parseFloat(widthMatcher.group(1)));
            int height = Math.round(Float.parseFloat(heightMatcher.group(1)));
            if (width > 0 && height > 0) {
                return new int[]{width, height};
            }
        }

        Pattern viewBoxPattern = Pattern.compile("viewBox\\s*=\\s*\"[0-9.\\-]+\\s+[0-9.\\-]+\\s+([0-9.]+)\\s+([0-9.]+)\"");
        Matcher viewBoxMatcher = viewBoxPattern.matcher(svgContent);
        if (viewBoxMatcher.find()) {
            int width = Math.round(Float.parseFloat(viewBoxMatcher.group(1)));
            int height = Math.round(Float.parseFloat(viewBoxMatcher.group(2)));
            if (width > 0 && height > 0) {
                return new int[]{width, height};
            }
        }

        throw new BusinessException("VALIDATION_ERROR", "SVG должен содержать width/height или viewBox для проверки размеров");
    }

    @Operation(summary = "Factory reset: wipe all store data and return to onboarding")
    @PostMapping("/factory-reset")
    @PreAuthorize("hasAuthority('settings.manage')")
    public ResponseEntity<ApiResponse<Void>> factoryReset(
            @AuthenticationPrincipal PlatformUserDetails user,
            @RequestBody FactoryResetRequest request) {
        settingsService.factoryResetToOnboarding(user.getStoreId(), user.getUserId(), request.getPassword());
        return ResponseEntity.ok(ApiResponse.ok(null, "Factory reset complete. System returned to onboarding."));
    }
}
