import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../lib/api';
import toast from 'react-hot-toast';
import type { ApiResponse } from '../../types';
import { useEffect, useState, useRef } from 'react';
import type { AxiosError } from 'axios';
import { Upload, Save, Trash2 } from 'lucide-react';

const LOGO_MIN_WIDTH = 180;
const LOGO_MIN_HEIGHT = 180;
const LOGO_MAX_WIDTH = 3000;
const LOGO_MAX_HEIGHT = 3000;
const LOGO_EDITOR_OUTPUT_WIDTH = 600;
const LOGO_EDITOR_OUTPUT_HEIGHT = 600;
const LOGO_EDITOR_PREVIEW_WIDTH = 320;
const LOGO_EDITOR_PREVIEW_HEIGHT = 320;

const isSupportedLogoType = (file: File) => {
  const type = (file.type || '').toLowerCase();
  const name = (file.name || '').toLowerCase();
  return (
    type === 'image/png' ||
    type === 'image/jpeg' ||
    type === 'image/svg+xml' ||
    name.endsWith('.png') ||
    name.endsWith('.jpg') ||
    name.endsWith('.jpeg') ||
    name.endsWith('.svg')
  );
};

const parseSvgDimensions = async (file: File): Promise<{ width: number; height: number } | null> => {
  const text = await file.text();
  const widthMatch = text.match(/width\s*=\s*"([0-9.]+)/i);
  const heightMatch = text.match(/height\s*=\s*"([0-9.]+)/i);
  if (widthMatch && heightMatch) {
    const width = Number(widthMatch[1]);
    const height = Number(heightMatch[1]);
    if (Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0) {
      return { width, height };
    }
  }
  const viewBoxMatch = text.match(/viewBox\s*=\s*"[-0-9.]+\s+[-0-9.]+\s+([0-9.]+)\s+([0-9.]+)"/i);
  if (viewBoxMatch) {
    const width = Number(viewBoxMatch[1]);
    const height = Number(viewBoxMatch[2]);
    if (Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0) {
      return { width, height };
    }
  }
  return null;
};

const getRasterDimensions = (file: File): Promise<{ width: number; height: number }> =>
  new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      resolve({ width: image.naturalWidth, height: image.naturalHeight });
      URL.revokeObjectURL(objectUrl);
    };
    image.onerror = () => {
      reject(new Error('Could not read image'));
      URL.revokeObjectURL(objectUrl);
    };
    image.src = objectUrl;
  });

const validateLogoDimensions = (width: number, height: number): string | null => {
  if (width < LOGO_MIN_WIDTH || height < LOGO_MIN_HEIGHT || width > LOGO_MAX_WIDTH || height > LOGO_MAX_HEIGHT) {
    return `Logo size must be between ${LOGO_MIN_WIDTH}x${LOGO_MIN_HEIGHT} and ${LOGO_MAX_WIDTH}x${LOGO_MAX_HEIGHT} px`;
  }
  const ratio = width / height;
  if (ratio < 0.95 || ratio > 1.05) {
    return 'Only square logos are accepted (aspect ratio ~1:1)';
  }
  return null;
};

const SETTING_LABELS: Record<string, string> = {
  'company.name': 'Company name',
  'company.address': 'Address',
  'company.phone': 'Phone',
  'company.email': 'Email',
  'company.website': 'Website',
  'signature': 'Seller signature',
};

const BRAND_COLORS = [
  { name: 'Emerald', value: '#0f766e' },
  { name: 'Blue', value: '#1d4ed8' },
  { name: 'Purple', value: '#7c3aed' },
  { name: 'Pink', value: '#be185d' },
  { name: 'Orange', value: '#c2410c' },
  { name: 'Dark', value: '#0f172a' },
];

