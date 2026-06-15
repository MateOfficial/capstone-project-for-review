package com.storeflow.documents.service;

import com.openhtmltopdf.pdfboxout.PdfRendererBuilder;
import com.storeflow.common.exception.ResourceNotFoundException;
import com.storeflow.documents.entity.Warranty;
import com.storeflow.documents.entity.IssuanceAct;
import com.storeflow.documents.repository.WarrantyRepository;
import com.storeflow.documents.repository.IssuanceActRepository;
import com.storeflow.store.entity.Store;
import com.storeflow.store.repository.StoreRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.thymeleaf.TemplateEngine;
import org.thymeleaf.context.Context;

import java.io.ByteArrayOutputStream;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.Locale;

@Service
@RequiredArgsConstructor
public class PdfGenerationService {

    private final TemplateEngine templateEngine;
    private final WarrantyRepository warrantyRepository;
    private final IssuanceActRepository issuanceActRepository;
    private final StoreRepository storeRepository;

    private static final DateTimeFormatter DATE_FMT = DateTimeFormatter.ofPattern("dd.MM.yyyy");

    public byte[] generateWarrantyCard(Long storeId, Long warrantyId) {
        Warranty w = warrantyRepository.findByIdAndStoreId(warrantyId, storeId)
                .orElseThrow(() -> new ResourceNotFoundException("Warranty", warrantyId));
        Store store = storeRepository.findById(storeId)
                .orElseThrow(() -> new ResourceNotFoundException("Store", storeId));

        Context ctx = new Context(new Locale("ru"));
        ctx.setVariable("store", store);
        ctx.setVariable("warranty", w);
        ctx.setVariable("number", w.getWarrantyNumber());
        ctx.setVariable("product", w.getModel());
        ctx.setVariable("serial", w.getSerialNumber());
        ctx.setVariable("client", w.getClient() != null ? w.getClient().getFullName() : "—");
        ctx.setVariable("phone", w.getClient() != null ? w.getClient().getPhone() : "—");
        ctx.setVariable("purchaseDate", w.getCreatedAt() != null
                ? w.getCreatedAt().atZone(ZoneId.systemDefault()).format(DATE_FMT) : "—");
        ctx.setVariable("expirationDate", w.getExpiresAt() != null
                ? w.getExpiresAt().atZone(ZoneId.systemDefault()).format(DATE_FMT) : "—");
        ctx.setVariable("duration", w.getDurationMonths());
        ctx.setVariable("brand", w.getBrand());

        String html = templateEngine.process("warranty-card", ctx);
        return renderPdf(html);
    }

    public byte[] generateIssuanceAct(Long storeId, Long actId) {
        IssuanceAct act = issuanceActRepository.findByIdAndStoreId(actId, storeId)
                .orElseThrow(() -> new ResourceNotFoundException("IssuanceAct", actId));
        Store store = storeRepository.findById(storeId)
                .orElseThrow(() -> new ResourceNotFoundException("Store", storeId));

        Context ctx = new Context(new Locale("ru"));
        ctx.setVariable("store", store);
        ctx.setVariable("act", act);
        ctx.setVariable("actNumber", act.getActNumber());
        ctx.setVariable("client", act.getClientName());
        ctx.setVariable("phone", act.getClientPhone());
        ctx.setVariable("items", act.getModel());
        ctx.setVariable("total", act.getPrice() != null ? new java.math.BigDecimal(act.getPrice().replaceAll("[^0-9]", "").isEmpty() ? "0" : act.getPrice().replaceAll("[^0-9]", "")) : java.math.BigDecimal.ZERO);
        ctx.setVariable("notes", act.getNotes());

        String html = templateEngine.process("issuance-act", ctx);
        return renderPdf(html);
    }

    private byte[] renderPdf(String html) {
        try (ByteArrayOutputStream os = new ByteArrayOutputStream()) {
            PdfRendererBuilder builder = new PdfRendererBuilder();
            builder.withHtmlContent(html, "/");
            builder.toStream(os);
            builder.run();
            return os.toByteArray();
        } catch (Exception e) {
            throw new RuntimeException("PDF generation failed", e);
        }
    }
}
