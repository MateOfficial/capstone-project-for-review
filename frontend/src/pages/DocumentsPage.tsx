import { useState, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { Link, useNavigate } from 'react-router-dom';
import type { Product, ApiResponse, PageResponse, WarrantyRule, DocumentTemplate } from '../types';
import { ArrowLeft, Check, Printer, Shield, FileText } from 'lucide-react';
import {
  buildObligationHtml,
  DEFAULT_WARRANTY_TEMPLATE,
  DEFAULT_WARRANTY_TEMPLATE_CONFIG,
  parseSimpleWarrantyTemplate,
  renderCustomWarrantyLayout,
  renderWarrantyTemplate,
  resolveWarrantyTemplateHtml,
  WARRANTY_TEMPLATE_TYPE,
} from '../lib/warrantyTemplate';
import {
  getBrandProfile,
  parseBrandProfiles,
  resolveBrandLogo,
  WARRANTY_BRAND_PROFILES_KEY,
} from '../lib/warrantyBrands';

const pub = axios.create({ baseURL: '/api' });
const fmt = (n: number) => new Intl.NumberFormat('en-US').format(n) + ' sum';

type Tab = 'warranty' | 'issuance';

const WARRANTY_LOGO_MODE_KEY = 'warranty.logoMode';
const WARRANTY_DEFAULT_TERMS_KEY = 'warranty.defaultTerms';

type WarrantyLogoMode = 'company' | 'brand' | 'none';

const normalizeLogoMode = (value: string | undefined): WarrantyLogoMode => {
  if (value === 'company' || value === 'brand' || value === 'none') return value;
  return 'company';
};

export default function DocumentsPage() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<Tab>('warranty');

  return (
    <div className="min-h-screen bg-transparent sf-fade-in">
      <header className="bg-white/85 backdrop-blur-md shadow-sm border-b border-slate-200/80">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-4">
          <Link to="/catalog" className="flex items-center gap-1.5 text-sm text-teal-700 hover:text-teal-800">
            <ArrowLeft size={16} /> {t('common.catalog')}
          </Link>
          <h1 className="text-lg font-bold text-slate-900">{t('pages.documents.title')}</h1>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          {([
            { id: 'warranty' as Tab, icon: Shield, label: t('pages.documents.warranty') },
            { id: 'issuance' as Tab, icon: FileText, label: t('pages.documents.issuance') },
          ]).map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                tab === t.id ? 'bg-teal-700 text-white shadow-md' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}>
              <t.icon size={16} /> {t.label}
            </button>
          ))}
        </div>

        {tab === 'warranty' && <WarrantyGenerator />}
        {tab === 'issuance' && <IssuanceActForm />}
      </div>
    </div>
  );
}