export default function SettingsPage() {
  const qc = useQueryClient();
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');
  const logoRef = useRef<HTMLInputElement>(null);
  const [logoUploading, setLogoUploading] = useState(false);
  const [logoEditorOpen, setLogoEditorOpen] = useState(false);
  const [logoSourceFile, setLogoSourceFile] = useState<File | null>(null);
  const [logoPreviewUrl, setLogoPreviewUrl] = useState<string | null>(null);
  const [logoPreviewSize, setLogoPreviewSize] = useState<{ width: number; height: number } | null>(null);
  const [logoZoom, setLogoZoom] = useState(1);
  const [logoOffsetX, setLogoOffsetX] = useState(0);
  const [logoOffsetY, setLogoOffsetY] = useState(0);
  const [logoBackground, setLogoBackground] = useState<'transparent' | 'white'>('transparent');
  const [resetPassword, setResetPassword] = useState('');
  const [resetConfirm, setResetConfirm] = useState('');
  const colorPickerRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      if (logoPreviewUrl) {
        URL.revokeObjectURL(logoPreviewUrl);
      }
    };
  }, [logoPreviewUrl]);

  const resetLogoEditorState = () => {
    if (logoPreviewUrl) {
      URL.revokeObjectURL(logoPreviewUrl);
    }
    setLogoEditorOpen(false);
    setLogoSourceFile(null);
    setLogoPreviewUrl(null);
    setLogoPreviewSize(null);
    setLogoZoom(1);
    setLogoOffsetX(0);
    setLogoOffsetY(0);
    setLogoBackground('transparent');
  };

  const openLogoEditor = (file: File, width: number, height: number) => {
    if (logoPreviewUrl) {
      URL.revokeObjectURL(logoPreviewUrl);
    }
    const previewUrl = URL.createObjectURL(file);
    setLogoSourceFile(file);
    setLogoPreviewUrl(previewUrl);
    setLogoPreviewSize({ width, height });
    setLogoZoom(1);
    setLogoOffsetX(0);
    setLogoOffsetY(0);
    setLogoBackground('transparent');
    setLogoEditorOpen(true);
  };

  const buildStandardizedLogoBlob = async (): Promise<Blob> => {
    if (!logoPreviewUrl) {
      throw new Error('No logo image selected');
    }

    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Could not open image in editor'));
      img.src = logoPreviewUrl;
    });

    const canvas = document.createElement('canvas');
    canvas.width = LOGO_EDITOR_OUTPUT_WIDTH;
    canvas.height = LOGO_EDITOR_OUTPUT_HEIGHT;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Could not prepare image');
    }

    if (logoBackground === 'white') {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    } else {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }

    const widthScale = canvas.width / LOGO_EDITOR_PREVIEW_WIDTH;
    const heightScale = canvas.height / LOGO_EDITOR_PREVIEW_HEIGHT;
    const drawWidth = image.naturalWidth * logoZoom;
    const drawHeight = image.naturalHeight * logoZoom;
    const offsetX = logoOffsetX * widthScale;
    const offsetY = logoOffsetY * heightScale;
    const x = (canvas.width - drawWidth) / 2 + offsetX;
    const y = (canvas.height - drawHeight) / 2 + offsetY;
    ctx.drawImage(image, x, y, drawWidth, drawHeight);

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob((value) => resolve(value), 'image/png'));
    if (!blob) {
      throw new Error('Could not export logo');
    }
    return blob;
  };

  const handleApplyLogoEditor = async () => {
    setLogoUploading(true);
    try {
      const standardizedBlob = await buildStandardizedLogoBlob();
      const fd = new FormData();
      fd.append('file', standardizedBlob, 'logo-standardized.png');
      await api.post('/admin/settings/logo', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      qc.invalidateQueries({ queryKey: ['settings'] });
      qc.invalidateQueries({ queryKey: ['public-brand-config'] });
      toast.success('Logo prepared and uploaded');
      resetLogoEditorState();
    } catch (err) {
      toast.error((err as Error).message || 'Logo processing error');
    } finally {
      setLogoUploading(false);
    }
  };

  const { data, isLoading } = useQuery({
    queryKey: ['settings'],
    queryFn: () => api.get<ApiResponse<Record<string, string>>>('/admin/settings').then((r) => r.data.data),
  });

  const saveMut = useMutation({
    mutationFn: (settings: Record<string, string>) => api.put('/admin/settings', settings),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['settings'] }); toast.success('Saved'); },
    onError: () => toast.error('Error'),
  });

  const resetMut = useMutation({
    mutationFn: (password: string) => api.post('/admin/settings/factory-reset', { password }),
    onSuccess: () => {
      toast.success('Site reset. Redirecting to onboarding...');
      localStorage.clear();
      window.location.href = '/onboarding';
    },
    onError: (error: AxiosError<ApiResponse<unknown>>) => {
      const message = error.response?.data?.message || 'Factory reset error';
      toast.error(message);
    },
  });

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!isSupportedLogoType(file)) {
      toast.error('Only PNG, JPEG, and SVG are supported');
      e.target.value = '';
      return;
    }

    try {
      const isSvg = file.type === 'image/svg+xml' || file.name.toLowerCase().endsWith('.svg');
      const dimensions = isSvg ? await parseSvgDimensions(file) : await getRasterDimensions(file);
      if (!dimensions) {
        toast.error('Could not detect SVG size. Add width/height or viewBox');
        e.target.value = '';
        return;
      }
      const dimensionError = validateLogoDimensions(dimensions.width, dimensions.height);
      if (dimensionError) {
        toast(`${dimensionError}. You can fix it in the editor below.`);
      }
      openLogoEditor(file, dimensions.width, dimensions.height);
    } catch (err) {
      toast.error((err as Error).message || 'Image validation error');
      e.target.value = '';
      return;
    }

    e.target.value = '';
  };

  const handleAdd = () => {
    if (!newKey) return;
    saveMut.mutate({ [newKey]: newValue });
    setNewKey('');
    setNewValue('');
  };

  return (
    <div>
      <h2 className="text-xl font-bold mb-4">Settings</h2>
      {isLoading ? <p>Loading...</p> : (
        <div className="space-y-6">

          {/* Logo Section */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="text-sm font-bold text-gray-700 mb-1">Company logo</h3>
            <p className="text-xs text-gray-500 mb-3">Shown in header and warranty documents</p>
            <p className="text-xs text-gray-500 mb-3">Formats: PNG, JPEG, SVG. After selection, the editor opens and saves a 600x600 px square logo.</p>
            <div className="flex items-start gap-4">
              {data?.['company.logo'] ? (
                <div className="border rounded-xl p-3 bg-gray-50 flex items-center justify-center" style={{ minWidth: 100, minHeight: 64 }}>
                  <img src={data['company.logo']} alt="Logo" className="max-h-14 max-w-36 object-contain" />
                </div>
              ) : (
                <div className="border-2 border-dashed border-gray-200 rounded-xl p-4 flex items-center justify-center text-gray-400 text-xs" style={{ minWidth: 100, minHeight: 64 }}>
                  No logo
                </div>
              )}
              <div className="flex flex-col gap-2">
                <button onClick={() => logoRef.current?.click()} disabled={logoUploading}
                  className="flex items-center gap-1.5 px-3 py-1.5 border rounded-lg text-xs hover:bg-gray-50 disabled:opacity-50">
                  <Upload size={14} /> {logoUploading ? 'Processing...' : data?.['company.logo'] ? 'Replace and edit' : 'Upload and edit'}
                </button>
                {data?.['company.logo'] && (
                  <button onClick={() => saveMut.mutate({ 'company.logo': '' })}
                    className="flex items-center gap-1.5 px-3 py-1.5 border border-red-200 text-red-600 rounded-lg text-xs hover:bg-red-50">
                    <Trash2 size={14} /> Delete
                  </button>
                )}
              </div>
            </div>
            <input ref={logoRef} type="file" accept=".png,.jpg,.jpeg,.svg,image/png,image/jpeg,image/svg+xml" className="hidden" onChange={handleLogoUpload} />

            {logoEditorOpen && logoPreviewUrl && (
              <div className="fixed inset-0 z-50 bg-black/55 flex items-center justify-center p-4">
                <div className="w-full max-w-3xl bg-white rounded-2xl border border-gray-200 shadow-2xl p-5 space-y-4">
                  <div>
                    <h4 className="text-base font-semibold text-gray-900">Logo editor</h4>
                    <p className="text-xs text-gray-500 mt-1">Fit the logo to the site standard {LOGO_EDITOR_OUTPUT_WIDTH}x{LOGO_EDITOR_OUTPUT_HEIGHT} px. Source: {logoSourceFile?.name} {logoPreviewSize ? `(${logoPreviewSize.width}x${logoPreviewSize.height})` : ''}</p>
                  </div>

                  <div className="rounded-xl border border-gray-200 bg-slate-50 p-3">
                    <div
                      className="relative overflow-hidden mx-auto rounded-lg border border-gray-300"
                      style={{ width: LOGO_EDITOR_PREVIEW_WIDTH, height: LOGO_EDITOR_PREVIEW_HEIGHT, background: logoBackground === 'white' ? '#ffffff' : 'linear-gradient(135deg, #f8fafc 25%, #e2e8f0 25%, #e2e8f0 50%, #f8fafc 50%, #f8fafc 75%, #e2e8f0 75%)', backgroundSize: logoBackground === 'white' ? 'auto' : '20px 20px' }}
                    >
                      <img
                        src={logoPreviewUrl}
                        alt="Logo draft"
                        className="absolute max-w-none pointer-events-none"
                        style={{
                          left: '50%',
                          top: '50%',
                          transform: `translate(-50%, -50%) translate(${logoOffsetX}px, ${logoOffsetY}px) scale(${logoZoom})`,
                          transformOrigin: 'center center',
                        }}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-gray-600">
                    <label className="flex flex-col gap-1">
                      Scale: {logoZoom.toFixed(2)}x
                      <input
                        type="range"
                        min={0.2}
                        max={4}
                        step={0.01}
                        value={logoZoom}
                        onChange={(event) => setLogoZoom(Number(event.target.value))}
                      />
                    </label>
                    <label className="flex flex-col gap-1">
                      Offset X: {logoOffsetX}px
                      <input
                        type="range"
                        min={-220}
                        max={220}
                        step={1}
                        value={logoOffsetX}
                        onChange={(event) => setLogoOffsetX(Number(event.target.value))}
                      />
                    </label>
                    <label className="flex flex-col gap-1">
                      Offset Y: {logoOffsetY}px
                      <input
                        type="range"
                        min={-220}
                        max={220}
                        step={1}
                        value={logoOffsetY}
                        onChange={(event) => setLogoOffsetY(Number(event.target.value))}
                      />
                    </label>
                    <div className="flex flex-col gap-1">
                      Background:
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setLogoBackground('transparent')}
                          className={`px-2.5 py-1 rounded-md border ${logoBackground === 'transparent' ? 'border-teal-600 text-teal-700 bg-teal-50' : 'border-gray-300 text-gray-600'}`}
                        >
                          Transparent
                        </button>
                        <button
                          type="button"
                          onClick={() => setLogoBackground('white')}
                          className={`px-2.5 py-1 rounded-md border ${logoBackground === 'white' ? 'border-teal-600 text-teal-700 bg-teal-50' : 'border-gray-300 text-gray-600'}`}
                        >
                          White
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-3 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setLogoZoom(1);
                        setLogoOffsetX(0);
                        setLogoOffsetY(0);
                        setLogoBackground('transparent');
                      }}
                      className="px-3 py-1.5 text-xs border border-gray-300 rounded-lg hover:bg-gray-50"
                    >
                      Reset adjustments
                    </button>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={resetLogoEditorState}
                        className="px-3 py-1.5 text-xs border border-gray-300 rounded-lg hover:bg-gray-50"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleApplyLogoEditor}
                        disabled={logoUploading}
                        className="px-3 py-1.5 text-xs rounded-lg bg-teal-700 text-white hover:bg-teal-800 disabled:opacity-50"
                      >
                        {logoUploading ? 'Saving...' : 'Save logo'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Brand Color Section */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="text-sm font-bold text-gray-700 mb-1">Brand color</h3>
            <p className="text-xs text-gray-500 mb-3">Primary UI and document color</p>
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-3">
                <div
                  className="w-12 h-12 rounded-xl border-2 border-gray-200 shadow cursor-pointer hover:scale-105 transition-all"
                  style={{ background: data?.['company.primaryColor'] || '#0f766e' }}
                  onClick={() => colorPickerRef.current?.click()}
                  title="Pick color"
                />
                <div>
                  <p className="text-sm font-medium text-gray-700">{data?.['company.primaryColor'] || '#0f766e'}</p>
                  <button onClick={() => colorPickerRef.current?.click()} className="text-xs text-teal-600 hover:underline">Change color →</button>
                </div>
              </div>
              <input
                ref={colorPickerRef}
                type="color"
                className="w-0 h-0 opacity-0 absolute"
                value={data?.['company.primaryColor'] || '#0f766e'}
                onChange={(e) => saveMut.mutate({ 'company.primaryColor': e.target.value })}
              />
              <div className="flex gap-2 flex-wrap">
                {BRAND_COLORS.map(c => (
                  <button key={c.value} type="button"
                    onClick={() => saveMut.mutate({ 'company.primaryColor': c.value })}
                    className="w-8 h-8 rounded-full border-2 transition-all hover:scale-110 shadow"
                    style={{ background: c.value, borderColor: data?.['company.primaryColor'] === c.value ? '#111' : 'transparent' }}
                    title={c.name}
                  />
                ))}
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  defaultValue={data?.['company.primaryColor'] || '#0f766e'}
                  placeholder="#HEX"
                  maxLength={7}
                  onBlur={(e) => {
                    const v = e.target.value.trim();
                    if (/^#[0-9A-Fa-f]{6}$/.test(v)) saveMut.mutate({ 'company.primaryColor': v });
                  }}
                  className="w-28 px-2 py-1.5 border rounded-lg text-sm font-mono"
                />
                <span className="text-xs text-gray-400">Custom HEX</span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  defaultValue={data?.['company.primaryColor'] || '#0f766e'}
                  placeholder="#HEX"
                  maxLength={7}
                  onBlur={(e) => {
                    const v = e.target.value.trim();
                    if (/^#[0-9A-Fa-f]{6}$/.test(v)) saveMut.mutate({ 'company.primaryColor': v });
                  }}
                  className="w-28 px-2 py-1.5 border rounded-lg text-sm font-mono"
                />
                <span className="text-xs text-gray-400">Custom HEX</span>
              </div>
            </div>
          </div>
          {/* General Settings */}
          <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
            <h3 className="text-sm font-bold text-gray-700 mb-2">General settings</h3>
            {data && Object.entries(data).filter(([k]) => k !== 'signature').map(([key, value]) => (
              <div key={key} className="flex gap-4 items-center">
                <label className="w-48 text-sm font-medium text-gray-700">{SETTING_LABELS[key] || key}</label>
                <input
                  defaultValue={value}
                  onBlur={(e) => { if (e.target.value !== value) saveMut.mutate({ [key]: e.target.value }); }}
                  className="flex-1 px-3 py-2 border rounded-lg text-sm"
                />
              </div>
            ))}
            <hr />
            <div className="flex gap-4 items-center">
              <input placeholder="Key" value={newKey} onChange={(e) => setNewKey(e.target.value)}
                className="w-48 px-3 py-2 border rounded-lg text-sm" />
              <input placeholder="Value" value={newValue} onChange={(e) => setNewValue(e.target.value)}
                className="flex-1 px-3 py-2 border rounded-lg text-sm" />
              <button onClick={handleAdd} className="flex items-center gap-1.5 px-4 py-2 bg-teal-700 text-white rounded-lg hover:bg-teal-800 text-sm">
                <Save size={14} /> Add
              </button>
            </div>
          </div>

          {/* AI Integration */}
          <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
            <h3 className="text-sm font-bold text-gray-700 mb-2">AI assistant (OpenRouter)</h3>
            <p className="text-xs text-gray-500">
              Enter API key from <a href="https://openrouter.ai" target="_blank" rel="noopener noreferrer" className="text-indigo-600 underline">openrouter.ai</a> to enable the admin AI assistant.
              Widget is hidden when empty.
            </p>
            <div className="flex gap-4 items-center">
              <label className="w-48 text-sm font-medium text-gray-700">OpenRouter API Key</label>
              <input
                type="password"
                defaultValue={data?.['openrouter_api_key'] ?? ''}
                onBlur={(e) => { saveMut.mutate({ 'openrouter_api_key': e.target.value }); }}
                placeholder="sk-or-v1-..."
                className="flex-1 px-3 py-2 border rounded-lg text-sm font-mono"
              />
            </div>
            <div className="flex gap-4 items-center">
              <label className="w-48 text-sm font-medium text-gray-700">Model</label>
              <input
                defaultValue={data?.['openrouter_model'] ?? 'openai/gpt-4o-mini'}
                onBlur={(e) => { saveMut.mutate({ 'openrouter_model': e.target.value }); }}
                placeholder="openai/gpt-4o-mini"
                className="flex-1 px-3 py-2 border rounded-lg text-sm font-mono"
              />
            </div>
          </div>

          <div className="bg-red-50 rounded-xl border border-red-200 p-6 space-y-4">
              <div>
                <h3 className="text-sm font-bold text-red-700 mb-1">Factory Reset (Super Admin only)</h3>
                <p className="text-xs text-red-600">
                  Fully deletes site data and returns to onboarding.
                  This cannot be undone.
                </p>
                <p className="text-xs text-red-700 mt-1">Static confirmation password: <span className="font-semibold">192168130</span></p>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <input
                  type="password"
                  value={resetPassword}
                  onChange={(e) => setResetPassword(e.target.value)}
                  placeholder="Confirmation password"
                  className="px-3 py-2 border rounded-lg text-sm"
                />
                <input
                  value={resetConfirm}
                  onChange={(e) => setResetConfirm(e.target.value)}
                  placeholder="Type RESET to confirm"
                  className="px-3 py-2 border rounded-lg text-sm"
                />
              </div>

              <button
                onClick={() => resetMut.mutate(resetPassword)}
                disabled={resetMut.isPending || resetConfirm !== 'RESET' || !resetPassword}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm disabled:opacity-50"
              >
                {resetMut.isPending ? 'Resetting...' : 'Full site reset'}
              </button>
          </div>
        </div>
      )}
    </div>
  );
}
