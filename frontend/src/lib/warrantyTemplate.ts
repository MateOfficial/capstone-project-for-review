export const WARRANTY_TEMPLATE_TYPE = 'warranty';

export const SIMPLE_WARRANTY_TEMPLATE_MODE = 'simple-v1';

export type WarrantyLayoutMode = 'preset' | 'custom';

export interface WarrantyTextBlock {
  id: string;
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number;
  fontWeight?: number;
  textAlign?: 'left' | 'center' | 'right';
}

export interface WarrantyFieldPlacement {
  x: number;
  y: number;
  fontSize: number;
  rotation?: number;
}

export interface WarrantyTemplateConfig {
  brandSubtitle: string;
  headerTitleEn: string;
  headerTitleRu: string;
  serviceLabel: string;
  serviceLocation: string;
  obligationText: string;
  termsTitle: string;
  sellerSignatureLabel: string;
  stampLabel: string;
  layoutMode: WarrantyLayoutMode;
  backgroundImage: string;
  textBlocks: WarrantyTextBlock[];
  modelPlacement: WarrantyFieldPlacement;
  serialPlacement: WarrantyFieldPlacement;
  idPlacement: WarrantyFieldPlacement;
  startDatePlacement: WarrantyFieldPlacement;
  endDatePlacement: WarrantyFieldPlacement;
}

export interface StoredSimpleWarrantyTemplate {
  mode: typeof SIMPLE_WARRANTY_TEMPLATE_MODE;
  config: WarrantyTemplateConfig;
}