// ─── Warranty Generator ──────────────────────────────────
function WarrantyGenerator() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');
  const [serial, setSerial] = useState('');
  const [modelSearch, setModelSearch] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [matched, setMatched] = useState<Product | null>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'success'>('idle');
  const [lastWarranty, setLastWarranty] = useState<{ id: string; model: string; brand: string; duration: number; serial: string; createdAt: string } | null>(null);
  const [clientSearch, setClientSearch] = useState('');
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [selectedClientId, setSelectedClientId] = useState<number | null>(null);
  const [showClientSuggestions, setShowClientSuggestions] = useState(false);
  const serialRef = useRef<HTMLInputElement>(null);

  const { data: products } = useQuery({
    queryKey: ['pub-products-all'],
    queryFn: () => pub.get<ApiResponse<PageResponse<Product>>>('/public/products', { params: { size: 5000 } }).then(r => r.data.data.content),
    staleTime: 300000,
  });

  const { data: settings } = useQuery({
    queryKey: ['pub-settings'],
    queryFn: () => pub.get('/public/settings').then(r => r.data.data),
  });

  const { data: warrantyRules } = useQuery({
    queryKey: ['pub-warranty-rules'],
    queryFn: () => pub.get<ApiResponse<WarrantyRule[]>>('/public/warranty-rules').then(r => r.data.data),
  });

  const { data: clientResults } = useQuery({
    queryKey: ['pub-clients-search-warranty', clientSearch],
    queryFn: () => pub.get<ApiResponse<PageResponse<{ id: number; fullName: string; phone: string }>>>('/public/clients/search', { params: { q: clientSearch || undefined, size: 20 } }).then(r => r.data.data.content),
    enabled: clientSearch.trim().length >= 2,
    retry: false,
    staleTime: 10000,
  });

  const { data: activeTemplate } = useQuery({
    queryKey: ['public-active-template', WARRANTY_TEMPLATE_TYPE],
    queryFn: () => pub
      .get<ApiResponse<DocumentTemplate | null>>('/public/templates/active', { params: { type: WARRANTY_TEMPLATE_TYPE } })
      .then(r => r.data.data),
  });

  const profileBrands = parseBrandProfiles((settings as Record<string, string> | undefined)?.[WARRANTY_BRAND_PROFILES_KEY])
    .map((profile) => String(profile.brand || '').toUpperCase())
    .filter(Boolean);
  const brands = Array.from(new Set([
    ...(warrantyRules?.map(rule => rule.brand.toUpperCase()) ?? []),
    ...profileBrands,
  ]));
  const selectedRule = warrantyRules?.find(rule => rule.brand.toUpperCase() === brand);
  const duration = brand ? selectedRule?.durationMonths || 12 : 12;

  const normalizedModelSearch = modelSearch.trim().toLowerCase();
  const filtered = (products || []).filter(p => {
    if (normalizedModelSearch.length < 2) return false;
    const productName = (p.name || '').toLowerCase();
    const productCode = (p.code || '').toLowerCase();
    return productName.includes(normalizedModelSearch) || productCode.includes(normalizedModelSearch);
  }).slice(0, 8);

  const selectProduct = (p: Product) => {
    setModel(p.name);
    setModelSearch(p.name);
    setMatched(p);
    setShowSuggestions(false);
    const detectedBrand = brands.find(b => p.name.toUpperCase().includes(b) || (p.categoryName || '').toUpperCase().includes(b));
    if (detectedBrand) setBrand(detectedBrand);
    setTimeout(() => serialRef.current?.focus(), 100);
  };

  const signature = (settings as Record<string, string> | undefined)?.signature || '';

  const handlePrint = async () => {
    if (!model || !brand) return;
    setStatus('loading');

    try {
      const resp = await pub.post('/public/warranties', {
        model, serialNumber: serial, brand, durationMonths: duration,
        signatureData: signature,
        clientId: selectedClientId || null,
        clientName: clientName.trim() || clientSearch.replace(/\s*\(.*\)\s*$/, '').trim() || null,
        clientPhone: clientPhone.trim() || null,
      });
      const w = resp.data.data;
      setLastWarranty(w);
      setStatus('success');

      // Generate and print warranty HTML
      printWarrantyHTML(
        w,
        signature,
        (settings as Record<string, string> | undefined)?.[WARRANTY_DEFAULT_TERMS_KEY],
        activeTemplate?.content || undefined,
        settings as Record<string, string> | undefined,
      );

      // Reset for next
      setModel(''); setSerial(''); setModelSearch(''); setMatched(null);
      setClientSearch(''); setClientName(''); setSelectedClientId(null); setClientPhone('');
      // Navigate back to catalog after brief success message
      setTimeout(() => { 
        setStatus('idle'); 
        navigate('/catalog', { replace: true });
      }, 1500);
    } catch {
      setStatus('idle');
      alert(t('pages.warranty.errorCreating'));
    }
  };

  const handleSerialEnter = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && model && brand) {
      e.preventDefault();
      handlePrint();
    }
  };

  return (
    <div className="grid md:grid-cols-2 gap-6">
      <div className="bg-white rounded-2xl border border-gray-200 p-6">
        <div className="text-center mb-5">
          <div className="w-14 h-14 mx-auto bg-indigo-100 rounded-2xl flex items-center justify-center mb-3">
            <Shield size={28} className="text-indigo-600" />
          </div>
          <h2 className="text-xl font-bold text-gray-800">{t('pages.warranty.title')}</h2>
        </div>

        {/* Brand chips */}
        <div className="mb-4">
          <label className="text-sm font-medium text-gray-700 mb-2 block">{t('pages.warranty.brand')}</label>
          <div className="flex flex-wrap gap-2">
            {brands.map(b => {
              const rule = warrantyRules?.find((item) => item.brand.toUpperCase() === b);
              const brandDuration = rule?.durationMonths || 12;
              return (
              <button key={b} onClick={() => setBrand(b)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                  brand === b ? 'bg-indigo-600 text-white shadow-md' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}>
                {b} <span className="opacity-60 ml-1">{brandDuration}{t('pages.warranty.warranty_months')}</span>
              </button>
              );
            })}
          </div>
        </div>

        {/* Model with autocomplete */}
        <div className="relative mb-4">
          <label className="text-sm font-medium text-gray-700">{t('pages.warranty.modelRequired')}</label>
          <input value={modelSearch || model}
            onChange={e => { setModelSearch(e.target.value); setModel(e.target.value); setShowSuggestions(true); setMatched(null); }}
            onFocus={() => modelSearch.length >= 2 && setShowSuggestions(true)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
            placeholder={t('pages.warranty.modelPlaceholder')}
            className="w-full mt-1 px-4 py-2.5 border rounded-xl text-sm focus:ring-2 focus:ring-indigo-300 focus:outline-none" />
          {showSuggestions && filtered.length > 0 && (
            <div className="absolute z-10 w-full mt-1 bg-white border rounded-xl shadow-lg max-h-48 overflow-y-auto">
              {filtered.map(p => (
                <button key={p.id} onClick={() => selectProduct(p)}
                  className="w-full text-left px-4 py-2.5 hover:bg-gray-50 text-sm border-b last:border-0">
                  <span className="font-medium">{p.name}</span>
                  <span className="ml-2 text-xs text-gray-400">{p.code}</span>
                  {p.price > 0 && <span className="float-right text-xs text-gray-500">{fmt(p.price)}</span>}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Matched product card */}
        {matched && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-3 flex items-center gap-3 mb-4">
            <Check size={18} className="text-green-600 flex-shrink-0" />
            <div className="text-sm"><p className="font-medium text-green-800">{matched.name}</p>
              <p className="text-green-600 text-xs">{matched.code} · {matched.categoryName}{matched.price > 0 ? ` · ${fmt(matched.price)}` : ''}</p></div>
          </div>
        )}

        {/* Serial */}
        <div className="mb-4">
          <label className="text-sm font-medium text-gray-700">{t('pages.warranty.serialNumber')}</label>
          <input ref={serialRef} value={serial} onChange={e => setSerial(e.target.value)}
            onKeyDown={handleSerialEnter}
            placeholder={t('pages.warranty.serialPlaceholder')}
            className="w-full mt-1 px-4 py-2.5 border rounded-xl text-sm font-mono focus:ring-2 focus:ring-indigo-300 focus:outline-none" />
          <p className="text-[10px] text-gray-400 mt-1">{t('pages.warranty.serialHint')}</p>
        </div>

        {/* Duration display */}
        {brand && (
          <div className="bg-indigo-50 rounded-xl p-3 mb-4 text-center">
            <p className="text-sm text-indigo-700">{t('pages.warranty.duration', { months: duration, brand })}</p>
          </div>
        )}

        {/* Client selector */}
        <div className="mb-4">
          <label className="text-sm font-medium text-gray-700">{t('pages.warranty.clientSearch')}</label>
          <div className="relative mt-1">
            <input
              value={clientSearch}
              onChange={e => { setClientSearch(e.target.value); setSelectedClientId(null); setShowClientSuggestions(true); }}
              onFocus={() => setShowClientSuggestions(true)}
              onBlur={() => setTimeout(() => setShowClientSuggestions(false), 200)}
              placeholder={t('pages.warranty.clientSearchPlaceholder')}
              className="w-full px-4 py-2.5 border rounded-xl text-sm focus:ring-2 focus:ring-indigo-300 focus:outline-none"
            />
            {showClientSuggestions && (clientResults?.length ?? 0) > 0 && (
              <div className="absolute z-10 w-full mt-1 bg-white border rounded-xl shadow-lg max-h-40 overflow-y-auto">
                {clientResults!.map(c => (
                  <button type="button" key={c.id} onClick={() => { setSelectedClientId(c.id); setClientSearch(c.fullName + (c.phone ? ` (${c.phone})` : '')); setClientName(c.fullName); setClientPhone(c.phone || ''); setShowClientSuggestions(false); }}
                    className="w-full text-left px-4 py-2.5 hover:bg-gray-50 text-sm border-b last:border-0">
                    <span className="font-medium">{c.fullName}</span>
                    {c.phone && <span className="ml-2 text-xs text-gray-400">{c.phone}</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
          {selectedClientId && <p className="text-xs text-green-600 mt-1">✓ {t('pages.warranty.clientBound')}</p>}
          <div className="mt-2">
            <label className="text-sm font-medium text-gray-700">{t('pages.warranty.clientName')}</label>
            <input
              value={clientName}
              onChange={e => setClientName(e.target.value)}
              placeholder={t('pages.warranty.clientNamePlaceholder')}
              className="w-full mt-1 px-4 py-2.5 border rounded-xl text-sm focus:ring-2 focus:ring-indigo-300 focus:outline-none"
            />
          </div>
          <div className="mt-2">
            <label className="text-sm font-medium text-gray-700">{t('pages.warranty.clientPhone')}</label>
            <input
              value={clientPhone}
              onChange={e => setClientPhone(e.target.value)}
              placeholder={t('pages.warranty.clientPhonePlaceholder')}
              className="w-full mt-1 px-4 py-2.5 border rounded-xl text-sm focus:ring-2 focus:ring-indigo-300 focus:outline-none"
            />
          </div>
        </div>

        {/* Buttons */}
        <div className="grid grid-cols-2 gap-3">
          <button onClick={handlePrint} disabled={!model || !brand || status === 'loading'}
            className="flex items-center justify-center gap-2 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">
            <Printer size={16} /> {t('pages.warranty.print')}
          </button>
          <button onClick={() => { setModel(''); setSerial(''); setModelSearch(''); setMatched(null); setBrand(''); }}
            className="py-2.5 border rounded-xl text-sm text-gray-600 hover:bg-gray-50">
            {t('pages.warranty.clear')}
          </button>
        </div>

        {status === 'success' && lastWarranty && (
          <p className="text-center text-green-600 text-sm font-medium mt-3">{t('pages.documents.successWarranty', { id: lastWarranty.id })}</p>
        )}
      </div>

      {/* Preview card */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6">
        <h3 className="text-sm font-bold text-gray-700 mb-4">{t('pages.warranty.preview')}</h3>
        {model && brand ? (
          <div className="border-2 border-gray-200 rounded-xl p-5 text-center space-y-3">
            <p className="text-xs text-gray-500 uppercase tracking-wider">{t('pages.warranty.title')}</p>
            <p className="text-lg font-bold text-gray-800">{brand}</p>
            <div className="grid grid-cols-2 gap-3 text-left">
              <div><p className="text-[10px] text-gray-400 uppercase">{t('pages.warranty.model')}</p><p className="text-sm font-medium">{model}</p></div>
              <div><p className="text-[10px] text-gray-400 uppercase">{t('pages.warranty.serialNumber')}</p><p className="text-sm font-mono">{serial || '—'}</p></div>
              <div><p className="text-[10px] text-gray-400 uppercase">{t('pages.warranty.duration')}</p><p className="text-sm font-medium">{duration} {t('pages.warranty.warranty_months')}</p></div>
              <div><p className="text-[10px] text-gray-400 uppercase">Date</p><p className="text-sm">{new Date().toLocaleDateString('en-US')}</p></div>
            </div>
          </div>
        ) : (
          <div className="text-center py-12 text-gray-300">
            <Shield size={48} className="mx-auto mb-3 opacity-50" />
            <p className="text-sm">{t('pages.warranty.selectBrandModel')}</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Issuance Act Form ──────────────────────────────────
function IssuanceActForm() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    model: '', serialNumber: '', price: '', returnDate: '', clientName: '', clientPhone: '',
    condition: 'New', completeness: ['packaging', 'wrapping', 'plasticBags', 'manual', 'cables'] as string[],
    notes: '',
  });
  const [clientId, setClientId] = useState<number | null>(null);
  const [clientSearch, setClientSearch] = useState('');
  const [showClientSuggestions, setShowClientSuggestions] = useState(false);
  const [modelSearch, setModelSearch] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [status, setStatus] = useState<'idle' | 'loading' | 'success'>('idle');

  const { data: products } = useQuery({
    queryKey: ['pub-products-all'],
    queryFn: () => pub.get<ApiResponse<PageResponse<Product>>>('/public/products', { params: { size: 5000 } }).then(r => r.data.data.content),
    staleTime: 300000,
  });

  const { data: issuanceSettings } = useQuery({
    queryKey: ['pub-settings'],
    queryFn: () => pub.get('/public/settings').then(r => r.data.data),
  });

  const { data: clientResults } = useQuery({
    queryKey: ['pub-clients-search-issuance', clientSearch],
    queryFn: () => pub.get<ApiResponse<PageResponse<{ id: number; fullName: string; phone: string }>>>('/public/clients/search', { params: { q: clientSearch || undefined, size: 20 } }).then(r => r.data.data.content),
    staleTime: 10000,
  });

  const normalizedModelSearch = modelSearch.trim().toLowerCase();
  const filtered = (products || []).filter(p => {
    if (normalizedModelSearch.length < 2) return false;
    const productName = (p.name || '').toLowerCase();
    const productCode = (p.code || '').toLowerCase();
    return productName.includes(normalizedModelSearch) || productCode.includes(normalizedModelSearch);
  }).slice(0, 8);

  const selectProduct = (p: Product) => {
    setForm(f => ({ ...f, model: p.name, price: p.discountedPrice ? String(p.discountedPrice) : String(p.price) }));
    setModelSearch(p.name);
    setShowSuggestions(false);
  };

  const COMPLETENESS_OPTIONS = ['packaging', 'wrapping', 'plasticBags', 'manual', 'cables'];
  const toggleCompleteness = (item: string) => {
    setForm(f => ({
      ...f,
      completeness: f.completeness.includes(item) ? f.completeness.filter(c => c !== item) : [...f.completeness, item],
    }));
  };

  const issuanceSignature = (issuanceSettings as Record<string, string> | undefined)?.signature || '';

  const CONDITION_MAP: Record<string, string> = { 'New': 'new', 'Display': 'display', 'Other': 'other' };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('loading');
    try {
      const resp = await pub.post('/public/issuances', {
        ...form,
        clientId: clientId || null,
        condition: CONDITION_MAP[form.condition] ?? form.condition,
        signatureData: issuanceSignature,
      });
      const act = resp.data.data;
      printIssuanceHTML(act, form, issuanceSignature);
      setStatus('success');
      setForm({ model: '', serialNumber: '', price: '', returnDate: '', clientName: '', clientPhone: '', condition: 'New', completeness: ['packaging', 'wrapping', 'plasticBags', 'manual', 'cables'], notes: '' });
      setModelSearch('');
      setClientSearch(''); setClientId(null);
      // Navigate back to catalog after brief success message
      setTimeout(() => {
        setStatus('idle');
        navigate('/catalog', { replace: true });
      }, 1500);
    } catch {
      setStatus('idle');
      alert(t('pages.issuance.errorCreating'));
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-6 max-w-2xl mx-auto">
      <div className="text-center mb-6">
        <div className="w-14 h-14 mx-auto bg-amber-100 rounded-2xl flex items-center justify-center mb-3">
          <FileText size={28} className="text-amber-600" />
        </div>
        <h2 className="text-xl font-bold text-gray-800">{t('pages.issuance.title')}</h2>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Model with autocomplete */}
        <div className="relative">
          <label className="text-sm font-medium text-gray-700">{t('pages.issuance.modelRequired')}</label>
          <input value={modelSearch || form.model}
            onChange={e => { setModelSearch(e.target.value); setForm(f => ({ ...f, model: e.target.value })); setShowSuggestions(true); }}
            onFocus={() => modelSearch.length >= 2 && setShowSuggestions(true)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
            placeholder={t('pages.issuance.modelPlaceholder')}
            className="w-full mt-1 px-4 py-2.5 border rounded-xl text-sm focus:ring-2 focus:ring-amber-300 focus:outline-none" />
          {showSuggestions && filtered.length > 0 && (
            <div className="absolute z-10 w-full mt-1 bg-white border rounded-xl shadow-lg max-h-48 overflow-y-auto">
              {filtered.map(p => (
                <button type="button" key={p.id} onClick={() => selectProduct(p)}
                  className="w-full text-left px-4 py-2.5 hover:bg-gray-50 text-sm border-b last:border-0">
                  <span className="font-medium">{p.name}</span>
                  {p.price > 0 && <span className="float-right text-xs text-gray-500">{fmt(p.price)}</span>}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium text-gray-700">{t('pages.issuance.serialNumber')}</label>
            <input value={form.serialNumber} onChange={e => setForm({ ...form, serialNumber: e.target.value })}
              className="w-full mt-1 px-4 py-2.5 border rounded-xl text-sm" />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700">{t('pages.issuance.cost')}</label>
            <input required value={form.price} onChange={e => setForm({ ...form, price: e.target.value })}
              className="w-full mt-1 px-4 py-2.5 border rounded-xl text-sm" />
          </div>
        </div>

        <div>
          <label className="text-sm font-medium text-gray-700">{t('pages.issuance.returnDate')}</label>
          <input required type="date" value={form.returnDate} onChange={e => setForm({ ...form, returnDate: e.target.value })}
            className="w-full mt-1 px-4 py-2.5 border rounded-xl text-sm" />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium text-gray-700">{t('pages.issuance.clientFromDatabase')}</label>
            <div className="relative mt-1">
              <input
                value={clientSearch}
                onChange={e => { setClientSearch(e.target.value); setClientId(null); setShowClientSuggestions(true); }}
                onFocus={() => setShowClientSuggestions(true)}
                onBlur={() => setTimeout(() => setShowClientSuggestions(false), 200)}
                placeholder={t('pages.issuance.clientSearchPlaceholder')}
                className="w-full px-4 py-2.5 border rounded-xl text-sm focus:ring-2 focus:ring-amber-300 focus:outline-none"
              />
              {showClientSuggestions && (clientResults?.length ?? 0) > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-white border rounded-xl shadow-lg max-h-40 overflow-y-auto">
                  {clientResults!.map(c => (
                    <button type="button" key={c.id} onClick={() => {
                      setClientId(c.id);
                      setClientSearch(c.fullName + (c.phone ? ` (${c.phone})` : ''));
                      setForm(f => ({ ...f, clientName: c.fullName, clientPhone: c.phone || f.clientPhone }));
                      setShowClientSuggestions(false);
                    }} className="w-full text-left px-4 py-2.5 hover:bg-gray-50 text-sm border-b last:border-0">
                      <span className="font-medium">{c.fullName}</span>
                      {c.phone && <span className="ml-2 text-xs text-gray-400">{c.phone}</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {clientId && <p className="text-xs text-green-600 mt-1">✓ {t('pages.warranty.clientBound')}</p>}
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700">{t('pages.issuance.clientName')} *</label>
            <input required value={form.clientName} onChange={e => setForm({ ...form, clientName: e.target.value })}
              className="w-full mt-1 px-4 py-2.5 border rounded-xl text-sm" />
          </div>
        </div>

        <div>
          <label className="text-sm font-medium text-gray-700">{t('pages.issuance.clientPhone')} *</label>
          <input required type="tel" value={form.clientPhone} onChange={e => setForm({ ...form, clientPhone: e.target.value })}
            className="w-full mt-1 px-4 py-2.5 border rounded-xl text-sm" />
        </div>

        {/* Condition radios */}
        <div>
          <label className="text-sm font-medium text-gray-700 mb-2 block">{t('pages.issuance.condition')}</label>
          <div className="flex gap-3">
            {['New', 'Display', 'Other'].map(c => (
              <label key={c} className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-sm cursor-pointer transition-colors ${
                form.condition === c ? 'bg-amber-50 border-amber-300 text-amber-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}>
                <input type="radio" name="condition" checked={form.condition === c} onChange={() => setForm({ ...form, condition: c })} className="sr-only" />
                {t(`pages.issuance.condition${c}`)}
              </label>
            ))}
          </div>
        </div>

        {/* Completeness checkboxes */}
        <div>
          <label className="text-sm font-medium text-gray-700 mb-2 block">{t('pages.issuance.completeness')}</label>
          <div className="flex flex-wrap gap-2">
            {COMPLETENESS_OPTIONS.map(item => (
              <label key={item} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs cursor-pointer transition-colors ${
                form.completeness.includes(item) ? 'bg-green-50 border-green-300 text-green-700' : 'border-gray-200 text-gray-500'
              }`}>
                <input type="checkbox" checked={form.completeness.includes(item)} onChange={() => toggleCompleteness(item)} className="sr-only" />
                {form.completeness.includes(item) ? '✓' : '○'} {t(`pages.issuance.${item}`)}
              </label>
            ))}
          </div>
        </div>

        <div>
          <label className="text-sm font-medium text-gray-700">{t('pages.issuance.notes')}</label>
          <textarea rows={2} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })}
            className="w-full mt-1 px-4 py-2.5 border rounded-xl text-sm" />
        </div>

        <button type="submit" disabled={status === 'loading'}
          className="w-full flex items-center justify-center gap-2 py-3 bg-amber-600 text-white rounded-xl font-medium hover:bg-amber-700 disabled:opacity-50">
          <Printer size={16} /> {t('pages.issuance.submit')}
        </button>
        {status === 'success' && <p className="text-center text-green-600 text-sm font-medium">{t('pages.documents.successIssuance', { id: 'ACT' })}</p>}
      </form>
    </div>
  );
}

// ─── Print Helpers ──────────────────────────────────

function printWarrantyHTML(
  w: any,
  signature: string,
  customTerms?: string,
  templateContent?: string,
  publicSettings?: Record<string, string>,
) {
  const startDate = new Date(w.createdAt || Date.now());
  const endDate = new Date(startDate);
  const durationMonths = w.durationMonths || 12;
  endDate.setMonth(startDate.getMonth() + durationMonths);
  endDate.setDate(endDate.getDate() - 1);

  const startDateStr = startDate.toLocaleDateString('en-US', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const endDateStr = endDate.toLocaleDateString('en-US', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const brandKey = String(w.brand || 'YAMAHA').trim().toLowerCase();
  const warrantyId = w.warrantyNumber || w.id || '—';
  const brandNames: Record<string, string> = {
    yamaha: 'YAMAHA TASHKENT',
    zoom: 'YAMAHA TASHKENT',
    omnitronic: 'YAMAHA TASHKENT',
    neumann: 'YAMAHA TASHKENT',
    shure: 'YAMAHA TASHKENT',
    sennheiser: 'YAMAHA TASHKENT',
  };
  const logoMode = normalizeLogoMode(publicSettings?.[WARRANTY_LOGO_MODE_KEY]);
  const uploadedLogo = (publicSettings?.['company.logo'] || '').trim();
  const brandProfiles = parseBrandProfiles(publicSettings?.[WARRANTY_BRAND_PROFILES_KEY]);
  const brandProfile = getBrandProfile(brandProfiles, brandKey);
  const brandLogo = resolveBrandLogo(brandProfiles, brandKey);
  const effectiveLogoMode: WarrantyLogoMode = logoMode === 'company' && !uploadedLogo ? 'brand' : logoMode;
  const logoUrl = effectiveLogoMode === 'none'
    ? ''
    : effectiveLogoMode === 'brand'
      ? (brandLogo || uploadedLogo)
      : (uploadedLogo || brandLogo);
  const brandName = brandNames[brandKey] || brandNames.yamaha;
  const escapeHtml = (value: unknown) => String(value ?? '—')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
  const termsText = (customTerms && customTerms.trim()) || '';
  const termsContentHtml = `<div class="terms-custom">${escapeHtml(termsText).replace(/\n/g, '<br/>')}</div>`;
  const simpleConfig = parseSimpleWarrantyTemplate(templateContent);
  const templateHtml = resolveWarrantyTemplateHtml(templateContent || DEFAULT_WARRANTY_TEMPLATE);
  const config = simpleConfig || DEFAULT_WARRANTY_TEMPLATE_CONFIG;
  const obligationHtml = buildObligationHtml(config.obligationText, {
    brandName,
    durationMonths,
  });
  const html = renderWarrantyTemplate(templateHtml, {
    TITLE_ID: escapeHtml(w.serialNumber || warrantyId),
    BRAND_UPPER: escapeHtml(String(w.brand || 'YAMAHA').toUpperCase()),
    BRAND_NAME: escapeHtml(brandName),
    DURATION_MONTHS: String(durationMonths),
    BRAND_SUBTITLE: escapeHtml(config.brandSubtitle),
    HEADER_TITLE_EN: escapeHtml(config.headerTitleEn),
    HEADER_TITLE_RU: escapeHtml(config.headerTitleRu),
    SERVICE_LABEL: escapeHtml(config.serviceLabel),
    SERVICE_LOCATION: escapeHtml(config.serviceLocation),
    OBLIGATION_HTML: obligationHtml,
    MODEL: escapeHtml(w.model),
    START_DATE: startDateStr,
    SERIAL_NUMBER: escapeHtml(w.serialNumber),
    END_DATE: endDateStr,
    WARRANTY_ID: escapeHtml(warrantyId),
    TERMS_TITLE: escapeHtml(config.termsTitle),
    TERMS_HTML: termsContentHtml,
    SIGNATURE_HTML: signature ? `<img src="${signature}" class="sig-image" />` : '',
    SELLER_SIGNATURE_LABEL: escapeHtml(config.sellerSignatureLabel),
    LOGO_URL: logoUrl,
    LOGO_STYLE: !logoUrl ? 'display: none;' : '',
  });

  const hasCustomBlocks = (config.textBlocks?.length || 0) > 0;
  const finalHtml = (config.backgroundImage || hasCustomBlocks)
    ? renderCustomWarrantyLayout(
        {
          BRAND_UPPER: String(w.brand || 'YAMAHA').toUpperCase(),
          BRAND_NAME: String(brandName || ''),
          DURATION_MONTHS: String(durationMonths),
          LOGO_URL: String(logoUrl || ''),
          OBLIGATION_HTML: obligationHtml,
          MODEL: String(w.model ?? ''),
          SERIAL_NUMBER: String(w.serialNumber ?? ''),
          WARRANTY_ID: String(warrantyId ?? ''),
          TITLE_ID: String(w.serialNumber || warrantyId || ''),
          START_DATE: startDateStr,
          END_DATE: endDateStr,
          BRAND_LOGO_URL: brandLogo || '',
          BRAND_LOGO_X: String(brandProfile?.logoX ?? 10),
          BRAND_LOGO_Y: String(brandProfile?.logoY ?? 8),
          BRAND_LOGO_WIDTH: String(brandProfile?.logoWidth ?? 20),
          BRAND_LOGO_HEIGHT: String(brandProfile?.logoHeight ?? 10),
          WARRANTY_TERMS_TEXT: termsText,
          TERMS_HTML: termsContentHtml,
          SIGNATURE_HTML: signature ? `<img src="${signature}" class="sig-image" />` : '',
        },
        config,
      )
    : html;

  const win = window.open('', '_blank');
  if (win) { win.document.write(finalHtml); win.document.close(); setTimeout(() => win.print(), 300); }
}

function printIssuanceHTML(act: any, form: any, signature: string) {
  const fmtDate = (d: string) => d ? new Date(d).toLocaleDateString('en-US') : '—';
  const fmtPrice = (n: string | number) => new Intl.NumberFormat('en-US').format(Number(n)) + ' sum';

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;900&display=swap" rel="stylesheet">
<style>
  @page { size: A4; margin: 15mm; }
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: 'Inter', sans-serif; color: #111; font-size: 13px; line-height: 1.5; }
  .header { text-align:center; margin-bottom:20px; padding-bottom:12px; border-bottom:3px solid #111; }
  .header h1 { font-size:16px; font-weight:900; text-transform:uppercase; margin-top:8px; }
  .header p { font-size:11px; color:#666; }
  .company { font-size:12px; color:#555; margin-bottom:16px; }
  .section { margin-bottom:16px; }
  .section-title { font-size:12px; font-weight:700; text-transform:uppercase; padding:6px 12px; background:#f3f4f6; border-left:4px solid #111; margin-bottom:10px; }
  .field { display:flex; margin-bottom:6px; font-size:12px; }
  .field-label { width:180px; color:#666; flex-shrink:0; }
  .field-value { font-weight:600; border-bottom:1px dotted #ccc; flex:1; padding-bottom:2px; }
  .completeness { display:grid; grid-template-columns:repeat(3,1fr); gap:4px 16px; font-size:11px; margin-top:8px; }
  .completeness span { }
  .obligations { border:1.5px solid #333; padding:12px 16px; font-size:10px; font-style:italic; line-height:1.6; margin-bottom:20px; }
  .signatures { display:flex; justify-content:space-between; margin-top:24px; padding-top:16px; border-top:1px solid #ddd; }
  .sig-block { width:45%; }
  .sig-block p { font-size:10px; color:#666; margin-bottom:4px; }
  .sig-line { border-bottom:1px solid #333; height:40px; margin-top:8px; }
  .signature-img { max-height:50px; max-width:200px; }
</style></head><body>
<div class="header">
  <p>SHOWPRO (YAMAHA TASHKENT)</p>
  <h1>Goods Issuance Act for Temporary Use</h1>
  <p>No. ${act.actNumber || act.id || 'ACT-' + Date.now()} dated ${fmtDate(act.createdAt || new Date().toISOString())}</p>
</div>
<div class="company">SHOWPRO LLC · Tashkent, Uzbekistan</div>

<div class="section">
  <div class="section-title">Product details</div>
  <div class="field"><span class="field-label">Model:</span><span class="field-value">${form.model}</span></div>
  <div class="field"><span class="field-label">Serial number:</span><span class="field-value">${form.serialNumber || '—'}</span></div>
  <div class="field"><span class="field-label">Retail price:</span><span class="field-value">${form.price ? fmtPrice(form.price) : '—'}</span></div>
  <div class="field"><span class="field-label">Condition:</span><span class="field-value">${form.condition}</span></div>
</div>

<div class="section">
  <div class="section-title">Included items</div>
  <div class="completeness">
    ${['Box', 'Packaging', 'Bags/film', 'Manual', 'Cables'].map(item =>
      `<span>${form.completeness.includes(item) ? '✓' : '○'} ${item}</span>`
    ).join('')}
  </div>
</div>

<div class="section">
  <div class="section-title">Dates</div>
  <div class="field"><span class="field-label">Issue date:</span><span class="field-value">${fmtDate(act.createdAt || new Date().toISOString())}</span></div>
  <div class="field"><span class="field-label">Return date:</span><span class="field-value" style="color:#c00;font-weight:700;">${fmtDate(form.returnDate)}</span></div>
</div>

<div class="obligations">
  I, ${form.clientName}, confirm receipt of the above item for temporary use and agree to return it complete and in proper condition by the return date. I agree to pay full retail price if the item is lost or damaged.
</div>

<div class="signatures">
  <div class="sig-block">
    <p>Recipient:</p>
    <div class="field-value" style="border:none;font-size:12px;">${form.clientName}</div>
    <div class="field-value" style="border:none;font-size:11px;color:#666;">${form.clientPhone}</div>
    <div class="sig-line"></div>
    <p style="margin-top:4px;">Signature</p>
  </div>
  <div class="sig-block" style="text-align:right;">
    <p>Staff signature:</p>
    ${signature ? `<img src="${signature}" class="signature-img" />` : '<div class="sig-line"></div>'}
  </div>
</div>

${form.notes ? `<div style="margin-top:16px;font-size:10px;color:#666;"><strong>Comments:</strong> ${form.notes}</div>` : ''}
</body></html>`;

  const win = window.open('', '_blank');
  if (win) { win.document.write(html); win.document.close(); setTimeout(() => win.print(), 300); }
}
