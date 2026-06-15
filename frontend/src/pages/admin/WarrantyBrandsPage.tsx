import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Link } from 'react-router-dom';
import { ArrowLeft, ImagePlus, Save, Trash2 } from 'lucide-react';
import api from '../../lib/api';
import type { ApiResponse, DocumentTemplate } from '../../types';
import {
  buildObligationHtml,
  DEFAULT_WARRANTY_TEMPLATE,
  DEFAULT_WARRANTY_TEMPLATE_CONFIG,
  createDefaultWarrantyBackground,
  parseSimpleWarrantyTemplate,
  renderCustomWarrantyLayout,
  renderWarrantyTemplate,
  WARRANTY_TEMPLATE_TYPE,
} from '../../lib/warrantyTemplate';
import {
  getBrandProfile,
  normalizeWarrantyBrandProfile,
  parseBrandProfiles,
  resolveBrandLogo,
  type WarrantyBrandProfile,
  WARRANTY_BRAND_PROFILES_KEY,
} from '../../lib/warrantyBrands';

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

export default function WarrantyBrandsPage() {
  const qc = useQueryClient();
  const editorRef = useRef<HTMLDivElement>(null);
  const [newBrand, setNewBrand] = useState('');
  const [selectedBrand, setSelectedBrand] = useState<string>('');
  const [profiles, setProfiles] = useState<WarrantyBrandProfile[]>([]);
  const previewFrameRef = useRef<HTMLIFrameElement>(null);

  const { data: settings } = useQuery({
    queryKey: ['settings'],
    queryFn: () => api.get<ApiResponse<Record<string, string>>>('/admin/settings').then((r) => r.data.data),
  });

  const { data: templates } = useQuery({
    queryKey: ['templates', WARRANTY_TEMPLATE_TYPE],
    queryFn: () =>
      api
        .get<ApiResponse<DocumentTemplate[]>>('/admin/templates', { params: { type: WARRANTY_TEMPLATE_TYPE } })
        .then((r) => r.data.data),
  });

  const parsedProfiles = useMemo(() => parseBrandProfiles(settings?.[WARRANTY_BRAND_PROFILES_KEY]), [settings]);

  useEffect(() => {
    setProfiles(parsedProfiles);
  }, [parsedProfiles]);

  useEffect(() => {
    if (!profiles.length) {
      setSelectedBrand('');
      return;
    }
    if (!selectedBrand || !profiles.some((profile) => profile.brand === selectedBrand)) {
      setSelectedBrand(profiles[0].brand);
    }
  }, [profiles, selectedBrand]);

  const activeProfile = getBrandProfile(profiles, selectedBrand || profiles[0]?.brand);
  const selectedTemplate = useMemo(() => {
    if (!templates?.length) return null;
    const published = templates.find((template) => template.status === 'published');
    const latest = [...templates].sort((a, b) =>
      (b.updatedAt || b.createdAt || '').localeCompare(a.updatedAt || a.createdAt || ''),
    )[0];
    return published || latest || null;
  }, [templates]);
  const templatePreviewBackground = useMemo(() => {
    const config = parseSimpleWarrantyTemplate(selectedTemplate?.content);
    if (config?.backgroundImage) return config.backgroundImage;
    return createDefaultWarrantyBackground();
  }, [selectedTemplate]);
  const templatePreviewConfig = useMemo(
    () => parseSimpleWarrantyTemplate(selectedTemplate?.content) || DEFAULT_WARRANTY_TEMPLATE_CONFIG,
    [selectedTemplate],
  );
  const previewBrandLogo = useMemo(
    () => resolveBrandLogo(profiles, activeProfile?.brand),
    [profiles, activeProfile?.brand],
  );
  const previewHtml = useMemo(() => {
    if (!activeProfile) return '';
    const brandName = `${activeProfile.brand} TASHKENT`;
    const now = new Date();
    const end = new Date(now);
    end.setMonth(end.getMonth() + 12);
    end.setDate(end.getDate() - 1);
    const fmtDate = (value: Date) =>
      value.toLocaleDateString('en-US', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const termsText = settings?.['warranty.defaultTerms'] || '';
    const config = templatePreviewConfig;
    const obligationHtml = buildObligationHtml(config.obligationText, {
      brandName,
      durationMonths: 12,
    });

    const standardHtml = renderWarrantyTemplate(DEFAULT_WARRANTY_TEMPLATE, {
      TITLE_ID: 'BRAND-PREVIEW',
      BRAND_UPPER: activeProfile.brand,
      BRAND_NAME: brandName,
      DURATION_MONTHS: '12',
      BRAND_SUBTITLE: config.brandSubtitle,
      HEADER_TITLE_EN: config.headerTitleEn,
      HEADER_TITLE_RU: config.headerTitleRu,
      SERVICE_LABEL: config.serviceLabel,
      SERVICE_LOCATION: config.serviceLocation,
      OBLIGATION_HTML: obligationHtml,
      MODEL: 'MODEL-X',
      START_DATE: fmtDate(now),
      SERIAL_NUMBER: 'SN-00012345',
      END_DATE: fmtDate(end),
      WARRANTY_ID: 'W-BRAND-001',
      LOGO_URL: previewBrandLogo,
      LOGO_STYLE: !previewBrandLogo ? 'display: none;' : '',
      TERMS_TITLE: config.termsTitle,
      TERMS_HTML: termsText ? `<div class="terms-custom">${termsText.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/\n/g, '<br/>')}</div>` : '',
      SIGNATURE_HTML: settings?.signature ? `<img src="${settings.signature}" class="sig-image" />` : '',
      SELLER_SIGNATURE_LABEL: config.sellerSignatureLabel,
    });

    if (config.backgroundImage || (config.textBlocks?.length || 0) > 0) {
      return renderCustomWarrantyLayout(
        {
          TITLE_ID: 'BRAND-PREVIEW',
          BRAND_UPPER: activeProfile.brand,
          BRAND_NAME: brandName,
          DURATION_MONTHS: '12',
          LOGO_URL: previewBrandLogo,
          MODEL: 'MODEL-X',
          SERIAL_NUMBER: 'SN-00012345',
          WARRANTY_ID: 'W-BRAND-001',
          START_DATE: fmtDate(now),
          END_DATE: fmtDate(end),
          BRAND_LOGO_URL: previewBrandLogo,
          BRAND_LOGO_X: String(activeProfile.logoX ?? 10),
          BRAND_LOGO_Y: String(activeProfile.logoY ?? 8),
          BRAND_LOGO_WIDTH: String(activeProfile.logoWidth ?? 20),
          BRAND_LOGO_HEIGHT: String(activeProfile.logoHeight ?? 10),
          WARRANTY_TERMS_TEXT: termsText,
          TERMS_HTML: termsText ? `<div class="terms-custom">${termsText.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/\n/g, '<br/>')}</div>` : '',
          SIGNATURE_HTML: settings?.signature ? `<img src="${settings.signature}" class="sig-image" />` : '',
          OBLIGATION_HTML: obligationHtml,
        },
        config,
      );
    }

    return standardHtml;
  }, [activeProfile, previewBrandLogo, settings, templatePreviewConfig]);

  const saveProfilesMut = useMutation({
    mutationFn: (nextProfiles: WarrantyBrandProfile[]) =>
      api.put('/admin/settings', { [WARRANTY_BRAND_PROFILES_KEY]: JSON.stringify(nextProfiles) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['settings'] });
      qc.invalidateQueries({ queryKey: ['pub-settings'] });
      toast.success('Warranty brands saved');
    },
    onError: () => toast.error('Failed to save warranty brands'),
  });

  const saveProfiles = () => {
    saveProfilesMut.mutate(profiles);
  };

  const addBrand = () => {
    const brand = newBrand.trim().toUpperCase();
    if (!brand) {
      toast.error('Enter brand name');
      return;
    }
    if (profiles.some((profile) => profile.brand === brand)) {
      toast.error('This brand already exists');
      return;
    }
    const nextProfiles = [...profiles, normalizeWarrantyBrandProfile({ brand })];
    setProfiles(nextProfiles);
    setSelectedBrand(brand);
    setNewBrand('');
  };

  const updateProfile = (brand: string, patch: Partial<WarrantyBrandProfile>) => {
    const nextProfiles = profiles.map((profile) =>
      profile.brand === brand ? normalizeWarrantyBrandProfile({ ...profile, ...patch }) : profile,
    );
    setProfiles(nextProfiles);
  };

  const removeProfile = (brand: string) => {
    const nextProfiles = profiles.filter((profile) => profile.brand !== brand);
    setProfiles(nextProfiles);
    setSelectedBrand(nextProfiles[0]?.brand || '');
  };

  const uploadLogo = (brand: string, file: File | undefined) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const logoUrl = String(e.target?.result || '');
      if (!logoUrl) return;
      updateProfile(brand, { logoUrl });
      toast.success('Brand logo uploaded');
    };
    reader.readAsDataURL(file);
  };

  const moveLogo = (brand: string, clientX: number, clientY: number) => {
    const zone = editorRef.current;
    if (!zone) return;
    const rect = zone.getBoundingClientRect();
    const x = clamp(((clientX - rect.left) / rect.width) * 100, 0, 90);
    const y = clamp(((clientY - rect.top) / rect.height) * 100, 0, 90);
    updateProfile(brand, { logoX: Number(x.toFixed(2)), logoY: Number(y.toFixed(2)) });
  };

  const startLogoDrag = (brand: string) => (e: React.PointerEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();

    const onMove = (ev: PointerEvent) => moveLogo(brand, ev.clientX, ev.clientY);
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  const openFullPreview = () => {
    if (!previewHtml) return;
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(previewHtml);
    win.document.close();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold">Warranty card brands</h2>
          <p className="text-sm text-gray-500">Add brands separately from the template and save each logo with its position for warranty cards.</p>
        </div>
        <Link to="/admin/warranty-template" className="inline-flex items-center gap-2 px-3 py-2 border rounded-lg text-sm hover:bg-gray-50">
          <ArrowLeft size={15} /> Back to template
        </Link>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
        <h3 className="text-sm font-semibold text-gray-800">Add new brand</h3>
        <div className="flex flex-wrap gap-2 items-center">
          <input
            value={newBrand}
            onChange={(e) => setNewBrand(e.target.value)}
            className="px-3 py-2 border rounded-lg text-sm min-w-[260px]"
            placeholder="e.g. ALLEN & HEATH"
          />
          <button type="button" onClick={addBrand} className="px-3 py-2 rounded-lg bg-teal-700 text-white text-sm hover:bg-teal-800">
            Add brand
          </button>
        </div>
      </div>

      <div className="grid lg:grid-cols-[280px,1fr] gap-4 items-start">
        <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
          <h3 className="text-sm font-semibold text-gray-800">Brand list</h3>
          <div className="space-y-2">
            {profiles.length === 0 ? (
              <p className="text-xs text-gray-400">No brands yet.</p>
            ) : (
              profiles.map((profile) => (
                <button
                  key={profile.id}
                  type="button"
                  onClick={() => setSelectedBrand(profile.brand)}
                  className={`w-full text-left px-3 py-2 rounded-lg border text-sm ${activeProfile?.brand === profile.brand ? 'bg-teal-50 border-teal-300 text-teal-800' : 'bg-white border-gray-200 text-gray-700 hover:border-teal-300'}`}
                >
                  {profile.brand}
                </button>
              ))
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-4">
          {!activeProfile ? (
            <p className="text-sm text-gray-500">Select a brand on the left or add a new one.</p>
          ) : (
            <>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-base font-semibold text-gray-800">{activeProfile.brand}</h3>
                  <p className="text-xs text-gray-500">Logo and placement are used on warranty cards.</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={saveProfiles}
                    disabled={saveProfilesMut.isPending}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-teal-200 text-teal-700 rounded-lg text-xs hover:bg-teal-50 disabled:opacity-50"
                  >
                    <Save size={14} /> Save
                  </button>
                  <button
                    type="button"
                    onClick={() => removeProfile(activeProfile.brand)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-red-200 text-red-600 rounded-lg text-xs hover:bg-red-50"
                  >
                    <Trash2 size={14} /> Delete brand
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 items-center">
                <label className="inline-flex items-center gap-2 px-3 py-2 border rounded-lg text-sm cursor-pointer hover:bg-gray-50">
                  <ImagePlus size={16} /> Upload logo
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => uploadLogo(activeProfile.brand, e.target.files?.[0])}
                  />
                </label>
                {activeProfile.logoUrl && (
                  <button
                    type="button"
                    onClick={() => updateProfile(activeProfile.brand, { logoUrl: '' })}
                    className="px-3 py-2 border rounded-lg text-sm hover:bg-gray-50"
                  >
                    Remove logo
                  </button>
                )}
              </div>

              <div className="grid xl:grid-cols-[1fr,260px] gap-4 items-start">
                <div>
                  <p className="text-xs text-gray-500 mb-2">Drag the logo to the desired position. The preview below uses the current A4 warranty template background.</p>
                  <div
                    ref={editorRef}
                    className="relative rounded-xl border border-gray-200 overflow-hidden bg-white"
                    style={{
                      aspectRatio: '210 / 297',
                      backgroundImage: `url(${templatePreviewBackground})`,
                      backgroundSize: 'contain',
                      backgroundRepeat: 'no-repeat',
                      backgroundPosition: 'center',
                    }}
                  >
                    <div className="absolute inset-[7%] border border-dashed border-slate-300/70 rounded-lg" />
                    {([
                      { key: 'modelPlacement', label: 'MODEL' },
                      { key: 'serialPlacement', label: 'S/N' },
                      { key: 'startDatePlacement', label: 'DATE' },
                      { key: 'endDatePlacement', label: 'EXPIRY' },
                      { key: 'idPlacement', label: 'ID' },
                    ] as const).map((field) => {
                      const placement = templatePreviewConfig[field.key];
                      return (
                        <div
                          key={field.key}
                          className="absolute px-2 py-1 rounded-md border border-amber-300 bg-amber-100/90 text-[10px] font-semibold text-amber-900 shadow-sm pointer-events-none"
                          style={{
                            left: `${placement.x}%`,
                            top: `${placement.y}%`,
                            transform: `translate(-50%, -50%) rotate(${placement.rotation ?? 0}deg)`,
                            fontSize: `${Math.max(10, Math.min(placement.fontSize, 16))}px`,
                          }}
                        >
                          {field.label}
                        </div>
                      );
                    })}
                    {activeProfile.logoUrl ? (
                      <button
                        type="button"
                        onPointerDown={startLogoDrag(activeProfile.brand)}
                        className="absolute border border-teal-300 bg-white/80 rounded shadow-sm"
                        style={{
                          left: `${activeProfile.logoX ?? 10}%`,
                          top: `${activeProfile.logoY ?? 8}%`,
                          width: `${activeProfile.logoWidth ?? 20}%`,
                          height: `${activeProfile.logoHeight ?? 10}%`,
                        }}
                      >
                        <img src={activeProfile.logoUrl} alt={activeProfile.brand} className="w-full h-full object-contain pointer-events-none" />
                      </button>
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center text-sm text-gray-400">
                        Upload a logo first
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="rounded-lg bg-amber-50 border border-amber-100 p-3 text-xs text-amber-900">
                    Amber markers show field positions on the current template: model, serial number, dates, and ID.
                  </div>
                  <label className="text-xs text-gray-600 block">
                    X (%)
                    <input
                      type="number"
                      min={0}
                      max={90}
                      value={activeProfile.logoX ?? 10}
                      onChange={(e) => updateProfile(activeProfile.brand, { logoX: Number(e.target.value) || 0 })}
                      className="mt-1 w-full px-2 py-1 border rounded"
                    />
                  </label>
                  <label className="text-xs text-gray-600 block">
                    Y (%)
                    <input
                      type="number"
                      min={0}
                      max={90}
                      value={activeProfile.logoY ?? 8}
                      onChange={(e) => updateProfile(activeProfile.brand, { logoY: Number(e.target.value) || 0 })}
                      className="mt-1 w-full px-2 py-1 border rounded"
                    />
                  </label>
                  <label className="text-xs text-gray-600 block">
                    Width (%)
                    <input
                      type="number"
                      min={5}
                      max={60}
                      value={activeProfile.logoWidth ?? 20}
                      onChange={(e) => updateProfile(activeProfile.brand, { logoWidth: clamp(Number(e.target.value) || 5, 5, 60) })}
                      className="mt-1 w-full px-2 py-1 border rounded"
                    />
                  </label>
                  <label className="text-xs text-gray-600 block">
                    Height (%)
                    <input
                      type="number"
                      min={4}
                      max={30}
                      value={activeProfile.logoHeight ?? 10}
                      onChange={(e) => updateProfile(activeProfile.brand, { logoHeight: clamp(Number(e.target.value) || 4, 4, 30) })}
                      className="mt-1 w-full px-2 py-1 border rounded"
                    />
                  </label>
                  <div className="rounded-lg bg-blue-50 border border-blue-100 p-3 text-xs text-blue-900">
                    These settings are saved for the brand and are used automatically on warranty cards when the logo mode is Brand logo.
                  </div>
                </div>
              </div>

              <div className="border-t pt-4 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h4 className="text-sm font-semibold text-gray-800">Full warranty preview for brand</h4>
                    <p className="text-xs text-gray-500">See the final card: background, text blocks, terms, and selected brand logo.</p>
                  </div>
                  <button
                    type="button"
                    onClick={openFullPreview}
                    className="px-3 py-2 border rounded-lg text-sm hover:bg-gray-50"
                  >
                    Open full preview
                  </button>
                </div>
                <div className="rounded-xl border border-gray-200 overflow-hidden bg-slate-50">
                  <iframe
                    ref={previewFrameRef}
                    title={`Preview ${activeProfile.brand}`}
                    srcDoc={previewHtml}
                    className="w-full bg-white"
                    style={{ height: '860px' }}
                  />
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