export function createDefaultWarrantyBackground(): string {
  const svg = `
  <svg xmlns="http://www.w3.org/2000/svg" width="1240" height="1754" viewBox="0 0 1240 1754">
    <defs>
      <linearGradient id="paper" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#fffdf8"/>
        <stop offset="100%" stop-color="#f6f0e4"/>
      </linearGradient>
    </defs>
    <rect width="1240" height="1754" fill="url(#paper)"/>
    <rect x="40" y="40" width="1160" height="1674" rx="24" fill="none" stroke="#111827" stroke-width="5"/>
    <line x1="72" y1="255" x2="1168" y2="255" stroke="#111827" stroke-width="7"/>
    <rect x="72" y="290" width="1096" height="160" rx="12" fill="#fffaf0" stroke="#111827" stroke-width="3"/>
    <rect x="72" y="475" width="1096" height="230" rx="12" fill="#fffefa" stroke="#111827" stroke-width="4"/>
    <line x1="620" y1="475" x2="620" y2="705" stroke="#111827" stroke-width="3"/>
    <line x1="72" y1="590" x2="1168" y2="590" stroke="#111827" stroke-width="3"/>
    <line x1="72" y1="705" x2="1168" y2="705" stroke="#111827" stroke-width="5"/>
    <rect x="72" y="740" width="1096" height="710" rx="12" fill="#fffefa" stroke="#111827" stroke-width="3"/>
    <line x1="72" y1="1485" x2="1168" y2="1485" stroke="#111827" stroke-width="6"/>
    <rect x="72" y="1515" width="430" height="155" rx="12" fill="#fffefa" stroke="#111827" stroke-width="3"/>
    <rect x="738" y="1515" width="430" height="155" rx="12" fill="#fffefa" stroke="#111827" stroke-width="3" stroke-dasharray="12 10"/>
    <circle cx="953" cy="1590" r="56" fill="none" stroke="#94a3b8" stroke-width="3" stroke-dasharray="10 8"/>
  </svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

export const DEFAULT_WARRANTY_TEMPLATE_CONFIG: WarrantyTemplateConfig = {
  brandSubtitle: '',
  headerTitleEn: '',
  headerTitleRu: '',
  serviceLabel: '',
  serviceLocation: '',
  obligationText: '',
  termsTitle: '',
  sellerSignatureLabel: '',
  stampLabel: '',
  layoutMode: 'custom',
  backgroundImage: '',
  textBlocks: [],
  modelPlacement: { x: 18, y: 38, fontSize: 18, rotation: 0 },
  serialPlacement: { x: 18, y: 46, fontSize: 17, rotation: 0 },
  idPlacement: { x: 18, y: 54, fontSize: 19, rotation: 0 },
  startDatePlacement: { x: 71, y: 38, fontSize: 16, rotation: 0 },
  endDatePlacement: { x: 71, y: 46, fontSize: 16, rotation: 0 },
};

export const DEFAULT_WARRANTY_TEMPLATE = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Warranty card - {{TITLE_ID}}</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
  <style>
    :root { --showpro-red: #ff4c4c; }
    * { margin: 0; padding: 0; box-sizing: border-box; font-family: 'Inter', sans-serif; }
    html, body { background-color: white; color: black; width: 210mm; display: flex; justify-content: center; }
    .a4-page { width: 210mm; min-height: 297mm; padding: 12mm; display: flex; flex-direction: column; }
    @media print { @page { margin: 0; size: A4; } .a4-page { padding: 12mm; } }
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 5mm; height: 120px; }
    .brand-logo { display: flex; flex-direction: column; align-items: flex-start; width: 250px; }
    .brand-img-wrap { height: 95px; width: 250px; display: flex; align-items: flex-end; margin-bottom: 5px; }
    .brand-img { max-height: 90px; max-width: 250px; width: auto; display: block; object-fit: contain; mix-blend-mode: multiply; {{LOGO_STYLE}} }
    .brand-sub { font-size: 17px; font-weight: 800; letter-spacing: 1.5px; border-top: 2.5px solid black; display: inline-block; padding-top: 2px; }
    .header-title { text-align: center; flex: 1; padding: 0 5px; margin-top: 10px; }
    .header-title h1 { font-size: 20px; font-weight: 800; text-transform: uppercase; line-height: 1.1; white-space: nowrap; }
    .header-title p { font-size: 14px; font-weight: 700; margin-top: 2px; white-space: nowrap; }
    .service-info { text-align: right; width: 250px; margin-top: 10px; }
    .service-info .label { color: var(--showpro-red); font-size: 8px; font-weight: 800; text-transform: uppercase; margin-bottom: 2px; }
    .service-info p:not(.label) { font-size: 10px; font-weight: 800; text-transform: uppercase; }
    .header-divider { border-top: 3.5px solid black; margin-bottom: 3mm; }
    .obligation-box { border: 1.5px solid black; padding: 2.5mm 4mm; font-size: 8.5px; line-height: 1.3; text-align: justify; margin-bottom: 2mm; }
    .info-grid { border: 2px solid black; display: grid; grid-template-columns: 1fr 1fr; margin-bottom: 2mm; }
    .field-item { padding: 2mm 6mm; display: flex; align-items: center; font-size: 13px; height: 10.5mm; overflow: hidden; }
    .f-label { font-weight: 800; text-transform: uppercase; width: 90px; flex-shrink: 0; }
    .f-divider { margin: 0 10px; flex-shrink: 0; }
    .f-value { font-weight: 900; font-size: 14px; flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .terms-title { text-align: center; margin-bottom: 3mm; }
    .terms-title h2 { font-size: 14px; font-weight: 900; text-transform: uppercase; text-decoration: underline; display: inline-block; }
    .terms-content { font-size: 8.8px; font-weight: 500; line-height: 1.5; text-align: justify; flex-grow: 1; }
    .terms-content ul, .terms-content ol { padding-left: 15px; }
    .terms-content li { margin-bottom: 0.7mm; }
    .terms-custom { white-space: pre-line; }
    .footer-divider { border-top: 3px solid black; margin: 3mm 0; }
    .footer { display: flex; justify-content: space-between; align-items: flex-end; margin-top: -8mm; }
    .signature-area { text-align: left; }
    .sig-image-placeholder { width: 220px; height: 60px; margin-bottom: 1px; display: flex; align-items: center; }
    .sig-image { max-width: 100%; max-height: 100%; object-fit: contain; }
    .sig-line { border-top: 2.5px solid black; padding-top: 1px; font-size: 10px; font-weight: 900; text-transform: uppercase; width: 220px; margin-top: -3px; }
  </style>
</head>
<body>
  <div class="a4-page">
    <header class="header">
      <div class="brand-logo">
        <div class="brand-img-wrap"><img src="{{LOGO_URL}}" class="brand-img" alt="{{BRAND_UPPER}}"></div>
        <div class="brand-sub">{{BRAND_SUBTITLE}}</div>
      </div>
      <div class="header-title">
        <h1>{{HEADER_TITLE_EN}}</h1>
        <p>{{HEADER_TITLE_RU}}</p>
      </div>
      <div class="service-info">
        <p class="label">{{SERVICE_LABEL}}</p>
        <p>{{SERVICE_LOCATION}}</p>
      </div>
    </header>

    <div class="header-divider"></div>

    <div class="obligation-box">{{OBLIGATION_HTML}}</div>

    <div class="info-grid">
      <div class="field-item"><span class="f-label">Model:</span><span class="f-divider">|</span><span class="f-value">{{MODEL}}</span></div>
      <div class="field-item"><span class="f-label">Date:</span><span class="f-divider">|</span><span class="f-value">{{START_DATE}}</span></div>
      <div class="field-item" style="border-top: 1px solid black;"><span class="f-label">Serial No:</span><span class="f-divider">|</span><span class="f-value">{{SERIAL_NUMBER}}</span></div>
      <div class="field-item" style="border-top: 1px solid black;"><span class="f-label">Expiry:</span><span class="f-divider">|</span><span class="f-value">{{END_DATE}}</span></div>
      <div class="field-item" style="border-top: 2px solid black; grid-column: span 2;"><span class="f-label">ID:</span><span class="f-divider">|</span><span class="f-value" style="font-size: 14px;">{{WARRANTY_ID}}</span></div>
    </div>

    <div class="terms-title"><h2>{{TERMS_TITLE}}</h2></div>
    <div class="terms-content">{{TERMS_HTML}}</div>

    <div class="footer-divider"></div>

    <footer class="footer">
      <div class="signature-area">
        <div class="sig-image-placeholder">{{SIGNATURE_HTML}}</div>
        <div class="sig-line">{{SELLER_SIGNATURE_LABEL}}</div>
      </div>
    </footer>
  </div>
</body>
</html>`;

export function renderWarrantyTemplate(templateHtml: string, values: Record<string, string>): string {
  return templateHtml.replace(/{{\s*([A-Z0-9_]+)\s*}}/g, (_, key: string) => values[key] ?? '');
}

export function renderCustomWarrantyLayout(values: Record<string, string>, config: WarrantyTemplateConfig): string {
  const esc = (value: unknown) => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

  const background = config.backgroundImage || '';
  const model = config.modelPlacement;
  const serial = config.serialPlacement;
  const id = config.idPlacement;
  const startDate = config.startDatePlacement;
  const endDate = config.endDatePlacement;
  const brandLogoUrl = String(values.BRAND_LOGO_URL || '');
  const brandLogoX = Number(values.BRAND_LOGO_X || 10);
  const brandLogoY = Number(values.BRAND_LOGO_Y || 8);
  const brandLogoWidth = Number(values.BRAND_LOGO_WIDTH || 20);
  const brandLogoHeight = Number(values.BRAND_LOGO_HEIGHT || 10);
  const isPreset = config.layoutMode === 'preset';
  const replacements: Record<string, string> = {
    brandName: String(values.BRAND_NAME || values.BRAND_UPPER || ''),
    durationMonths: String(values.DURATION_MONTHS || ''),
    model: String(values.MODEL || ''),
    serialNumber: String(values.SERIAL_NUMBER || ''),
    warrantyId: String(values.WARRANTY_ID || ''),
    startDate: String(values.START_DATE || ''),
    endDate: String(values.END_DATE || ''),
    warrantyTerms: String(values.WARRANTY_TERMS_TEXT || ''),
  };
  const renderTextBlockText = (template: string) => {
    const escaped = esc(template).replace(/\n/g, '<br/>');
    return escaped.replace(/\{(brandName|durationMonths|model|serialNumber|warrantyId|startDate|endDate|warrantyTerms)\}/g, (_, key: string) => {
      if (key === 'warrantyTerms') {
        return esc(replacements[key] || '').replace(/\n/g, '<br/>');
      }
      return esc(replacements[key] || '');
    });
  };
  const textBlocksHtml = (config.textBlocks || [])
    .map((block) => `
      <div
        class="text-block"
        style="left:${block.x}%;top:${block.y}%;width:${block.width}%;height:${block.height}%;font-size:${block.fontSize}px;font-weight:${block.fontWeight ?? 500};text-align:${block.textAlign ?? 'left'};"
      >${renderTextBlockText(block.text)}</div>`)
    .join('');

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Warranty card - ${esc(values.WARRANTY_ID || values.TITLE_ID || '')}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body { background: #fff; width: 210mm; min-height: 297mm; }
    @page { size: A4; margin: 0; }
    .a4 {
      position: relative;
      width: 210mm;
      height: 297mm;
      overflow: hidden;
      color: #111;
      font-family: 'Inter', Arial, Helvetica, sans-serif;
      font-weight: 700;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .bg {
      position: absolute;
      inset: 0;
      background: ${background ? `url('${esc(background)}') center/contain no-repeat` : '#fff'};
    }
    .field {
      position: absolute;
      white-space: nowrap;
      line-height: 1.1;
      text-shadow: 0 0 1px rgba(255,255,255,0.45);
      transform-origin: center;
      z-index: 3;
    }
    .brand-logo {
      position: absolute;
      z-index: 2;
      object-fit: contain;
    }
    .text-block {
      position: absolute;
      overflow: hidden;
      white-space: pre-wrap;
      word-break: break-word;
      line-height: 1.35;
      color: #111;
      z-index: 2;
    }
    .preset-shell { position: absolute; inset: 0; padding: 11mm 12mm; z-index: 2; }
    .preset-header { display: flex; justify-content: space-between; align-items: flex-start; height: 48mm; }
    .preset-brand { width: 64mm; display: flex; flex-direction: column; gap: 3px; }
    .preset-brand img { max-width: 60mm; max-height: 21mm; object-fit: contain; }
    .preset-brand-sub { font-size: 13px; font-weight: 800; letter-spacing: 1.2px; border-top: 2px solid #111; padding-top: 2px; display: inline-block; }
    .preset-title { flex: 1; text-align: center; padding: 4mm 4mm 0; }
    .preset-title h1 { font-size: 19px; font-weight: 900; text-transform: uppercase; line-height: 1.1; }
    .preset-title p { font-size: 13px; font-weight: 700; margin-top: 1px; }
    .preset-service { width: 64mm; text-align: right; padding-top: 4mm; }
    .preset-service .label { color: #b91c1c; font-size: 8px; font-weight: 900; text-transform: uppercase; }
    .preset-service .value { font-size: 10px; font-weight: 800; margin-top: 2px; text-transform: uppercase; }
    .preset-label { position: absolute; font-size: 11px; font-weight: 800; text-transform: uppercase; z-index: 2; }
    .label-model { left: 18mm; top: 83mm; }
    .label-date { left: 111mm; top: 83mm; }
    .label-serial { left: 18mm; top: 102mm; }
    .label-expiry { left: 111mm; top: 102mm; }
    .label-id { left: 18mm; top: 122mm; }
    .model { left: ${model.x}%; top: ${model.y}%; font-size: ${model.fontSize}px; transform: translate(-50%, -50%) rotate(${model.rotation ?? 0}deg); transform-origin: center; }
    .serial { left: ${serial.x}%; top: ${serial.y}%; font-size: ${serial.fontSize}px; transform: translate(-50%, -50%) rotate(${serial.rotation ?? 0}deg); transform-origin: center; }
    .wid { left: ${id.x}%; top: ${id.y}%; font-size: ${id.fontSize}px; letter-spacing: 0.4px; transform: translate(-50%, -50%) rotate(${id.rotation ?? 0}deg); transform-origin: center; }
    .start-date { left: ${startDate.x}%; top: ${startDate.y}%; font-size: ${startDate.fontSize}px; transform: translate(-50%, -50%) rotate(${startDate.rotation ?? 0}deg); transform-origin: center; }
    .end-date { left: ${endDate.x}%; top: ${endDate.y}%; font-size: ${endDate.fontSize}px; transform: translate(-50%, -50%) rotate(${endDate.rotation ?? 0}deg); transform-origin: center; }
  </style>
</head>
<body>
  <div class="a4">
    <div class="bg"></div>
    ${!isPreset && brandLogoUrl ? `<img class="brand-logo" src="${esc(brandLogoUrl)}" alt="${esc(values.BRAND_UPPER || '')}" style="left:${brandLogoX}%;top:${brandLogoY}%;width:${brandLogoWidth}%;height:${brandLogoHeight}%;" />` : ''}
    ${isPreset ? `
    <div class="preset-shell">
      <div class="preset-header">
        <div class="preset-brand">
          ${values.LOGO_URL ? `<img src="${esc(values.LOGO_URL)}" alt="${esc(values.BRAND_UPPER || '')}" />` : ''}
          <div class="preset-brand-sub">${esc(config.brandSubtitle)}</div>
        </div>
        <div class="preset-title">
          <h1>${esc(config.headerTitleEn)}</h1>
          <p>${esc(config.headerTitleRu)}</p>
        </div>
        <div class="preset-service">
          <div class="label">${esc(config.serviceLabel)}</div>
          <div class="value">${esc(config.serviceLocation)}</div>
        </div>
      </div>
    </div>
    <div class="preset-label label-model">Model:</div>
    <div class="preset-label label-date">Date:</div>
    <div class="preset-label label-serial">Serial No:</div>
    <div class="preset-label label-expiry">Expiry:</div>
    <div class="preset-label label-id">ID:</div>` : ''}
    ${textBlocksHtml}
    <div class="field model">${esc(values.MODEL)}</div>
    <div class="field serial">${esc(values.SERIAL_NUMBER)}</div>
    <div class="field wid">${esc(values.WARRANTY_ID)}</div>
    <div class="field start-date">${esc(values.START_DATE)}</div>
    <div class="field end-date">${esc(values.END_DATE)}</div>
  </div>
</body>
</html>`;
}

export function serializeSimpleWarrantyTemplate(config: WarrantyTemplateConfig): string {
  const payload: StoredSimpleWarrantyTemplate = {
    mode: SIMPLE_WARRANTY_TEMPLATE_MODE,
    config,
  };
  return JSON.stringify(payload);
}

export function parseSimpleWarrantyTemplate(content: string | null | undefined): WarrantyTemplateConfig | null {
  if (!content) return null;
  try {
    const parsed = JSON.parse(content) as Partial<StoredSimpleWarrantyTemplate>;
    if (parsed.mode !== SIMPLE_WARRANTY_TEMPLATE_MODE || !parsed.config) return null;
    return {
      ...DEFAULT_WARRANTY_TEMPLATE_CONFIG,
      ...parsed.config,
    };
  } catch {
    return null;
  }
}

export function resolveWarrantyTemplateHtml(content: string | null | undefined): string {
  const simple = parseSimpleWarrantyTemplate(content);
  if (simple) {
    return DEFAULT_WARRANTY_TEMPLATE;
  }
  return content && content.trim() ? content : DEFAULT_WARRANTY_TEMPLATE;
}

export function buildObligationHtml(templateText: string, values: { brandName: string; durationMonths: number }): string {
  const source = (templateText || DEFAULT_WARRANTY_TEMPLATE_CONFIG.obligationText)
    .replace(/\{brandName\}/g, values.brandName)
    .replace(/\{durationMonths\}/g, String(values.durationMonths));
  const escaped = source
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
  return escaped.replace(/\n/g, '<br/>');
}
