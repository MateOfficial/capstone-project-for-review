import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../lib/api';
import toast from 'react-hot-toast';
import type { Warranty, Client, Product, ApiResponse, PageResponse, WarrantyRule } from '../../types';
import { Plus, Search, Trash2, Download, X, Check } from 'lucide-react';
import { DEFAULT_BRAND_DURATIONS, DEFAULT_WARRANTY_BRANDS } from '../../lib/warranty';

interface WForm { model: string; serialNumber: string; brand: string; durationMonths: number|''; clientId: number|''; }
const empty: WForm = { model: '', serialNumber: '', brand: '', durationMonths: 12, clientId: '' };

export default function WarrantiesPage() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<WForm>(empty);
  const [modelSearch, setModelSearch] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [matchedProduct, setMatchedProduct] = useState<Product | null>(null);
  const serialRef = useRef<HTMLInputElement>(null);
  const modelRef = useRef<HTMLInputElement>(null);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['warranties', search, page],
    queryFn: () => api.get<ApiResponse<PageResponse<Warranty>>>('/admin/warranties', {
      params: { q: search||undefined, page, size: 20 },
    }).then(r => r.data.data),
  });

  const { data: clients } = useQuery({
    queryKey: ['clients-all'],
    queryFn: () => api.get<ApiResponse<PageResponse<Client>>>('/admin/clients', { params: { size: 200 } }).then(r => r.data.data.content),
  });

  const { data: products } = useQuery({
    queryKey: ['products-autocomplete'],
    queryFn: () => api.get<ApiResponse<PageResponse<Product>>>('/admin/products', { params: { size: 5000 } }).then(r => r.data.data.content),
  });

  const { data: warrantyRules } = useQuery({
    queryKey: ['admin-warranty-rules'],
    queryFn: () => api.get<ApiResponse<WarrantyRule[]>>('/admin/warranty-rules').then(r => r.data.data),
  });

  const brands = Array.from(new Set([
    ...DEFAULT_WARRANTY_BRANDS,
    ...(warrantyRules?.map(rule => rule.brand.toUpperCase()) ?? []),
  ]));

  const normalizedModelSearch = modelSearch.trim().toLowerCase();
  const filteredProducts = (products || []).filter(p => {
    if (normalizedModelSearch.length < 2) return false;
    const productName = (p.name || '').toLowerCase();
    const productCode = (p.code || '').toLowerCase();
    return productName.includes(normalizedModelSearch) || productCode.includes(normalizedModelSearch);
  }).slice(0, 8);

  const selectProduct = (p: Product) => {
    const brand = brands.find(b => p.name.toUpperCase().includes(b) || p.categoryName?.toUpperCase().includes(b)) || form.brand;
    const matchedRule = warrantyRules?.find(rule => rule.brand.toUpperCase() === brand);
    setForm(f => ({
      ...f,
      model: p.name,
      brand,
      durationMonths: brand ? (matchedRule?.durationMonths || DEFAULT_BRAND_DURATIONS[brand] || 12) : f.durationMonths,
    }));
    setModelSearch(p.name);
    setMatchedProduct(p);
    setShowSuggestions(false);
    setTimeout(() => serialRef.current?.focus(), 100);
  };

  const selectBrand = (brand: string) => {
    const matchedRule = warrantyRules?.find(rule => rule.brand.toUpperCase() === brand);
    setForm(f => ({
      ...f,
      brand,
      durationMonths: matchedRule?.durationMonths || DEFAULT_BRAND_DURATIONS[brand] || 12,
    }));
  };

  const handleSerialKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && form.serialNumber) {
      e.preventDefault();
      // Enter on serial number field submits
      const formEl = (e.target as HTMLElement).closest('form');
      if (formEl) formEl.requestSubmit();
    }
  };

  const createMut = useMutation({
    mutationFn: (body: Record<string,unknown>) => api.post('/admin/warranties', body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['warranties'] });
      toast.success('Warranty created');
      // Reset for next scan
      setForm(f => ({ ...empty, brand: f.brand, durationMonths: f.durationMonths }));
      setModelSearch('');
      setMatchedProduct(null);
      setTimeout(() => modelRef.current?.focus(), 100);
    },
    onError: () => toast.error('Error'),
  });

  const delMut = useMutation({
    mutationFn: (id: number) => api.delete(`/admin/warranties/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['warranties'] }); toast.success('Deleted'); },
  });

  const downloadPdf = async (id: number) => {
    try {
      const resp = await api.get(`/admin/warranties/${id}/pdf`, { responseType: 'blob' });
      const url = URL.createObjectURL(new Blob([resp.data]));
      const a = document.createElement('a'); a.href = url; a.download = `warranty-${id}.pdf`; a.click();
      URL.revokeObjectURL(url);
    } catch { toast.error('PDF download error'); }
  };

  const close = () => { setShowForm(false); setMatchedProduct(null); setModelSearch(''); };
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    createMut.mutate({ ...form, clientId: form.clientId||null, durationMonths: form.durationMonths||12 });
  };

  const fmtDate = (s: string) => s ? new Date(s).toLocaleDateString('en-US') : '—';
  const fmtPrice = (n: number) => new Intl.NumberFormat('en-US').format(n) + ' sum';

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold">Warranties</h2>
        <button onClick={() => { setForm(empty); setShowForm(true); }} className="flex items-center gap-2 px-4 py-2 bg-teal-700 text-white rounded-lg hover:bg-teal-800 text-sm">
          <Plus size={16}/> Create warranty
        </button>
      </div>
      <div className="relative mb-4">
        <Search size={18} className="absolute left-3 top-2.5 text-gray-400"/>
        <input placeholder="Search by model or serial number..." value={search} onChange={e => { setSearch(e.target.value); setPage(0); }}
          className="w-full pl-10 pr-4 py-2 border rounded-lg"/>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-lg font-semibold">New warranty</h3>
              <button onClick={close}><X size={20}/></button>
            </div>
            <form onSubmit={submit} className="p-4 space-y-4">
              {/* Brand chips */}
              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">Brand</label>
                <div className="flex flex-wrap gap-2">
                  {brands.map(b => {
                    const matchedRule = warrantyRules?.find(rule => rule.brand.toUpperCase() === b);
                    const duration = matchedRule?.durationMonths || DEFAULT_BRAND_DURATIONS[b] || 12;
                    return (
                    <button key={b} type="button" onClick={() => selectBrand(b)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                        form.brand === b
                          ? 'bg-teal-700 text-white shadow-sm'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}>
                      {b} <span className="opacity-60 ml-1">{duration} mo</span>
                    </button>
                    );
                  })}
                </div>
              </div>

              {/* Model with autocomplete */}
              <div className="relative">
                <label className="text-sm font-medium text-gray-700">Model *</label>
                <input ref={modelRef} required value={modelSearch || form.model}
                  onChange={e => { setModelSearch(e.target.value); setForm({...form, model: e.target.value}); setShowSuggestions(true); setMatchedProduct(null); }}
                  onFocus={() => modelSearch.length >= 2 && setShowSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                  placeholder="Start typing product name..."
                  className="w-full mt-1 px-3 py-2 border rounded-lg text-sm"/>
                {showSuggestions && filteredProducts.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-48 overflow-y-auto">
                    {filteredProducts.map(p => (
                      <button key={p.id} type="button" onClick={() => selectProduct(p)}
                        className="w-full text-left px-3 py-2 hover:bg-gray-50 text-sm border-b last:border-0">
                        <span className="font-medium">{p.name}</span>
                        <span className="ml-2 text-xs text-gray-400">{p.code}</span>
                        {p.price > 0 && <span className="float-right text-xs text-gray-500">{fmtPrice(p.price)}</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Matched product card */}
              {matchedProduct && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-start gap-3">
                  <Check size={18} className="text-green-600 mt-0.5 flex-shrink-0" />
                  <div className="text-sm">
                    <p className="font-medium text-green-800">{matchedProduct.name}</p>
                    <p className="text-green-600 text-xs">{matchedProduct.code} · {matchedProduct.categoryName} · {matchedProduct.price > 0 ? fmtPrice(matchedProduct.price) : 'Price not set'}</p>
                  </div>
                </div>
              )}

              {/* Serial number with Enter-key submit */}
              <div>
                <label className="text-sm font-medium text-gray-700">Serial number</label>
                <input ref={serialRef} value={form.serialNumber}
                  onChange={e => setForm({...form, serialNumber: e.target.value})}
                  onKeyDown={handleSerialKeyDown}
                  placeholder="Scan barcode or enter manually"
                  className="w-full mt-1 px-3 py-2 border rounded-lg text-sm font-mono"/>
                <p className="text-[10px] text-gray-400 mt-1">Press Enter to save and continue</p>
              </div>

              {/* Duration (auto-set by brand) */}
              <div><label className="text-sm font-medium text-gray-700">Term (months)</label>
                <input type="number" min="1" value={form.durationMonths} onChange={e => setForm({...form, durationMonths: e.target.value ? Number(e.target.value) : ''})}
                  className="w-full mt-1 px-3 py-2 border rounded-lg text-sm"/></div>

              {/* Client */}
              <div><label className="text-sm font-medium text-gray-700">Client</label>
                <select value={form.clientId} onChange={e => setForm({...form, clientId: e.target.value ? Number(e.target.value) : ''})}
                  className="w-full mt-1 px-3 py-2 border rounded-lg text-sm">
                  <option value="">-- No client --</option>
                  {clients?.map(c => <option key={c.id} value={c.id}>{c.fullName}</option>)}
                </select></div>

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={close} className="px-4 py-2 border rounded-lg text-sm">Cancel</button>
                <button type="submit" disabled={createMut.isPending} className="px-4 py-2 bg-teal-700 text-white rounded-lg text-sm hover:bg-teal-800 disabled:opacity-50">
                  {createMut.isPending ? 'Creating...' : 'Create'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isLoading ? <p>Loading...</p> : (
        <>
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left"><tr>
                <th className="px-4 py-3">Number</th><th className="px-4 py-3">Model</th>
                <th className="px-4 py-3">Brand</th><th className="px-4 py-3">Serial #</th>
                <th className="px-4 py-3">Created</th><th className="px-4 py-3">Expires</th>
                <th className="px-4 py-3 w-24">Actions</th>
              </tr></thead>
              <tbody className="divide-y divide-slate-100">
                {data?.content.map(w => (
                  <tr key={w.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono text-xs">{w.warrantyNumber}</td>
                    <td className="px-4 py-3 font-medium">{w.model}</td>
                    <td className="px-4 py-3">{w.brand}</td>
                    <td className="px-4 py-3 text-gray-500">{w.serialNumber}</td>
                    <td className="px-4 py-3">{fmtDate(w.createdAt)}</td>
                    <td className="px-4 py-3">{fmtDate(w.expiresAt)}</td>
                    <td className="px-4 py-3"><div className="flex gap-2">
                      <button onClick={() => downloadPdf(w.id)} className="text-gray-400 hover:text-teal-700" title="Download PDF"><Download size={16}/></button>
                      <button onClick={() => { if(confirm('Delete this warranty?')) delMut.mutate(w.id); }} className="text-gray-400 hover:text-red-600"><Trash2 size={16}/></button>
                    </div></td>
                  </tr>
                ))}
                {data?.content.length === 0 && <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">No warranties</td></tr>}
              </tbody>
            </table>
          </div>
          {data && data.totalPages > 1 && (
            <div className="flex gap-2 mt-4 justify-center items-center">
              <button onClick={() => setPage(p => Math.max(0,p-1))} disabled={page===0} className="px-3 py-1 border rounded disabled:opacity-50">← Back</button>
              <span className="px-3 py-1 text-sm text-gray-600">{page+1} / {data.totalPages}</span>
              <button onClick={() => setPage(p => p+1)} disabled={data.last} className="px-3 py-1 border rounded disabled:opacity-50">Next →</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}