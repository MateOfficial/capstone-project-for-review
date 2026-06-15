import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../lib/api';
import toast from 'react-hot-toast';
import type { Product, Category, ApiResponse, PageResponse } from '../../types';
import { Plus, Search, Trash2, Edit, X, Upload, Tag, FileDown } from 'lucide-react';

interface ProductForm {
  code: string; name: string; searchKey: string; description: string; detailedDescription: string;
  categoryId: number | ''; price: number | ''; discountedPrice: number | '';
  stockQuantity: number | ''; characteristics: string; features: string[];
}
const empty: ProductForm = { code:'', name:'', searchKey:'', description:'', detailedDescription:'', categoryId:'', price:'', discountedPrice:'', stockQuantity:'', characteristics:'', features:[] };

export default function ProductsPage() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number|null>(null);
  const [form, setForm] = useState<ProductForm>(empty);
  const [tab, setTab] = useState<'basic'|'details'>('basic');
  const [featureInput, setFeatureInput] = useState('');
  const [imageFile, setImageFile] = useState<File|null>(null);
  const [imagePreview, setImagePreview] = useState<string|null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const importRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['products', search, page],
    queryFn: () => api.get<ApiResponse<PageResponse<Product>>>('/admin/products', {
      params: { search: search||undefined, page, size: 20 },
    }).then(r => r.data.data),
  });

  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: () => api.get<ApiResponse<Category[]>>('/admin/categories').then(r => r.data.data),
  });

  const saveMut = useMutation({
    mutationFn: async (d: { id: number|null; body: Record<string,unknown> }) => {
      const resp = d.id ? await api.put(`/admin/products/${d.id}`, d.body) : await api.post('/admin/products', d.body);
      // Upload image if selected
      const productId = d.id || (resp.data as any)?.data?.id;
      if (imageFile && productId) {
        const fd = new FormData();
        fd.append('file', imageFile);
        await api.post(`/admin/products/${productId}/image`, fd, {
          headers: { 'Content-Type': 'multipart/form-data' },
        }).catch(() => toast.error('Image upload failed'));
      }
      return resp;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['products'] }); toast.success(editId ? 'Updated' : 'Added'); close(); },
    onError: () => toast.error('Save failed'),
  });

  const delMut = useMutation({
    mutationFn: (id: number) => api.delete(`/admin/products/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['products'] }); toast.success('Deleted'); },
  });

  const open = (p?: Product) => {
    if (p) {
      setForm({ code: p.code||'', name: p.name, searchKey: p.searchKey||'', description: p.description||'',
        detailedDescription: p.detailedDescription||'',
        categoryId: p.categoryId||'', price: p.price||'', discountedPrice: p.discountedPrice||'',
        stockQuantity: p.stockQuantity||'', characteristics: p.characteristics||'',
        features: p.features||[] });
      setEditId(p.id);
      const primary = p.images?.find(i => i.primaryImage) || p.images?.[0];
      setImagePreview(primary?.url || null);
    } else { setForm(empty); setEditId(null); setImagePreview(null); }
    setImageFile(null);
    setTab('basic');
    setShowForm(true);
  };
  const close = () => { setShowForm(false); setEditId(null); setImageFile(null); setImagePreview(null); };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onload = (ev) => setImagePreview(ev.target?.result as string);
      reader.readAsDataURL(file);
    }
  };

  const addFeature = () => {
    const trimmed = featureInput.trim();
    if (trimmed && !form.features.includes(trimmed)) {
      setForm(f => ({ ...f, features: [...f.features, trimmed] }));
    }
    setFeatureInput('');
  };

  const removeFeature = (idx: number) => {
    setForm(f => ({ ...f, features: f.features.filter((_, i) => i !== idx) }));
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const price = Number(form.price) || 0;
    const dp = form.discountedPrice !== '' ? Number(form.discountedPrice) : null;
    const discount = (dp !== null && dp > 0 && price > 0 && dp < price)
      ? Math.round((1 - dp / price) * 100)
      : null;
    saveMut.mutate({ id: editId, body: {
      ...form,
      categoryId: form.categoryId||null,
      price,
      discount,
      stockQuantity: form.stockQuantity||0,
      features: form.features,
    }});
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await api.post('/admin/products/import', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      const r = res.data?.data;
      toast.success(`Done: imported ${r?.imported ?? 0}, skipped ${r?.skipped ?? 0}`);
      qc.invalidateQueries({ queryKey: ['products'] });
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg || 'Import failed');
    } finally {
      setImporting(false);
      e.target.value = '';
    }
  };

  const fmt = (n: number) => new Intl.NumberFormat('en-US').format(n) + ' sum';

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold">Products</h2>
        <div className="flex items-center gap-2">
          <input ref={importRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleImport} />
          <button onClick={() => importRef.current?.click()} disabled={importing}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-50 text-sm disabled:opacity-50">
            <FileDown size={16}/> {importing ? 'Importing...' : 'Import Excel/CSV'}
          </button>
          <button onClick={() => open()} className="flex items-center gap-2 px-4 py-2 bg-teal-700 text-white rounded-lg hover:bg-teal-800 text-sm">
            <Plus size={16}/> Add
          </button>
        </div>
      </div>
      <div className="relative mb-4">
        <Search size={18} className="absolute left-3 top-2.5 text-gray-400"/>
        <input placeholder="Search products..." value={search} onChange={e => { setSearch(e.target.value); setPage(0); }}
          className="w-full pl-10 pr-4 py-2 border rounded-lg"/>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-lg font-semibold">{editId ? 'Edit product' : 'New product'}</h3>
              <button onClick={close}><X size={20}/></button>
            </div>
            {/* Tabs */}
            <div className="flex border-b">
              <button type="button" onClick={() => setTab('basic')} className={`px-4 py-2.5 text-sm font-medium ${tab === 'basic' ? 'border-b-2 border-teal-700 text-teal-700' : 'text-gray-500'}`}>Basic</button>
              <button type="button" onClick={() => setTab('details')} className={`px-4 py-2.5 text-sm font-medium ${tab === 'details' ? 'border-b-2 border-teal-700 text-teal-700' : 'text-gray-500'}`}>Details</button>
            </div>
            <form onSubmit={submit} className="p-4 space-y-3">
              {tab === 'basic' ? (
                <>
                  {/* Image upload */}
                  <div className="flex gap-4 items-start">
                    <div className="flex-shrink-0">
                      {imagePreview ? (
                        <div className="relative">
                          <img src={imagePreview} alt="Preview" className="w-24 h-24 object-cover rounded-lg border" />
                          <button type="button" onClick={() => { setImageFile(null); setImagePreview(null); }}
                            className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center text-xs">×</button>
                        </div>
                      ) : (
                        <button type="button" onClick={() => fileRef.current?.click()}
                          className="w-24 h-24 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center text-gray-400 hover:border-teal-400 hover:text-teal-600 transition-colors">
                          <Upload size={20} />
                          <span className="text-[10px] mt-1">Photo</span>
                        </button>
                      )}
                      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
                    </div>
                    <div className="flex-1 space-y-3">
                      <div><label className="text-sm font-medium text-gray-700">Code/SKU</label>
                        <input value={form.code} onChange={e => setForm({...form, code: e.target.value})} className="w-full mt-1 px-3 py-2 border rounded-lg text-sm"/></div>
                      <div><label className="text-sm font-medium text-gray-700">Item *</label>
                        <input required value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="w-full mt-1 px-3 py-2 border rounded-lg text-sm"/></div>
                    </div>
                  </div>
                  <div><label className="text-sm font-medium text-gray-700">Category</label>
                    <select value={form.categoryId} onChange={e => setForm({...form, categoryId: e.target.value ? Number(e.target.value) : ''})}
                      className="w-full mt-1 px-3 py-2 border rounded-lg text-sm">
                      <option value="">-- No category --</option>
                      {categories?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select></div>
                  <div className="grid grid-cols-3 gap-3">
                    <div><label className="text-sm font-medium text-gray-700">Price (sum)</label>
                      <input type="number" value={form.price} onChange={e => setForm({...form, price: e.target.value ? Number(e.target.value) : '', discountedPrice: ''})}
                        className="w-full mt-1 px-3 py-2 border rounded-lg text-sm"/></div>
                    <div>
                      <label className="text-sm font-medium text-gray-700">Discounted price</label>
                      <input type="number" min="0" value={form.discountedPrice} onChange={e => setForm({...form, discountedPrice: e.target.value ? Number(e.target.value) : ''})}
                        placeholder="Leave empty" className="w-full mt-1 px-3 py-2 border rounded-lg text-sm"/>
                      {form.discountedPrice !== '' && form.price !== '' && Number(form.discountedPrice) < Number(form.price) && (
                        <p className="text-xs text-green-600 mt-0.5">
                          Discount: {Math.round((1 - Number(form.discountedPrice)/Number(form.price))*100)}%
                          {' · '}−{(Number(form.price) - Number(form.discountedPrice)).toLocaleString()} sum
                        </p>
                      )}
                    </div>
                    <div><label className="text-sm font-medium text-gray-700">Warehouse</label>
                      <input type="number" min="0" value={form.stockQuantity} onChange={e => setForm({...form, stockQuantity: e.target.value ? Number(e.target.value) : ''})}
                        className="w-full mt-1 px-3 py-2 border rounded-lg text-sm"/></div>
                  </div>
                  <div><label className="text-sm font-medium text-gray-700">Description</label>
                    <textarea rows={2} value={form.description} onChange={e => setForm({...form, description: e.target.value})} className="w-full mt-1 px-3 py-2 border rounded-lg text-sm"/>
                  </div>
                  <div><label className="text-sm font-medium text-gray-700">Brand</label>
                    <input value={form.characteristics} onChange={e => setForm({...form, characteristics: e.target.value})} className="w-full mt-1 px-3 py-2 border rounded-lg text-sm"/></div>
                </>
              ) : (
                <>
                  {/* Features */}
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-2 block">Features / Tags</label>
                    <div className="flex gap-2 mb-2">
                      <input value={featureInput} onChange={e => setFeatureInput(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addFeature(); } }}
                        placeholder="Add feature..."
                        className="flex-1 px-3 py-2 border rounded-lg text-sm" />
                      <button type="button" onClick={addFeature} className="px-3 py-2 bg-gray-100 rounded-lg text-sm hover:bg-gray-200">
                        <Tag size={16} />
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {form.features.map((f, i) => (
                        <span key={i} className="inline-flex items-center gap-1 px-2.5 py-1 bg-teal-50 text-teal-800 rounded-full text-xs">
                          {f}
                          <button type="button" onClick={() => removeFeature(i)} className="hover:text-red-500">×</button>
                        </span>
                      ))}
                      {form.features.length === 0 && <p className="text-xs text-gray-400">No features</p>}
                    </div>
                  </div>
                  {/* Detailed description */}
                  <div><label className="text-sm font-medium text-gray-700">Detailed description</label>
                    <textarea rows={6} value={form.detailedDescription} onChange={e => setForm({...form, detailedDescription: e.target.value})}
                      placeholder="Full technical product description..."
                      className="w-full mt-1 px-3 py-2 border rounded-lg text-sm"/></div>
                  {/* Search key */}
                  <div><label className="text-sm font-medium text-gray-700">Search key</label>
                    <input value={form.searchKey} onChange={e => setForm({...form, searchKey: e.target.value})}
                      placeholder="Alternative search terms"
                      className="w-full mt-1 px-3 py-2 border rounded-lg text-sm"/></div>
                </>
              )}
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={close} className="px-4 py-2 border rounded-lg text-sm">Cancel</button>
                <button type="submit" disabled={saveMut.isPending} className="px-4 py-2 bg-teal-700 text-white rounded-lg text-sm hover:bg-teal-800 disabled:opacity-50">
                  {saveMut.isPending ? 'Saving...' : 'Save'}</button>
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
                <th className="px-4 py-3">Code</th><th className="px-4 py-3">Item</th>
                <th className="px-4 py-3">Category</th><th className="px-4 py-3 text-right">Price</th>
                <th className="px-4 py-3 w-24">Actions</th>
              </tr></thead>
              <tbody className="divide-y divide-slate-100">
                {data?.content.map(p => (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono text-xs text-gray-500">{p.code}</td>
                    <td className="px-4 py-3 font-medium">{p.name}</td>
                    <td className="px-4 py-3 text-gray-500">{p.categoryName}</td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      {(p.discount ?? 0) > 0 && p.discountedPrice
                        ? <><span className="line-through text-gray-400 mr-1 text-xs">{fmt(p.price)}</span><span className="text-green-600 font-medium">{fmt(p.discountedPrice)}</span></>
                        : fmt(p.price)}
                    </td>
                    <td className="px-4 py-3"><div className="flex gap-2">
                      <button onClick={() => open(p)} className="text-gray-400 hover:text-teal-700"><Edit size={16}/></button>
                      <button onClick={() => { if(confirm('Delete?')) delMut.mutate(p.id); }} className="text-gray-400 hover:text-red-600"><Trash2 size={16}/></button>
                    </div></td>
                  </tr>
                ))}
                {data?.content.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">No products</td></tr>}
              </tbody>
            </table>
          </div>
          {data && data.totalPages > 1 && (
            <div className="flex gap-2 mt-4 justify-center items-center">
              <button onClick={() => setPage(p => Math.max(0, p-1))} disabled={page===0} className="px-3 py-1 border rounded disabled:opacity-50">← Back</button>
              <span className="px-3 py-1 text-sm text-gray-600">{page+1} / {data.totalPages}</span>
              <button onClick={() => setPage(p => p+1)} disabled={data.last} className="px-3 py-1 border rounded disabled:opacity-50">Next →</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}