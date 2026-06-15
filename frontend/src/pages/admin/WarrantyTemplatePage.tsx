import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Link } from 'react-router-dom';
import api from '../../lib/api';
import type { ApiResponse, DocumentTemplate, WarrantyRule } from '../../types';
import { DEFAULT_BRAND_DURATIONS } from '../../lib/warranty';
import {
  buildObligationHtml,
  createDefaultWarrantyBackground,
  DEFAULT_WARRANTY_TEMPLATE,
  DEFAULT_WARRANTY_TEMPLATE_CONFIG,
  parseSimpleWarrantyTemplate,
  renderCustomWarrantyLayout,
  renderWarrantyTemplate,
  serializeSimpleWarrantyTemplate,
  type WarrantyTemplateConfig,
  type WarrantyTextBlock,
  WARRANTY_TEMPLATE_TYPE,
} from '../../lib/warrantyTemplate';
import {
  getBrandProfile,
  parseBrandProfiles,
  resolveBrandLogo,
  type WarrantyBrandProfile,
  WARRANTY_BRAND_PROFILES_KEY,
} from '../../lib/warrantyBrands';
import { CheckCircle2, Circle, FileText, Image, Printer, Save, Send } from 'lucide-react';

const WARRANTY_PERIOD_OPTIONS = [
  { value: 6, label: '6 months' },
  { value: 12, label: '1 year (12 months)' },
  { value: 24, label: '2 years (24 months)' },
  { value: 36, label: '3 years (36 months)' },
];

const normalizeDurationMonths = (value: number | null | undefined, fallback = 12) => {
  if (!Number.isFinite(value)) return fallback;
  const rounded = Math.round(Number(value));
  return Math.max(1, rounded);
};

const WARRANTY_LOGO_MODE_KEY = 'warranty.logoMode';
const WARRANTY_DEFAULT_TERMS_KEY = 'warranty.defaultTerms';

type WarrantyLogoMode = 'company' | 'brand' | 'none';

const normalizeLogoMode = (value: string | undefined): WarrantyLogoMode => {
  if (value === 'brand' || value === 'none' || value === 'company') return value;
  return 'company';
};

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function termsToHtml(terms: string): string {
  return `<div class="terms-custom">${escapeHtml(terms || '').replace(/\n/g, '<br/>')}</div>`;
}

const BRAND_MODELS: Record<string, string> = {
  YAMAHA: 'PSR-SX900',
  SHURE: 'SM58-LC',
  ZOOM: 'H6',
  SENNHEISER: 'HD 600',
  NEUMANN: 'U 87 Ai',
  OMNITRONIC: 'PAD-210A',
};

