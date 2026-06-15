import { useState, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';

const LOGO_EDITOR_OUTPUT_SIZE = 600;
const LOGO_EDITOR_PREVIEW_SIZE = 280;

const STEP_IDS = ['profile', 'branding', 'admin', 'import', 'modules', 'done'] as const;
const MODULE_KEYS = ['catalog', 'crm', 'hr', 'documents', 'reporting'] as const;
const STEP_EMOJIS = { profile: '🏪', branding: '🎨', admin: '🔐', import: '📦', modules: '⚙️', done: '🎉' } as const;
const MODULE_EMOJIS = { catalog: '📦', crm: '👥', hr: '🧑‍💼', documents: '📋', reporting: '📊' } as const;

export default function OnboardingPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const { t } = useTranslation();
  const [stepIdx, setStepIdx] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  // Build STEPS and MODULE_DEFS dynamically from i18n
  const STEPS = useMemo(() => 
    STEP_IDS.map(id => ({
      id,
      emoji: STEP_EMOJIS[id],
      title: t(`onboarding.steps.${id}.title`),
      desc: t(`onboarding.steps.${id}.desc`),
    })),
    [t]
  );

  const MODULE_DEFS = useMemo(() =>
    MODULE_KEYS.map((key) => ({
      key,
      emoji: MODULE_EMOJIS[key],
      label: t(`onboarding.modules.${key}.label`),
      desc: t(`onboarding.modules.${key}.desc`),
      required: key === 'catalog',
    })),
    [t]
  );

  // Step 1 - Store Profile
  const [storeName, setStoreName] = useState('');
  const [storeAddress, setStoreAddress] = useState('');
  const [storePhone, setStorePhone] = useState('');
  const [storeEmail, setStoreEmail] = useState('');
  const [storeWebsite, setStoreWebsite] = useState('');

  // Step 2 - Branding
  const [logoDataUrl, setLogoDataUrl] = useState<string | null>(null);
  const [primaryColor, setPrimaryColor] = useState('#0f766e');
  const logoRef = useRef<HTMLInputElement>(null);
  const colorPickerRef = useRef<HTMLInputElement>(null);

  // Logo editor state
  const [logoEditorOpen, setLogoEditorOpen] = useState(false);
  const [logoEditorUrl, setLogoEditorUrl] = useState<string | null>(null);
  const [logoZoom, setLogoZoom] = useState(1);
  const [logoOffsetX, setLogoOffsetX] = useState(0);
  const [logoOffsetY, setLogoOffsetY] = useState(0);
  const [logoBg, setLogoBg] = useState<'transparent'|'white'>('transparent');

  // Step 3 - Admin
  const [adminUsername, setAdminUsername] = useState('admin');
  const [adminFullName, setAdminFullName] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [adminConfirm, setAdminConfirm] = useState('');

  // Step 4 - Import
  const [importFile, setImportFile] = useState<File | null>(null);
  const importRef = useRef<HTMLInputElement>(null);

  // Step 5 - Modules
  const [modules, setModules] = useState<Record<string, boolean>>({
    catalog: true, crm: true, hr: true, documents: true, reporting: true,
  });

  const isDone = STEPS[stepIdx].id === 'done';
  const totalFill = STEPS.length - 1;
  const progress = Math.round((stepIdx / totalFill) * 100);

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setLogoEditorUrl(ev.target?.result as string);
      setLogoZoom(1); setLogoOffsetX(0); setLogoOffsetY(0); setLogoBg('transparent');
      setLogoEditorOpen(true);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const applyLogoEditor = async () => {
    if (!logoEditorUrl) return;
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = logoEditorUrl;
    });
    const canvas = document.createElement('canvas');
    canvas.width = LOGO_EDITOR_OUTPUT_SIZE;
    canvas.height = LOGO_EDITOR_OUTPUT_SIZE;
    const ctx = canvas.getContext('2d')!;
    if (logoBg === 'white') { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, LOGO_EDITOR_OUTPUT_SIZE, LOGO_EDITOR_OUTPUT_SIZE); }
    const scale = LOGO_EDITOR_OUTPUT_SIZE / LOGO_EDITOR_PREVIEW_SIZE;
    const dw = img.naturalWidth * logoZoom;
    const dh = img.naturalHeight * logoZoom;
    ctx.drawImage(img, (LOGO_EDITOR_OUTPUT_SIZE - dw) / 2 + logoOffsetX * scale, (LOGO_EDITOR_OUTPUT_SIZE - dh) / 2 + logoOffsetY * scale, dw, dh);
    setLogoDataUrl(canvas.toDataURL('image/png'));
    setLogoEditorOpen(false);
  };

  const canNext = () => {
    if (stepIdx === 0) return storeName.trim().length > 0;
    if (stepIdx === 2) return adminUsername.trim().length > 0 && adminPassword.length >= 6 && adminPassword === adminConfirm;
    return true;
  };

  const handleFinish = async () => {
    setSubmitting(true);
    try {
      await api.post('/onboarding/initialize', {
        storeProfile: { name: storeName, address: storeAddress, phone: storePhone, email: storeEmail, website: storeWebsite },
        branding: { brandName: storeName, logoUrl: logoDataUrl, primaryColor, locale: 'en' },
        adminAccount: { username: adminUsername, password: adminPassword, fullName: adminFullName || adminUsername },
        modules,
      });

      await login(adminUsername, adminPassword);

      if (importFile) {
        const fd = new FormData();
        fd.append('file', importFile);
        try {
          const res = await api.post('/admin/products/import', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
          const r = res.data?.data;
          if (r) toast.success(`Imported ${r.imported} products`);
        } catch {
          toast.error('Import failed. You can upload the file later in Products.');
        }
      }

      setStepIdx(5);
    } catch (err: unknown) {
      const resp = (err as { response?: { data?: { message?: string; error?: { code?: string; message?: string } } } })?.response?.data;
      const code = resp?.error?.code;
      const msg = resp?.error?.message || resp?.message;

      if (code === 'ALREADY_INITIALIZED') {
        toast.error('System is already initialized. Redirecting to login.');
        navigate('/login');
        return;
      }

      toast.error(msg || 'Setup failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const renderStep = () => {
    const step = STEPS[stepIdx].id;

    if (step === 'profile') return (
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">Store Name <span className="text-red-400">*</span></label>
          <input value={storeName} onChange={e => setStoreName(e.target.value)} autoFocus
            placeholder="YAMAHA Show Pro"
            className="w-full px-4 py-3 border border-gray-200 rounded-xl text-base focus:outline-none focus:ring-2 transition-all"
            style={{ '--tw-ring-color': primaryColor } as React.CSSProperties} />
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">Address</label>
          <input value={storeAddress} onChange={e => setStoreAddress(e.target.value)}
            placeholder="1 Musicians St, Tashkent"
            className="w-full px-4 py-3 border border-gray-200 rounded-xl text-base focus:outline-none focus:ring-2 transition-all" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Phone</label>
            <input value={storePhone} onChange={e => setStorePhone(e.target.value)}
              placeholder="+998 90 000 00 00"
              className="w-full px-4 py-3 border border-gray-200 rounded-xl text-base focus:outline-none focus:ring-2 transition-all" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Email</label>
            <input value={storeEmail} onChange={e => setStoreEmail(e.target.value)}
              type="email" placeholder="info@store.com"
              className="w-full px-4 py-3 border border-gray-200 rounded-xl text-base focus:outline-none focus:ring-2 transition-all" />
          </div>
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">Website</label>
          <input value={storeWebsite} onChange={e => setStoreWebsite(e.target.value)}
            placeholder="https://yourstore.com"
            className="w-full px-4 py-3 border border-gray-200 rounded-xl text-base focus:outline-none focus:ring-2 transition-all" />
        </div>
      </div>
    );

    if (step === 'branding') return (
      <div className="space-y-6">
        {/* Logo editor modal */}
        {logoEditorOpen && logoEditorUrl && (
          <div className="fixed inset-0 z-50 bg-black/55 flex items-center justify-center p-4">
            <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-5 space-y-4">
              <h4 className="text-base font-semibold">Logo Editor</h4>
              <div className="flex justify-center">
                <div className="relative overflow-hidden rounded-xl border border-gray-300"
                  style={{ width: LOGO_EDITOR_PREVIEW_SIZE, height: LOGO_EDITOR_PREVIEW_SIZE,
                    background: logoBg === 'white' ? '#fff' : 'linear-gradient(135deg,#f8fafc 25%,#e2e8f0 25%,#e2e8f0 50%,#f8fafc 50%,#f8fafc 75%,#e2e8f0 75%)', backgroundSize: '20px 20px' }}>
                  <img src={logoEditorUrl} alt="logo" className="absolute max-w-none pointer-events-none"
                    style={{ left:'50%', top:'50%', transform:`translate(-50%,-50%) translate(${logoOffsetX}px,${logoOffsetY}px) scale(${logoZoom})`, transformOrigin:'center' }} />
                </div>
              </div>
              <div className="space-y-2 text-xs text-gray-600">
                <label className="flex flex-col gap-1">Scale: {logoZoom.toFixed(2)}x
                  <input type="range" min={0.2} max={4} step={0.01} value={logoZoom} onChange={e => setLogoZoom(Number(e.target.value))} />
                </label>
                <label className="flex flex-col gap-1">Offset X: {logoOffsetX}px
                  <input type="range" min={-160} max={160} step={1} value={logoOffsetX} onChange={e => setLogoOffsetX(Number(e.target.value))} />
                </label>
                <label className="flex flex-col gap-1">Offset Y: {logoOffsetY}px
                  <input type="range" min={-160} max={160} step={1} value={logoOffsetY} onChange={e => setLogoOffsetY(Number(e.target.value))} />
                </label>
                <div className="flex gap-2 pt-1">
                  {(['transparent','white'] as const).map(b => (
                    <button key={b} type="button" onClick={() => setLogoBg(b)}
                      className={`px-2.5 py-1 rounded-md border text-xs ${logoBg === b ? 'border-teal-600 text-teal-700 bg-teal-50' : 'border-gray-300'}`}>
                      {b === 'transparent' ? 'Transparent' : 'White'}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setLogoEditorOpen(false)} className="px-3 py-1.5 text-sm border rounded-lg">Cancel</button>
                <button type="button" onClick={applyLogoEditor} className="px-4 py-1.5 text-sm bg-teal-700 text-white rounded-lg hover:bg-teal-800">Apply</button>
              </div>
            </div>
          </div>
        )}

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">Company Logo</label>
          <div
            onClick={() => logoRef.current?.click()}
            className="relative flex flex-col items-center justify-center border-2 border-dashed rounded-2xl p-6 cursor-pointer transition-all bg-gray-50 hover:bg-gray-100"
            style={{ minHeight: 140, borderColor: logoDataUrl ? primaryColor : '#e2e8f0' }}
          >
            {logoDataUrl
              ? <img src={logoDataUrl} alt="logo" className="max-h-20 max-w-full object-contain" />
              : <><div className="text-4xl mb-2">🖼️</div><p className="text-sm text-gray-500 text-center">Click to upload<br /><span className="text-xs">PNG, JPG, SVG - opens editor</span></p></>}
          </div>
          <input ref={logoRef} type="file" accept="image/*" className="hidden" onChange={handleLogoChange} />
          {logoDataUrl && (
            <div className="flex gap-3 mt-1.5">
              <button onClick={() => logoRef.current?.click()} className="text-xs text-teal-600 hover:underline">Change</button>
              <button onClick={() => setLogoDataUrl(null)} className="text-xs text-red-500 hover:text-red-600">Remove</button>
            </div>
          )}
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-3">Brand Color</label>
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <div
                className="w-12 h-12 rounded-xl border-2 border-gray-200 shadow cursor-pointer hover:scale-105 transition-all"
                style={{ background: primaryColor }}
                onClick={() => colorPickerRef.current?.click()}
                title="Click to choose color"
              />
              <div>
                <p className="text-sm font-medium text-gray-700">{primaryColor}</p>
                <button type="button" onClick={() => colorPickerRef.current?.click()} className="text-xs text-teal-600 hover:underline">Open palette →</button>
              </div>
              <input ref={colorPickerRef} type="color" className="w-0 h-0 opacity-0 absolute" value={primaryColor}
                onChange={e => setPrimaryColor(e.target.value)} />
            </div>
            <div className="flex gap-2 flex-wrap">
              {['#0f766e','#1d4ed8','#7c3aed','#be185d','#c2410c','#0f172a','#15803d','#b45309'].map(c => (
                <button key={c} type="button" onClick={() => setPrimaryColor(c)}
                  className="w-8 h-8 rounded-full border-2 transition-all hover:scale-110 shadow"
                  style={{ background: c, borderColor: primaryColor === c ? '#111' : 'transparent' }} />
              ))}
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 p-4 bg-white">
          <p className="text-xs text-gray-400 uppercase tracking-wider mb-3">Preview</p>
          <div className="flex items-center gap-3">
            {logoDataUrl
              ? <img src={logoDataUrl} alt="logo" className="h-10 object-contain" />
              : <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-lg font-bold shadow-md" style={{ background: primaryColor }}>{storeName?.[0]?.toUpperCase() || '?'}</div>}
            <div>
              <p className="font-bold" style={{ color: primaryColor }}>{storeName || 'Store Name'}</p>
              <p className="text-xs text-gray-400">{storeAddress || 'Address'}</p>
            </div>
          </div>
        </div>
      </div>
    );

    if (step === 'admin') return (
      <div className="space-y-4">
        <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800 flex gap-2.5">
          <span className="text-xl flex-shrink-0">⚠️</span>
          <span>Save these credentials. You will need them to sign in to admin.</span>
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">Username <span className="text-red-400">*</span></label>
          <input value={adminUsername} onChange={e => setAdminUsername(e.target.value)} autoFocus placeholder="admin"
            className="w-full px-4 py-3 border border-gray-200 rounded-xl text-base focus:outline-none focus:ring-2 transition-all" />
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">Full Name</label>
          <input value={adminFullName} onChange={e => setAdminFullName(e.target.value)}
            placeholder="John Smith"
            className="w-full px-4 py-3 border border-gray-200 rounded-xl text-base focus:outline-none focus:ring-2 transition-all" />
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">Password <span className="text-red-400">*</span> <span className="text-xs font-normal text-gray-400">(minimum 6 characters)</span></label>
          <input type="password" value={adminPassword} onChange={e => setAdminPassword(e.target.value)} placeholder="••••••••"
            className="w-full px-4 py-3 border border-gray-200 rounded-xl text-base focus:outline-none focus:ring-2 transition-all" />
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">Confirm Password <span className="text-red-400">*</span></label>
          <input type="password" value={adminConfirm} onChange={e => setAdminConfirm(e.target.value)} placeholder="••••••••"
            className={`w-full px-4 py-3 border rounded-xl text-base focus:outline-none focus:ring-2 transition-all ${adminConfirm && adminPassword !== adminConfirm ? 'border-red-300 bg-red-50' : 'border-gray-200'}`} />
          {adminConfirm && adminPassword !== adminConfirm && <p className="mt-1 text-xs text-red-500">Passwords do not match</p>}
        </div>
      </div>
    );

    if (step === 'import') return (
      <div className="space-y-4">
        <p className="text-sm text-gray-500 leading-relaxed">
          Upload an <strong>Excel (.xlsx)</strong> or <strong>CSV</strong> file with your products.
          Recommended column order for fast import:{' '}
          <code className="bg-gray-100 px-1 rounded text-xs">1) sku</code>,{' '}
          <code className="bg-gray-100 px-1 rounded text-xs">2) model</code>,{' '}
          <code className="bg-gray-100 px-1 rounded text-xs">3) price</code>,{' '}
          <code className="bg-gray-100 px-1 rounded text-xs">4) category</code>.
          You can skip this step and add products later.
        </p>
        <div
          onClick={() => importRef.current?.click()}
          className="flex flex-col items-center justify-center border-2 border-dashed rounded-2xl p-10 cursor-pointer transition-all"
          style={{ borderColor: importFile ? primaryColor : '#e2e8f0', background: importFile ? primaryColor + '08' : '#f8fafc' }}
        >
          {importFile ? (
            <>
              <div className="text-5xl mb-3">✅</div>
              <p className="font-semibold text-gray-700">{importFile.name}</p>
              <p className="text-xs text-gray-400 mt-1">{(importFile.size / 1024).toFixed(1)} KB</p>
              <button onClick={e => { e.stopPropagation(); setImportFile(null); importRef.current!.value = ''; }}
                className="mt-3 text-xs text-red-500 hover:text-red-600">Remove file</button>
            </>
          ) : (
            <>
              <div className="text-5xl mb-3">📂</div>
              <p className="text-sm font-medium text-gray-600">Click to choose file</p>
              <p className="text-xs text-gray-400 mt-1">Excel (.xlsx, .xls) or CSV</p>
            </>
          )}
        </div>
        <input ref={importRef} type="file" accept=".xlsx,.xls,.csv" className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) setImportFile(f); }} />
        <p className="text-center text-xs text-gray-400">
          or{' '}
          <button type="button" onClick={() => setStepIdx(s => s + 1)} className="underline hover:text-gray-600 transition-colors">
            skip - I will add products later
          </button>
        </p>
      </div>
    );

    if (step === 'modules') return (
      <div className="space-y-2">
        {MODULE_DEFS.map(m => (
          <label key={m.key}
            className="flex items-center gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all select-none"
            style={{ borderColor: modules[m.key] ? primaryColor : '#e2e8f0', background: modules[m.key] ? primaryColor + '08' : '#ffffff' }}
          >
            <input type="checkbox" checked={!!modules[m.key]} disabled={m.required}
              onChange={() => !m.required && setModules(p => ({ ...p, [m.key]: !p[m.key] }))}
              className="w-5 h-5 rounded flex-shrink-0"
              style={{ accentColor: primaryColor }} />
            <span className="text-2xl">{m.emoji}</span>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm text-gray-800">
                {m.label}
                {m.required && <span className="ml-2 text-xs font-normal text-gray-400">(required)</span>}
              </p>
              <p className="text-xs text-gray-500 mt-0.5">{m.desc}</p>
            </div>
          </label>
        ))}
      </div>
    );

    if (step === 'done') return (
      <div className="text-center space-y-6 py-4">
        <div className="text-7xl animate-bounce">🎉</div>
        <div>
          <h3 className="text-2xl font-bold text-gray-800">{storeName} is ready!</h3>
          <p className="text-gray-500 mt-2">System setup is complete and ready to use</p>
        </div>
        <div className="bg-gray-50 rounded-xl border border-gray-200 p-4 text-left space-y-2 text-sm">
          <p className="font-semibold text-gray-700 mb-3">Setup summary:</p>
          <p className="flex items-center gap-2 text-gray-600"><span className="text-green-500">✓</span> Store: <strong>{storeName}</strong></p>
          <p className="flex items-center gap-2 text-gray-600"><span className="text-green-500">✓</span> Administrator: <strong>{adminUsername}</strong></p>
          {importFile && <p className="flex items-center gap-2 text-gray-600"><span className="text-green-500">✓</span> Catalog imported: <strong>{importFile.name}</strong></p>}
          <p className="flex items-center gap-2 text-gray-600"><span className="text-green-500">✓</span> Active modules: <strong>{Object.values(modules).filter(Boolean).length}</strong></p>
        </div>
        <div className="bg-amber-50 rounded-xl border border-amber-200 p-4 text-left text-sm">
          <p className="font-semibold text-amber-800 mb-2">⚡ Next steps:</p>
          <ul className="space-y-1.5 text-amber-700">
            <li>→ <strong>Warranty template</strong> - customize it in Warranty Settings</li>
            <li>→ <strong>Employees</strong> - add your staff in Employees section</li>
            <li>→ <strong>Users</strong> - create accounts for staff in Users section</li>
          </ul>
        </div>
        <div className="space-y-3">
          <button onClick={() => navigate('/admin')}
            className="w-full py-3.5 rounded-xl text-white font-semibold text-base transition-all hover:opacity-90 active:scale-[0.98] shadow-lg"
            style={{ background: primaryColor }}>
            Open Admin Dashboard →
          </button>
          <button onClick={() => navigate('/admin/warranty-template')}
            className="w-full py-3 rounded-xl border-2 font-medium transition-all hover:opacity-90"
            style={{ borderColor: primaryColor, color: primaryColor }}>
            Configure Warranty Template
          </button>
          <button onClick={() => navigate('/catalog')}
            className="w-full py-3 rounded-xl border-2 border-gray-200 text-gray-600 font-medium hover:border-gray-300 transition-all">
            Customer Catalog
          </button>
        </div>
      </div>
    );

    return null;
  };

  return (
    <div className="min-h-screen flex" style={{ background: `linear-gradient(135deg, ${primaryColor}18 0%, #f8fafc 50%, ${primaryColor}0d 100%)` }}>
      {/* Sidebar */}
      <div className="hidden lg:flex flex-col justify-between w-80 p-10 flex-shrink-0" style={{ background: primaryColor }}>
        <div>
          {logoDataUrl
            ? <img src={logoDataUrl} alt="logo" className="h-10 mb-10 object-contain brightness-0 invert" />
            : <div className="text-2xl font-bold text-white mb-10">Configurable Platform</div>}
          <h2 className="text-xl font-bold text-white mb-1">{t('onboarding.title')}</h2>
          <p className="text-white/60 text-sm mb-8">{t('onboarding.subtitle')}</p>
        </div>
        <div className="space-y-1 flex-1">
          {STEPS.map((s, i) => (
            <div key={s.id}
              className={`flex items-center gap-3 py-2.5 px-3 rounded-xl transition-all ${i === stepIdx ? 'bg-white/20' : i < stepIdx ? 'opacity-70' : 'opacity-30'}`}
            >
              <span className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 transition-all"
                style={{ background: i < stepIdx ? 'white' : 'rgba(255,255,255,0.2)', color: i < stepIdx ? primaryColor : 'white' }}>
                {i < stepIdx ? '✓' : i + 1}
              </span>
              <span className="text-sm font-medium text-white">{s.title}</span>
            </div>
          ))}
        </div>
        <p className="text-white/30 text-xs mt-8">{t('onboarding.platformVersion')}</p>
      </div>

      {/* Main */}
      <div className="flex-1 flex items-center justify-center p-6 overflow-y-auto">
        <div className="w-full max-w-lg">
          {/* Mobile progress bar */}
          <div className="lg:hidden mb-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-gray-400">{t('onboarding.step', { current: stepIdx + 1, total: STEPS.length })}</span>
              <span className="text-xs font-medium text-gray-600">{t('onboarding.progress', { percent: progress })}</span>
            </div>
            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all duration-500 ease-out" style={{ width: `${progress}%`, background: primaryColor }} />
            </div>
          </div>

          {!isDone && (
            <div className="mb-8">
              <span className="text-5xl">{STEPS[stepIdx].emoji}</span>
              <h1 className="text-2xl font-bold text-gray-900 mt-3">{STEPS[stepIdx].title}</h1>
              <p className="text-gray-500 text-sm mt-1">{STEPS[stepIdx].desc}</p>
            </div>
          )}

          <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8">
            {renderStep()}
            {!isDone && (
              <div className="flex gap-3 mt-8">
                {stepIdx > 0 && (
                  <button type="button" onClick={() => setStepIdx(s => s - 1)}
                    className="flex-1 py-3 border-2 border-gray-200 rounded-xl font-semibold text-gray-600 hover:border-gray-300 hover:bg-gray-50 transition-all">
                    {t('onboarding.buttons.back')}
                  </button>
                )}
                <button type="button"
                  disabled={!canNext() || submitting}
                  onClick={() => stepIdx === STEPS.length - 2 ? handleFinish() : setStepIdx(s => s + 1)}
                  className="flex-1 py-3 rounded-xl font-semibold text-white transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed shadow-md"
                  style={{ background: primaryColor }}>
                  {submitting ? t('onboarding.buttons.loading') : stepIdx === STEPS.length - 2 ? t('onboarding.buttons.finish') : t('onboarding.buttons.next')}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
