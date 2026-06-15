import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../lib/api';
import toast from 'react-hot-toast';
import type { Category, ApiResponse } from '../../types';
import { Plus, Trash2, Edit, X } from 'lucide-react';

interface CatForm { name: string; slug: string; sortOrder: number | ''; }
const empty: CatForm = { name: '', slug: '', sortOrder: '' };

export default function CategoriesPage() {
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number|null>(null);
  const [form, setForm] = useState<CatForm>(empty);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['categories'],
    queryFn: () => api.get<ApiResponse<Category[]>>('/admin/categories').then(r => r.data.data),
  });

  const saveMut = useMutation({
    mutationFn: (d: { id: number|null; body: Record<string,unknown> }) =>
      d.id ? api.put(`/admin/categories/${d.id}`, d.body) : api.post('/admin/categories', d.body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['categories'] }); toast.success(editId ? 'Updated' : 'Added'); close(); },
    onError: () => toast.error('Error'),
  });

  const delMut = useMutation({
    mutationFn: (id: number) => api.delete(`/admin/categories/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['categories'] }); toast.success('Deleted'); },
  });

  const open = (c?: Category) => {
    if (c) { setForm({ name: c.name, slug: c.slug||'', sortOrder: c.sortOrder||'' }); setEditId(c.id); }
    else { setForm(empty); setEditId(null); }
    setShowForm(true);
  };
  const close = () => { setShowForm(false); setEditId(null); };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    saveMut.mutate({ id: editId, body: { ...form, sortOrder: form.sortOrder || 0 } });
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold">Categories</h2>
        <button onClick={() => open()} className="flex items-center gap-2 px-4 py-2 bg-teal-700 text-white rounded-lg hover:bg-teal-800 text-sm">
          <Plus size={16}/> Add
        </button>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-lg font-semibold">{editId ? 'Edit' : 'New category'}</h3>
              <button onClick={close}><X size={20}/></button>
            </div>
            <form onSubmit={submit} className="p-4 space-y-3">
              <div><label className="text-sm font-medium text-gray-700">Name *</label>
                <input required value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="w-full mt-1 px-3 py-2 border rounded-lg text-sm"/></div>
              <div><label className="text-sm font-medium text-gray-700">Slug</label>
                <input value={form.slug} onChange={e => setForm({...form, slug: e.target.value})} className="w-full mt-1 px-3 py-2 border rounded-lg text-sm" placeholder="auto-generated"/></div>
              <div><label className="text-sm font-medium text-gray-700">Sort order</label>
                <input type="number" value={form.sortOrder} onChange={e => setForm({...form, sortOrder: e.target.value ? Number(e.target.value) : ''})}
                  className="w-full mt-1 px-3 py-2 border rounded-lg text-sm"/></div>
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
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left"><tr>
              <th className="px-4 py-3">Name</th><th className="px-4 py-3">Slug</th>
              <th className="px-4 py-3 text-right">Products</th><th className="px-4 py-3 w-24">Actions</th>
            </tr></thead>
            <tbody className="divide-y divide-slate-100">
              {data?.map(c => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{c.name}</td>
                  <td className="px-4 py-3 text-gray-500">{c.slug}</td>
                  <td className="px-4 py-3 text-right">{c.productCount ?? 0}</td>
                  <td className="px-4 py-3"><div className="flex gap-2">
                    <button onClick={() => open(c)} className="text-gray-400 hover:text-teal-700"><Edit size={16}/></button>
                    <button onClick={() => { if(confirm('Delete this category?')) delMut.mutate(c.id); }} className="text-gray-400 hover:text-red-600"><Trash2 size={16}/></button>
                  </div></td>
                </tr>
              ))}
              {data?.length === 0 && <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-400">No categories</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}