export default function WarrantyTemplatePage() {
  type PlacementKey = 'modelPlacement' | 'serialPlacement' | 'idPlacement' | 'startDatePlacement' | 'endDatePlacement';

  const qc = useQueryClient();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const layoutEditorRef = useRef<HTMLDivElement>(null);

  const [templateId, setTemplateId] = useState<number | null>(null);
  const [simpleConfig, setSimpleConfig] = useState<WarrantyTemplateConfig>(DEFAULT_WARRANTY_TEMPLATE_CONFIG);
  const [activePlacementKey, setActivePlacementKey] = useState<PlacementKey>('modelPlacement');
  const [activeTextBlockId, setActiveTextBlockId] = useState<string | null>(null);
  const [snapToGrid, setSnapToGrid] = useState(true);
  const SNAP_GRID = 0.5; // % units
  const [previewZoom, setPreviewZoom] = useState(0.68);
  const [previewBrand, setPreviewBrand] = useState('');
  const [publishedAt, setPublishedAt] = useState<string | null>(null);
  const [isDraft, setIsDraft] = useState(true);
  const [ruleDrafts, setRuleDrafts] = useState<Record<string, WarrantyRule>>({});
  const [brandProfiles, setBrandProfiles] = useState<WarrantyBrandProfile[]>([]);
  const [logoMode, setLogoMode] = useState<WarrantyLogoMode>('company');
  const [defaultTerms, setDefaultTerms] = useState('');
  const [wizardStep, setWizardStep] = useState(1);

  const modeNotChosen = simpleConfig.layoutMode !== 'preset' && !simpleConfig.backgroundImage;
  const uploadBgRef = useRef<HTMLInputElement>(null);

  const modeKey = simpleConfig.layoutMode === 'preset'
    ? 'preset'
    : simpleConfig.backgroundImage
      ? 'custom'
      : 'none';

  const { data: templates, isLoading } = useQuery({
    queryKey: ['templates', WARRANTY_TEMPLATE_TYPE],
    queryFn: () =>
      api
        .get<ApiResponse<DocumentTemplate[]>>('/admin/templates', { params: { type: WARRANTY_TEMPLATE_TYPE } })
        .then((r) => r.data.data),
  });

  const { data: rules } = useQuery({
    queryKey: ['admin-warranty-rules'],
    queryFn: () => api.get<ApiResponse<WarrantyRule[]>>('/admin/warranty-rules').then((r) => r.data.data),
  });

  const { data: settings } = useQuery({
    queryKey: ['settings'],
    queryFn: () =>
      api.get<ApiResponse<Record<string, string>>>('/admin/settings').then((r) => r.data.data),
  });

  useEffect(() => {
    if (!templates) return;
    const published = templates.find((t) => t.status === 'published');
    const latest = [...templates].sort((a, b) =>
      (b.updatedAt || b.createdAt || '').localeCompare(a.updatedAt || a.createdAt || ''),
    )[0];
    const selected = published || latest;
    if (!selected) return;
    setTemplateId(selected.id);
    setIsDraft(selected.status !== 'published');
    setPublishedAt(published?.publishedAt ?? null);
    const simple = parseSimpleWarrantyTemplate(selected.content);
    if (simple) {
      setSimpleConfig(simple);
      setActiveTextBlockId(simple.textBlocks?.[0]?.id ?? null);
    }
  }, [templates]);

  useEffect(() => {
    if (!rules) return;
    const nextDrafts: Record<string, WarrantyRule> = {};
    for (const rule of rules) {
      const brand = rule.brand.toUpperCase();
      nextDrafts[brand] = {
        ...rule,
        brand,
        durationMonths: rule.durationMonths || DEFAULT_BRAND_DURATIONS[brand] || 12,
        terms: rule.terms || '',
      };
    }
    setRuleDrafts(nextDrafts);
  }, [rules]);

  useEffect(() => {
    setBrandProfiles(parseBrandProfiles(settings?.[WARRANTY_BRAND_PROFILES_KEY]));
  }, [settings]);

  useEffect(() => {
    setLogoMode(normalizeLogoMode(settings?.[WARRANTY_LOGO_MODE_KEY]));
  }, [settings]);

  useEffect(() => {
    setDefaultTerms(settings?.[WARRANTY_DEFAULT_TERMS_KEY] ?? '');
  }, [settings]);

  useEffect(() => {
    setWizardStep(1);
  }, [modeKey]);

  const availableBrands = useMemo(
    () => Array.from(new Set([
      ...(rules?.map((rule) => rule.brand.toUpperCase()) ?? []),
      ...brandProfiles.map((profile) => profile.brand.toUpperCase()),
    ])).filter(Boolean),
    [rules, brandProfiles],
  );

  useEffect(() => {
    if (!availableBrands.length) {
      setPreviewBrand('');
      return;
    }
    if (!previewBrand || !availableBrands.includes(previewBrand)) {
      setPreviewBrand(availableBrands[0]);
    }
  }, [availableBrands, previewBrand]);

  const selectedRule = useMemo(
    () => rules?.find((r) => r.brand.toUpperCase() === previewBrand),
    [rules, previewBrand],
  );

  const previewHtml = useMemo(() => {
    const now = new Date();
    const end = new Date(now);
    const duration = selectedRule?.durationMonths ?? 12;
    end.setMonth(end.getMonth() + duration);
    end.setDate(end.getDate() - 1);
    const fmt = (d: Date) =>
      d.toLocaleDateString('en-US', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const brandKey = (previewBrand || 'CUSTOM').toUpperCase();
    const companyLogo = (settings?.['company.logo'] || '').trim();
    const brandProfile = getBrandProfile(brandProfiles, brandKey);
    const brandLogo = resolveBrandLogo(brandProfiles, brandKey);
    const logoUrl = logoMode === 'none'
      ? ''
      : logoMode === 'brand'
        ? brandLogo
        : companyLogo;
    const model = BRAND_MODELS[brandKey] ?? 'Unknown Model';
    const previewConfig = simpleConfig;

    const obligationHtml = buildObligationHtml(previewConfig.obligationText, {
      brandName: `${brandKey} TASHKENT`,
      durationMonths: duration,
    });
    const standardHtml = renderWarrantyTemplate(DEFAULT_WARRANTY_TEMPLATE, {
      TITLE_ID: 'PREVIEW',
      BRAND_UPPER: brandKey,
      BRAND_NAME: `${brandKey} TASHKENT`,
      DURATION_MONTHS: String(duration),
      BRAND_SUBTITLE: escapeHtml(previewConfig.brandSubtitle),
      HEADER_TITLE_EN: escapeHtml(previewConfig.headerTitleEn),
      HEADER_TITLE_RU: escapeHtml(previewConfig.headerTitleRu),
      SERVICE_LABEL: escapeHtml(previewConfig.serviceLabel),
      SERVICE_LOCATION: escapeHtml(previewConfig.serviceLocation),
      OBLIGATION_HTML: obligationHtml,
      MODEL: escapeHtml(model),
      START_DATE: fmt(now),
      SERIAL_NUMBER: 'SN-88229911',
      END_DATE: fmt(end),
      WARRANTY_ID: 'W-7B2X9A',
      LOGO_URL: logoUrl,
      LOGO_STYLE: !logoUrl ? 'display: none;' : '',
      TERMS_TITLE: escapeHtml(previewConfig.termsTitle),
      TERMS_HTML: defaultTerms ? termsToHtml(defaultTerms) : '',
      SIGNATURE_HTML: settings?.signature ? `<img src="${settings.signature}" class="sig-image" />` : '',
      SELLER_SIGNATURE_LABEL: escapeHtml(previewConfig.sellerSignatureLabel),
    });
    const hasCustomBlocks = (previewConfig.textBlocks?.length || 0) > 0;
    if (previewConfig.backgroundImage || hasCustomBlocks) {
      return renderCustomWarrantyLayout(
        {
          TITLE_ID: 'PREVIEW',
          BRAND_UPPER: brandKey,
          BRAND_NAME: `${brandKey} TASHKENT`,
          DURATION_MONTHS: String(duration),
          LOGO_URL: logoUrl,
          MODEL: model,
          SERIAL_NUMBER: 'SN-88229911',
          WARRANTY_ID: 'W-7B2X9A',
          START_DATE: fmt(now),
          END_DATE: fmt(end),
          BRAND_LOGO_URL: logoMode === 'brand' ? brandLogo : '',
          BRAND_LOGO_X: String(brandProfile?.logoX ?? 10),
          BRAND_LOGO_Y: String(brandProfile?.logoY ?? 8),
          BRAND_LOGO_WIDTH: String(brandProfile?.logoWidth ?? 20),
          BRAND_LOGO_HEIGHT: String(brandProfile?.logoHeight ?? 10),
          WARRANTY_TERMS_TEXT: defaultTerms || '',
          TERMS_HTML: defaultTerms ? termsToHtml(defaultTerms) : '',
          SIGNATURE_HTML: settings?.signature ? `<img src="${settings.signature}" class="sig-image" />` : '',
          OBLIGATION_HTML: obligationHtml,
        },
        previewConfig,
      );
    }
    return standardHtml;
  }, [simpleConfig, previewBrand, selectedRule, settings, logoMode, defaultTerms, brandProfiles]);

  const updateConfig = (patch: Partial<WarrantyTemplateConfig>) =>
    setSimpleConfig((prev) => ({ ...prev, ...patch }));

  const updatePlacement = (
    key: PlacementKey,
    patch: Partial<WarrantyTemplateConfig['modelPlacement']>,
  ) => {
    setSimpleConfig((prev) => ({
      ...prev,
      [key]: {
        ...prev[key],
        ...patch,
      },
    }));
  };

  const updateTextBlock = (blockId: string, patch: Partial<WarrantyTextBlock>) => {
    setSimpleConfig((prev) => ({
      ...prev,
      textBlocks: (prev.textBlocks || []).map((block) =>
        block.id === blockId ? { ...block, ...patch } : block,
      ),
    }));
  };

  const activeTextBlock = (simpleConfig.textBlocks || []).find((block) => block.id === activeTextBlockId) ?? null;

  const addTextBlock = () => {
    const newBlock: WarrantyTextBlock = {
      id: `block-${Date.now()}`,
      text: 'New text',
      x: 12,
      y: 58,
      width: 32,
      height: 14,
      fontSize: 12,
      fontWeight: 500,
      textAlign: 'left',
    };
    setSimpleConfig((prev) => ({
      ...prev,
      textBlocks: [...(prev.textBlocks || []), newBlock],
    }));
    setActiveTextBlockId(newBlock.id);
  };

  const addWarrantyTermsTextBlock = () => {
    const existing = (simpleConfig.textBlocks || []).find((block) => block.text.includes('{warrantyTerms}'));
    if (existing) {
      setActiveTextBlockId(existing.id);
      toast('Terms block already added');
      return;
    }
    const newBlock: WarrantyTextBlock = {
      id: `terms-block-${Date.now()}`,
      text: '{warrantyTerms}',
      x: 10,
      y: 72,
      width: 80,
      height: 18,
      fontSize: 10,
      fontWeight: 500,
      textAlign: 'left',
    };
    setSimpleConfig((prev) => ({
      ...prev,
      textBlocks: [...(prev.textBlocks || []), newBlock],
    }));
    setActiveTextBlockId(newBlock.id);
    toast.success('Warranty terms block added');
  };

  const removeTextBlock = (blockId: string) => {
    const nextActiveId = (simpleConfig.textBlocks || []).find((block) => block.id !== blockId)?.id ?? null;
    setSimpleConfig((prev) => ({
      ...prev,
      textBlocks: (prev.textBlocks || []).filter((block) => block.id !== blockId),
    }));
    setActiveTextBlockId((prev) => (prev === blockId ? nextActiveId : prev));
  };

  const uploadBackgroundImage = (event: { target: { files?: FileList | null; value: string } }) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const base64 = String(e.target?.result || '');
      if (base64) {
        updateConfig({ backgroundImage: base64, layoutMode: 'custom' });
        toast.success('Warranty card background uploaded');
      }
    };
    reader.readAsDataURL(file);
    event.target.value = '';
  };

  const moveActiveField = (clientX: number, clientY: number) => {
    const zone = layoutEditorRef.current;
    if (!zone) return;
    const rect = zone.getBoundingClientRect();
    let x = ((clientX - rect.left) / rect.width) * 100;
    let y = ((clientY - rect.top) / rect.height) * 100;
    if (snapToGrid) {
      x = Math.round(x / SNAP_GRID) * SNAP_GRID;
      y = Math.round(y / SNAP_GRID) * SNAP_GRID;
    }
    updatePlacement(activePlacementKey, {
      x: Math.max(0, Math.min(95, Number(x.toFixed(2)))),
      y: Math.max(0, Math.min(97, Number(y.toFixed(2)))),
    });
  };

  const startDrag = (key: PlacementKey) => (e: { preventDefault: () => void; stopPropagation: () => void }) => {
    e.preventDefault();
    e.stopPropagation();
    setActivePlacementKey(key);

    const onMove = (ev: PointerEvent) => moveActiveField(ev.clientX, ev.clientY);
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  const moveTextBlock = (blockId: string, clientX: number, clientY: number) => {
    const zone = layoutEditorRef.current;
    if (!zone) return;
    const rect = zone.getBoundingClientRect();
    let x = ((clientX - rect.left) / rect.width) * 100;
    let y = ((clientY - rect.top) / rect.height) * 100;
    if (snapToGrid) {
      x = Math.round(x / SNAP_GRID) * SNAP_GRID;
      y = Math.round(y / SNAP_GRID) * SNAP_GRID;
    }
    updateTextBlock(blockId, {
      x: Math.max(0, Math.min(95, Number(x.toFixed(2)))),
      y: Math.max(0, Math.min(97, Number(y.toFixed(2)))),
    });
  };

  const startTextBlockDrag = (blockId: string) => (e: { preventDefault: () => void; stopPropagation: () => void; clientX: number; clientY: number }) => {
    e.preventDefault();
    e.stopPropagation();
    setActiveTextBlockId(blockId);

    const onMove = (ev: PointerEvent) => moveTextBlock(blockId, ev.clientX, ev.clientY);
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  const startTextBlockResize = (blockId: string) => (e: { preventDefault: () => void; stopPropagation: () => void; clientX: number; clientY: number }) => {
    e.preventDefault();
    e.stopPropagation();
    setActiveTextBlockId(blockId);

    const zone = layoutEditorRef.current;
    const current = (simpleConfig.textBlocks || []).find((block) => block.id === blockId);
    if (!zone || !current) return;

    const rect = zone.getBoundingClientRect();
    const startX = e.clientX;
    const startY = e.clientY;
    const startWidth = current.width;
    const startHeight = current.height;

    const onMove = (ev: PointerEvent) => {
      const dxPercent = ((ev.clientX - startX) / rect.width) * 100;
      const dyPercent = ((ev.clientY - startY) / rect.height) * 100;
      const nextWidth = Math.max(5, Math.min(100 - current.x, Number((startWidth + dxPercent).toFixed(2))));
      const nextHeight = Math.max(3, Math.min(100 - current.y, Number((startHeight + dyPercent).toFixed(2))));
      updateTextBlock(blockId, { width: nextWidth, height: nextHeight });
    };

    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  const placementLabels: Record<PlacementKey, string> = {
    modelPlacement: 'Model',
    serialPlacement: 'Serial number',
    idPlacement: 'Card ID',
    startDatePlacement: 'Start date',
    endDatePlacement: 'End date',
  };

  const applyBuiltInTemplate = () => {
    setSimpleConfig((prev) => ({
      ...prev,
      layoutMode: 'preset',
      backgroundImage: createDefaultWarrantyBackground(),
    }));
    toast.success('Built-in template applied');
  };

  const currentContent = () => serializeSimpleWarrantyTemplate(simpleConfig);

  const saveLogoModeMut = useMutation({
    mutationFn: (mode: WarrantyLogoMode) =>
      api.put('/admin/settings', { [WARRANTY_LOGO_MODE_KEY]: mode }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['settings'] });
      qc.invalidateQueries({ queryKey: ['pub-settings'] });
      toast.success('Logo mode saved');
    },
    onError: () => toast.error('Failed to save logo mode'),
  });

  const changeLogoMode = (mode: WarrantyLogoMode) => {
    setLogoMode(mode);
    saveLogoModeMut.mutate(mode);
  };

  const saveDefaultTermsMut = useMutation({
    mutationFn: (terms: string) =>
      api.put('/admin/settings', { [WARRANTY_DEFAULT_TERMS_KEY]: terms }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['settings'] });
      qc.invalidateQueries({ queryKey: ['pub-settings'] });
      toast.success('Warranty terms saved');
    },
    onError: () => toast.error('Failed to save warranty terms'),
  });


  const updateRuleDraft = (brand: string, patch: Partial<WarrantyRule>) => {
    setRuleDrafts((current) => ({
      ...current,
      [brand]: {
        ...current[brand],
        ...patch,
      },
    }));
  };

  const editableBrands = Array.from(new Set([
    ...(rules?.map((rule) => rule.brand.toUpperCase()) ?? []),
    ...brandProfiles.map((profile) => profile.brand.toUpperCase()),
  ])).filter(Boolean);

  const saveMut = useMutation({
    mutationFn: () =>
      api
        .post<ApiResponse<DocumentTemplate>>('/admin/templates', {
          id: templateId ?? undefined,
          type: WARRANTY_TEMPLATE_TYPE,
          name: 'Warranty Card Template',
          content: currentContent(),
        })
        .then((r) => r.data.data),
    onSuccess: (saved) => {
      setTemplateId(saved.id);
      setIsDraft(true);
      qc.invalidateQueries({ queryKey: ['templates', WARRANTY_TEMPLATE_TYPE] });
      toast.success('Draft saved');
    },
    onError: () => toast.error('Save failed'),
  });

  const publishMut = useMutation({
    mutationFn: async () => {
      let id = templateId;
      if (!id) {
        const saved = await api
          .post<ApiResponse<DocumentTemplate>>('/admin/templates', {
            type: WARRANTY_TEMPLATE_TYPE,
            name: 'Warranty Card Template',
            content: currentContent(),
          })
          .then((r) => r.data.data);
        id = saved.id;
        setTemplateId(id);
      } else {
        await api.post('/admin/templates', {
          id,
          type: WARRANTY_TEMPLATE_TYPE,
          name: 'Warranty Card Template',
          content: currentContent(),
        });
      }
      return api.post<ApiResponse<DocumentTemplate>>(`/admin/templates/${id}/publish`).then((r) => r.data.data);
    },
    onSuccess: (published) => {
      setIsDraft(false);
      setPublishedAt(published.publishedAt ?? new Date().toISOString());
      qc.invalidateQueries({ queryKey: ['templates', WARRANTY_TEMPLATE_TYPE] });
      qc.invalidateQueries({ queryKey: ['public-active-template', WARRANTY_TEMPLATE_TYPE] });
      toast.success('Template published and applied');
    },
    onError: () => toast.error('Publish failed'),
  });

  const saveRuleMut = useMutation({
    mutationFn: (rule: WarrantyRule) => api.post('/admin/warranty-rules', rule),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-warranty-rules'] });
      qc.invalidateQueries({ queryKey: ['pub-warranty-rules'] });
      toast.success('Warranty rule saved');
    },
    onError: () => toast.error('Failed to save warranty rule'),
  });

  const saveRule = (brand: string) => {
    const draft = ruleDrafts[brand];
    if (!draft) return;
    saveRuleMut.mutate({
      ...draft,
      brand,
      durationMonths: normalizeDurationMonths(draft.durationMonths, DEFAULT_BRAND_DURATIONS[brand] || 12),
      terms: draft.terms || '',
    });
  };

  const handlePrint = () => {
    const iframe = iframeRef.current;
    if (!iframe?.contentWindow) return;
    iframe.contentWindow.print();
  };

  if (isLoading) return <p className="text-sm text-gray-500 p-4">Loading...</p>;

  if (modeNotChosen) {
    return (
      <div className="grid sm:grid-cols-2 gap-4">
        <button
          type="button"
          onClick={applyBuiltInTemplate}
          className="px-5 py-4 rounded-xl border-2 border-teal-200 text-teal-800 bg-teal-50 hover:bg-teal-100 text-sm font-semibold"
        >
          Standard template
        </button>
        <label className="px-5 py-4 rounded-xl border-2 border-indigo-200 text-indigo-800 bg-indigo-50 hover:bg-indigo-100 text-sm font-semibold text-center cursor-pointer">
          Upload custom template (A4)
          <input ref={uploadBgRef} type="file" accept="image/*" className="hidden" onChange={uploadBackgroundImage} />
        </label>
      </div>
    );
  }

  const isPresetMode = simpleConfig.layoutMode === 'preset';
  const isCustomMode = simpleConfig.layoutMode === 'custom' && !!simpleConfig.backgroundImage;
  const stepLabels = isPresetMode
    ? ['Step 1: Header and terms', 'Step 2: Text blocks', 'Step 3: Brands and terms']
    : ['Step 1: A4 field layout', 'Step 2: Brands and terms'];
  const lastStep = stepLabels.length;
  const isStep1 = wizardStep === 1;
  const isStep2 = wizardStep === 2;
  const isStep3 = wizardStep === 3;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold">Warranty settings</h2>
          <p className="text-sm text-gray-500">All warranty parameters in one place: term, conditions, and print template.</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={() => saveMut.mutate()}
            disabled={saveMut.isPending}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm hover:bg-gray-50 disabled:opacity-50"
          >
            <Save size={15} /> Save draft
          </button>
          <button
            onClick={() => publishMut.mutate()}
            disabled={publishMut.isPending}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-teal-700 text-white text-sm hover:bg-teal-800 disabled:opacity-50"
          >
            <Send size={15} /> Publish
          </button>
        </div>
      </div>

      {/* Status bar */}
      <div className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm border ${isDraft ? 'bg-amber-50 border-amber-200 text-amber-800' : 'bg-green-50 border-green-200 text-green-800'}`}>
        {isDraft ? <Circle size={15} /> : <CheckCircle2 size={15} />}
        {isDraft
          ? 'Template not published. Clients see the previous version.'
          : `Published${publishedAt ? ` · ${new Date(publishedAt).toLocaleDateString('en-US', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}` : ''}`}
        {isDraft && (
          <span className="ml-auto text-xs text-amber-700">Click Publish to apply changes</span>
        )}
      </div>

      {/* ── Mode indicator (when mode is chosen) ─────────────── */}
      <div className="flex items-center justify-between bg-white rounded-xl border border-gray-200 px-4 py-2.5">
          <div className="flex items-center gap-2 text-sm text-gray-700">
            {isPresetMode
              ? <><FileText size={15} className="text-teal-600" /> <span>Type: <strong>Standard template</strong></span></>
              : <><Image size={15} className="text-indigo-600" /> <span>Type: <strong>Custom design (A4)</strong></span></>
            }
          </div>
          <button
            type="button"
            onClick={() => updateConfig({ layoutMode: 'custom', backgroundImage: '' })}
            className="px-3 py-1 text-xs border rounded-lg hover:bg-gray-50 text-gray-600"
          >
            Change type
          </button>
      </div>

      <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {stepLabels.map((label, index) => {
            const stepNum = index + 1;
            const isActive = stepNum === wizardStep;
            return (
              <button
                key={label}
                type="button"
                onClick={() => setWizardStep(stepNum)}
                className={`px-3 py-2 rounded-lg text-xs border text-left ${
                  isActive
                    ? 'bg-teal-700 text-white border-teal-700'
                    : 'bg-white text-slate-700 border-slate-300 hover:border-teal-400'
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
        <div className="flex items-center justify-between">
          <p className="text-xs text-slate-700">Current step: {stepLabels[wizardStep - 1]}</p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setWizardStep((prev) => Math.max(1, prev - 1))}
              disabled={wizardStep === 1}
              className="px-3 py-1.5 rounded-lg text-xs border bg-white text-slate-700 disabled:opacity-50"
            >
              Back
            </button>
            <button
              type="button"
              onClick={() => setWizardStep((prev) => Math.min(lastStep, prev + 1))}
              disabled={wizardStep === lastStep}
              className="px-3 py-1.5 rounded-lg text-xs border bg-white text-slate-700 disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* ── Main editing grid (shown when mode is chosen) ─────── */}
      <div className="grid lg:grid-cols-2 gap-4 items-start">
        {/* === LEFT: Settings === */}
        <div className="flex flex-col gap-3">
          {/* Block 1: Header */}
          <div className={`${isPresetMode && isStep1 ? '' : 'hidden'} order-1 bg-white rounded-xl border border-gray-200 p-4 space-y-3`}>
            <h3 className="text-sm font-semibold text-gray-800">Card header</h3>
            <p className="text-xs text-gray-500">Top section: logo, title, service center info.</p>
            <div className="rounded-lg border border-teal-200 bg-teal-50 p-3 space-y-2">
              <p className="text-xs font-semibold text-teal-800">Logo on card</p>
              <p className="text-xs text-teal-700">Simple mode: pick one option used everywhere.</p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => changeLogoMode('company')}
                  className={`px-3 py-1.5 rounded-lg text-xs border ${
                    logoMode === 'company'
                      ? 'bg-teal-700 text-white border-teal-700'
                      : 'bg-white text-gray-700 border-gray-300 hover:border-teal-400'
                  }`}
                >
                  Company logo
                </button>
                <button
                  type="button"
                  onClick={() => changeLogoMode('brand')}
                  className={`px-3 py-1.5 rounded-lg text-xs border ${
                    logoMode === 'brand'
                      ? 'bg-teal-700 text-white border-teal-700'
                      : 'bg-white text-gray-700 border-gray-300 hover:border-teal-400'
                  }`}
                >
                  Brand logo
                </button>
                <button
                  type="button"
                  onClick={() => changeLogoMode('none')}
                  className={`px-3 py-1.5 rounded-lg text-xs border ${
                    logoMode === 'none'
                      ? 'bg-teal-700 text-white border-teal-700'
                      : 'bg-white text-gray-700 border-gray-300 hover:border-teal-400'
                  }`}
                >
                  No logo
                </button>
              </div>
              <p className="text-[11px] text-teal-700">
                {logoMode === 'company' && !settings?.['company.logo']
                  ? 'Company logo not uploaded yet. Upload it in general settings or choose another mode.'
                  : logoMode === 'brand'
                    ? 'Known brands (e.g. SHURE) will use the brand logo.'
                    : logoMode === 'none'
                      ? 'Logo disabled: text only on the card.'
                      : 'Square company logo from settings will be used.'}
              </p>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Caption under logo</label>
              <input
                value={simpleConfig.brandSubtitle}
                onChange={(e) => updateConfig({ brandSubtitle: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg text-sm"
                placeholder="e.g. SHOWPRO.UZ"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Title (English)</label>
                <input
                  value={simpleConfig.headerTitleEn}
                  onChange={(e) => updateConfig({ headerTitleEn: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Title (Russian)</label>
                <input
                  value={simpleConfig.headerTitleRu}
                  onChange={(e) => updateConfig({ headerTitleRu: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Service center name</label>
                <input
                  value={simpleConfig.serviceLabel}
                  onChange={(e) => updateConfig({ serviceLabel: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                  placeholder="Authorized Service Center"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">City / Country</label>
                <input
                  value={simpleConfig.serviceLocation}
                  onChange={(e) => updateConfig({ serviceLocation: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                  placeholder="TASHKENT, UZBEKISTAN"
                />
              </div>
            </div>
          </div>

          {/* Block 1.5: Global warranty terms */}
          <div className={`${isPresetMode && isStep1 ? '' : 'hidden'} ${isCustomMode ? 'order-3' : 'order-2'} bg-white rounded-xl border border-gray-200 p-4 space-y-3`}>
            <div>
              <h3 className="text-sm font-semibold text-gray-800">Warranty terms</h3>
              <p className="text-xs text-gray-500">Single terms text for all brands. Add a block with {'{warrantyTerms}'} on the next step for free placement.</p>
            </div>
            <textarea
              rows={7}
              value={defaultTerms}
              onChange={(e) => setDefaultTerms(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg text-sm"
              placeholder="Enter warranty service terms..."
            />
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => saveDefaultTermsMut.mutate(defaultTerms)}
                disabled={saveDefaultTermsMut.isPending}
                className="flex items-center gap-1.5 px-4 py-2 bg-teal-700 text-white rounded-lg hover:bg-teal-800 text-sm disabled:opacity-50"
              >
                <Save size={14} /> Save terms
              </button>
            </div>
          </div>

          {/* Block 2: Text blocks */}
          <div className={`${isPresetMode && isStep2 ? '' : 'hidden'} order-3 bg-white rounded-xl border border-gray-200 p-4 space-y-3`}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-gray-800">Text blocks</h3>
                <p className="text-xs text-gray-500">Add custom text and place it on the standard card.</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={addTextBlock}
                  className="px-3 py-1.5 border rounded-lg text-xs hover:bg-gray-50"
                >
                  Add block
                </button>
                {isPresetMode && (
                  <button
                    type="button"
                    onClick={addWarrantyTermsTextBlock}
                    className="px-3 py-1.5 border border-teal-200 text-teal-700 rounded-lg text-xs hover:bg-teal-50"
                  >
                    Add terms block
                  </button>
                )}
              </div>
            </div>
            <div className="rounded-lg bg-blue-50 border border-blue-100 p-3 text-xs text-blue-900 space-y-1">
              <p>Available variables: {'{brandName}'}, {'{durationMonths}'}, {'{model}'}, {'{serialNumber}'}, {'{warrantyId}'}, {'{startDate}'}, {'{endDate}'}, {'{warrantyTerms}'}.</p>
              <p>Warranty term in months is still set per brand in settings.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {(simpleConfig.textBlocks || []).map((block, index) => (
                <button
                  key={block.id}
                  type="button"
                  onClick={() => setActiveTextBlockId(block.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs border ${
                    activeTextBlockId === block.id
                      ? 'bg-teal-700 text-white border-teal-700'
                      : 'bg-white text-gray-600 border-gray-300 hover:border-teal-400'
                  }`}
                >
                  Block {index + 1}
                </button>
              ))}
            </div>
            {activeTextBlock ? (
              <>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Block text</label>
                  <textarea
                    rows={5}
                    value={activeTextBlock.text}
                    onChange={(e) => updateTextBlock(activeTextBlock.id, { text: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg text-sm resize-y"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <label className="text-gray-600">X (%)
                    <input
                      type="number"
                      min={0}
                      max={95}
                      value={activeTextBlock.x}
                      onChange={(e) => updateTextBlock(activeTextBlock.id, { x: Number(e.target.value) || 0 })}
                      className="mt-1 w-full px-2 py-1 border rounded"
                    />
                  </label>
                  <label className="text-gray-600">Y (%)
                    <input
                      type="number"
                      min={0}
                      max={97}
                      value={activeTextBlock.y}
                      onChange={(e) => updateTextBlock(activeTextBlock.id, { y: Number(e.target.value) || 0 })}
                      className="mt-1 w-full px-2 py-1 border rounded"
                    />
                  </label>
                  <label className="text-gray-600">Width (%)
                    <input
                      type="number"
                      min={5}
                      max={100}
                      value={activeTextBlock.width}
                      onChange={(e) => updateTextBlock(activeTextBlock.id, { width: Number(e.target.value) || 5 })}
                      className="mt-1 w-full px-2 py-1 border rounded"
                    />
                  </label>
                  <label className="text-gray-600">Height (%)
                    <input
                      type="number"
                      min={3}
                      max={100}
                      value={activeTextBlock.height}
                      onChange={(e) => updateTextBlock(activeTextBlock.id, { height: Number(e.target.value) || 3 })}
                      className="mt-1 w-full px-2 py-1 border rounded"
                    />
                  </label>
                </div>
                <label className="text-xs text-gray-600 block">
                  Font size: {activeTextBlock.fontSize}px
                  <input
                    type="range"
                    min={8}
                    max={28}
                    value={activeTextBlock.fontSize}
                    onChange={(e) => updateTextBlock(activeTextBlock.id, { fontSize: Number(e.target.value) || 12 })}
                    className="w-full mt-1"
                  />
                </label>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <label className="text-gray-600">Weight
                    <select
                      value={activeTextBlock.fontWeight ?? 500}
                      onChange={(e) => updateTextBlock(activeTextBlock.id, { fontWeight: Number(e.target.value) })}
                      className="mt-1 w-full px-2 py-1 border rounded"
                    >
                      <option value={400}>Normal</option>
                      <option value={500}>Medium</option>
                      <option value={700}>Bold</option>
                      <option value={800}>Extra Bold</option>
                    </select>
                  </label>
                  <label className="text-gray-600">Alignment
                    <select
                      value={activeTextBlock.textAlign ?? 'left'}
                      onChange={(e) => updateTextBlock(activeTextBlock.id, { textAlign: e.target.value as WarrantyTextBlock['textAlign'] })}
                      className="mt-1 w-full px-2 py-1 border rounded"
                    >
                      <option value="left">Left</option>
                      <option value="center">Center</option>
                      <option value="right">Right</option>
                    </select>
                  </label>
                </div>
                <button
                  type="button"
                  onClick={() => removeTextBlock(activeTextBlock.id)}
                  className="px-3 py-1.5 border border-red-200 text-red-600 rounded-lg text-xs hover:bg-red-50"
                >
                  Delete active block
                </button>
              </>
            ) : (
              <p className="text-xs text-gray-400">Add a text block to edit text on the card.</p>
            )}
          </div>

          <div className={`${(isPresetMode && isStep3) || (isCustomMode && isStep2) ? '' : 'hidden'} ${isCustomMode ? 'order-4' : 'order-4'} bg-white rounded-xl border border-gray-200 p-4 space-y-4`}>
            <div>
              <h3 className="text-sm font-semibold text-gray-800">Warranty rules by brand</h3>
              <p className="text-xs text-gray-500">Each brand has a warranty term. The template stays shared.</p>
            </div>
            <div className="space-y-4">
              {editableBrands.map((brand) => {
                const draft = ruleDrafts[brand] ?? {
                  id: 0,
                  brand,
                  durationMonths: 12,
                  terms: '',
                  active: true,
                };
                const periodValue = WARRANTY_PERIOD_OPTIONS.some((option) => option.value === draft.durationMonths)
                  ? String(draft.durationMonths)
                  : 'custom';

                return (
                  <div key={brand} className="rounded-xl border border-gray-200 p-4 space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <h4 className="text-sm font-semibold text-gray-800">{brand}</h4>
                        <p className="text-xs text-gray-500">Term and warranty terms text</p>
                      </div>
                      <label className="flex items-center gap-2 text-sm text-gray-700">
                        <input
                          type="checkbox"
                          checked={draft.active}
                          onChange={(e) => updateRuleDraft(brand, { active: e.target.checked })}
                        />
                        Active
                      </label>
                    </div>

                    <div className="grid gap-3 md:grid-cols-[190px,1fr]">
                      <div className="space-y-2">
                        <label className="block text-xs font-medium text-gray-700">Warranty term</label>
                        <select
                          value={periodValue}
                          onChange={(e) => {
                            if (e.target.value === 'custom') return;
                            updateRuleDraft(brand, { durationMonths: Number(e.target.value) });
                          }}
                          className="w-full px-3 py-2 border rounded-lg text-sm"
                        >
                          {WARRANTY_PERIOD_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                          ))}
                          <option value="custom">Custom value</option>
                        </select>
                        <input
                          type="number"
                          min="1"
                          value={draft.durationMonths}
                          onChange={(e) => updateRuleDraft(brand, {
                            durationMonths: normalizeDurationMonths(
                              e.target.value === '' ? 1 : Number(e.target.value),
                              12,
                            ),
                          })}
                          className="w-full px-3 py-2 border rounded-lg text-sm"
                          placeholder="Number of months"
                        />
                      </div>
                    </div>

                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={() => saveRule(brand)}
                        disabled={saveRuleMut.isPending}
                        className="flex items-center gap-1.5 px-4 py-2 bg-teal-700 text-white rounded-lg hover:bg-teal-800 text-sm disabled:opacity-50"
                      >
                        <Save size={14} /> Save rule
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className={`${(isPresetMode && isStep3) || (isCustomMode && isStep2) ? '' : 'hidden'} ${isCustomMode ? 'order-5' : 'order-5'} bg-white rounded-xl border border-gray-200 p-4 space-y-4`}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-gray-800">Warranty brands</h3>
                <p className="text-xs text-gray-500">Brand logos and placement are managed on a separate page.</p>
              </div>
            </div>
            <div className="rounded-xl border border-dashed border-teal-300 bg-teal-50/60 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-teal-900">Dedicated brands section</p>
                <p className="text-xs text-teal-800 mt-1">Add brands, upload logos, and set placement on the warranty card.</p>
              </div>
              <Link to="/admin/warranty-brands" className="inline-flex items-center justify-center px-4 py-2 rounded-lg bg-teal-700 text-white text-sm hover:bg-teal-800">
                Open warranty brands
              </Link>
            </div>

            {brandProfiles.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {brandProfiles.map((profile) => (
                  <span key={profile.id} className="px-3 py-1.5 rounded-full border bg-white text-xs text-gray-700">
                    {profile.brand}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className={`${isCustomMode && isStep1 ? 'order-1' : 'hidden'} bg-white rounded-xl border border-gray-200 p-4 space-y-3`}>
            <div className="flex items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-semibold text-gray-800">Step 1: A4 template and field layout</h3>
                <p className="text-xs text-gray-500 mt-0.5">Replace background if needed and drag field labels.</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <label className="inline-flex items-center gap-1.5 px-3 py-1.5 border rounded-lg text-xs cursor-pointer hover:bg-gray-50">
                  <Image size={13} /> Replace image
                  <input type="file" accept="image/*" className="hidden" onChange={uploadBackgroundImage} />
                </label>
                <button
                  type="button"
                  onClick={() => updateConfig({ backgroundImage: '', layoutMode: 'custom' })}
                  className="px-3 py-1.5 border border-red-200 text-red-600 rounded-lg text-xs hover:bg-red-50"
                >
                  Remove image
                </button>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {(Object.keys(placementLabels) as PlacementKey[]).map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setActivePlacementKey(key)}
                  className={`px-3 py-1.5 rounded-lg text-xs border ${
                    activePlacementKey === key
                      ? 'bg-teal-700 text-white border-teal-700'
                      : 'bg-white text-gray-600 border-gray-300 hover:border-teal-400'
                  }`}
                >
                  {placementLabels[key]}
                </button>
              ))}
            </div>

            <div
              ref={layoutEditorRef}
              onPointerDown={(e) => moveActiveField(e.clientX, e.clientY)}
              className="relative w-full rounded-lg border border-gray-200 overflow-hidden"
              style={{ aspectRatio: '210 / 297', backgroundImage: `url(${simpleConfig.backgroundImage})`, backgroundSize: 'contain', backgroundRepeat: 'no-repeat', backgroundPosition: 'center' }}
            >
              {(Object.keys(placementLabels) as PlacementKey[]).map((key) => (
                <button
                  key={key}
                  type="button"
                  onPointerDown={startDrag(key)}
                  className={`absolute px-2 py-1 rounded-md text-[11px] font-semibold border shadow ${
                    activePlacementKey === key
                      ? 'bg-amber-300 border-amber-500 text-gray-900'
                      : 'bg-white border-gray-300 text-gray-700'
                  }`}
                  style={{
                    left: `${simpleConfig[key].x}%`,
                    top: `${simpleConfig[key].y}%`,
                    fontSize: `${simpleConfig[key].fontSize}px`,
                    transform: `translate(-50%, -50%) rotate(${simpleConfig[key].rotation ?? 0}deg)`,
                    transformOrigin: 'center',
                  }}
                >
                  {placementLabels[key]}
                </button>
              ))}
              {(simpleConfig.textBlocks || []).map((block, index) => (
                <button
                  key={block.id}
                  type="button"
                  onPointerDown={startTextBlockDrag(block.id)}
                  className={`absolute relative rounded-md border px-2 py-1 text-[11px] shadow ${
                    activeTextBlockId === block.id
                      ? 'bg-sky-100 border-sky-500 text-sky-900'
                      : 'bg-white/90 border-slate-300 text-slate-700'
                  }`}
                  style={{
                    left: `${block.x}%`,
                    top: `${block.y}%`,
                    width: `${block.width}%`,
                    height: `${block.height}%`,
                    fontSize: `${Math.max(10, block.fontSize - 1)}px`,
                    textAlign: block.textAlign ?? 'left',
                    transform: 'translate(0, 0)',
                    overflow: 'hidden',
                    whiteSpace: 'pre-wrap',
                  }}
                >
                  {block.text || `Block ${index + 1}`}
                  {activeTextBlockId === block.id && (
                    <span
                      onPointerDown={startTextBlockResize(block.id)}
                      className="absolute right-0 bottom-0 w-3 h-3 bg-sky-600 border border-white rounded-tl cursor-se-resize"
                      title="Drag to resize"
                    />
                  )}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <label className="text-gray-600">
                X (%):
                <input
                  type="number"
                  min={0}
                  max={95}
                  value={simpleConfig[activePlacementKey].x}
                  onChange={(e) => updatePlacement(activePlacementKey, { x: Number(e.target.value) || 0 })}
                  className="mt-1 w-full px-2 py-1 border rounded"
                />
              </label>
              <label className="text-gray-600">
                Y (%):
                <input
                  type="number"
                  min={0}
                  max={97}
                  value={simpleConfig[activePlacementKey].y}
                  onChange={(e) => updatePlacement(activePlacementKey, { y: Number(e.target.value) || 0 })}
                  className="mt-1 w-full px-2 py-1 border rounded"
                />
              </label>
            </div>

            <label className="text-xs text-gray-600 block">
              Font size ({placementLabels[activePlacementKey]}):
              <input
                type="range"
                min={10}
                max={42}
                value={simpleConfig[activePlacementKey].fontSize}
                onChange={(e) => updatePlacement(activePlacementKey, { fontSize: Number(e.target.value) || 16 })}
                className="w-full mt-1"
              />
            </label>

            <label className="text-xs text-gray-600 block">
              Rotation angle ({placementLabels[activePlacementKey]}): {simpleConfig[activePlacementKey].rotation ?? 0}°
              <input
                type="range"
                min={-180}
                max={180}
                step={1}
                value={simpleConfig[activePlacementKey].rotation ?? 0}
                onChange={(e) => updatePlacement(activePlacementKey, { rotation: Number(e.target.value) })}
                className="w-full mt-1"
              />
            </label>

            <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={snapToGrid}
                onChange={(e) => setSnapToGrid(e.target.checked)}
                className="rounded"
              />
              Snap to grid (0.5%)
            </label>

            <p className="text-xs text-gray-500">
              Start and end dates are placed here only. Warranty term in months is still configured per brand in warranty settings.
            </p>
          </div>
        </div>

        {/* === RIGHT: Preview === */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3 sticky top-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-gray-800">Preview</span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setPreviewZoom((z) => Math.max(0.3, Number((z - 0.1).toFixed(2))))}
                className="px-2 py-1 border rounded text-xs text-gray-700 hover:bg-gray-50"
                title="Zoom out"
              >
                -
              </button>
              <button
                type="button"
                onClick={() => setPreviewZoom(0.68)}
                className="px-2 py-1 border rounded text-xs text-gray-700 hover:bg-gray-50"
                title="Fit card"
              >
                {Math.round(previewZoom * 100)}%
              </button>
              <button
                type="button"
                onClick={() => setPreviewZoom((z) => Math.min(1.8, Number((z + 0.1).toFixed(2))))}
                className="px-2 py-1 border rounded text-xs text-gray-700 hover:bg-gray-50"
                title="Zoom in"
              >
                +
              </button>
              <button
                onClick={handlePrint}
                className="flex items-center gap-1.5 px-3 py-1.5 border rounded-lg text-xs text-gray-700 hover:bg-gray-50"
              >
                <Printer size={13} /> Test print
              </button>
            </div>
          </div>

          {/* Brand switcher */}
          <div className="flex flex-wrap gap-1.5">
            {availableBrands.map((brand) => (
              <button
                key={brand}
                onClick={() => setPreviewBrand(brand)}
                className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                  previewBrand === brand
                    ? 'bg-teal-700 text-white border-teal-700'
                    : 'bg-white text-gray-600 border-gray-300 hover:border-teal-400'
                }`}
              >
                {brand}
              </button>
            ))}
          </div>

          {!availableBrands.length && (
            <div className="text-xs text-blue-700 bg-blue-50 border border-blue-200 px-3 py-2 rounded-lg">
              No brands yet. Add a warranty in the Individual warranties section, then set the term and conditions.
            </div>
          )}

          {/* Duration info */}
          {selectedRule && (
            <div className="text-xs text-gray-500 px-1">
              Period: <strong>{selectedRule.durationMonths} mo.</strong> for brand {previewBrand}.{' '}
              <span className="text-gray-400">Change in Settings.</span>
            </div>
          )}

          {/* A4 preview with zoom */}
          <div className="rounded-lg border bg-gray-50 overflow-auto" style={{ height: '78vh', maxHeight: '860px' }}>
            <div
              className="origin-top-left"
              style={{
                transform: `scale(${previewZoom})`,
                transformOrigin: 'top left',
                width: `${100 / previewZoom}%`,
                minHeight: `${1123 + 24}px`,
                padding: '12px',
              }}
            >
              <iframe
                ref={iframeRef}
                title="Warranty Template Preview"
                srcDoc={previewHtml}
                className="bg-white border border-gray-200 shadow-sm"
                style={{ width: '794px', height: '1123px', display: 'block' }}
              />
            </div>
          </div>
          <p className="text-xs text-gray-400 text-center">
            Preview with sample data. The real card shows buyer data.
          </p>
        </div>
      </div>
    </div>
  );
}

