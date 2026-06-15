import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../lib/api';
import toast from 'react-hot-toast';
import type { Client, ApiResponse, PageResponse, ClientHistory } from '../../types';
import { Search, Plus, Trash2, Edit, X, History } from 'lucide-react';

interface ClientForm { fullName: string; phone: string; email: string; notes: string; }
const empty: ClientForm = { fullName: '', phone: '', email: '', notes: '' };

export default function ClientsPage() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number|null>(null);
  const [form, setForm] = useState<ClientForm>(empty);
  const [historyClient, setHistoryClient] = useState<Client | null>(null);
  const qc = useQueryClient();

  const { data: history, isLoading: historyLoading } = useQuery({
    queryKey: ['client-history', historyClient?.id],
    queryFn: () => api.get<ApiResponse<ClientHistory>>(`/admin/clients/${historyClient!.id}/history`).then(r => r.data.data),
    enabled: !!historyClient,
  });

  const { data, isLoading } = useQuery({
    queryKey: ['clients', search, page],
    queryFn: () => api.get<ApiResponse<PageResponse<Client>>>('/admin/clients', { params: { q: search||undefined, page, size: 20 } }).then(r => r.data.data),
  });

  const saveMut = useMutation({
    mutationFn: (d: { id: number|null; body: ClientForm }) =>
      d.id ? api.put(`/admin/clients/${d.id}`, d.body) : api.post('/admin/clients', d.body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['clients'] }); toast.success(editId ? 'Updated' : 'Added'); close(); },
    onError: () => toast.error('Error'),
  });

  const delMut = useMutation({
    mutationFn: (id: number) => api.delete(`/admin/clients/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['clients'] }); toast.success('Deleted'); },
  });

  const open = (c?: Client) => {
    if (c) { setForm({ fullName: c.fullName, phone: c.phone||'', email: c.email||'', notes: c.notes||'' }); setEditId(c.id); }
    else { setForm(empty); setEditId(null); }
    setShowForm(true);
  };
  const close = () => { setShowForm(false); setEditId(null); };

  const submit = (e: React.FormEvent) => { e.preventDefault(); saveMut.mutate({ id: editId, body: form }); };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold">Clients</h2>
        <button onClick={() => open()} className="flex items-center gap-2 px-4 py-2 bg-teal-700 text-white rounded-lg hover:bg-teal-800 text-sm">
          <Plus size={16}/> Add
        </button>
      </div>
      <div className="relative mb-4">
        <Search size={18} className="absolute left-3 top-2.5 text-gray-400"/>
        <input placeholder="Search clients..." value={search} onChange={e => { setSearch(e.target.value); setPage(0); }}
          className="w-full pl-10 pr-4 py-2 border rounded-lg"/>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-lg font-semibold">{editId ? 'Edit' : 'New client'}</h3>
              <button onClick={close}><X size={20}/></button>
            </div>
            <form onSubmit={submit} className="p-4 space-y-3">
              <div><label className="text-sm font-medium text-gray-700">Full name *</label>
                <input required value={form.fullName} onChange={e => setForm({...form, fullName: e.target.value})} className="w-full mt-1 px-3 py-2 border rounded-lg text-sm"/></div>
              <div><label className="text-sm font-medium text-gray-700">Phone</label>
                <input value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} className="w-full mt-1 px-3 py-2 border rounded-lg text-sm" placeholder="+7 7XX XXX-XX-XX"/></div>
              <div><label className="text-sm font-medium text-gray-700">Email</label>
                <input type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} className="w-full mt-1 px-3 py-2 border rounded-lg text-sm"/></div>
              <div><label className="text-sm font-medium text-gray-700">Notes</label>
                <textarea rows={2} value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} className="w-full mt-1 px-3 py-2 border rounded-lg text-sm"/></div>
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
                <th className="px-4 py-3">Full name</th><th className="px-4 py-3">Phone</th>
                <th className="px-4 py-3">Email</th><th className="px-4 py-3 w-24">Actions</th>
              </tr></thead>
              <tbody className="divide-y divide-slate-100">
                {data?.content.map(c => (
                  <tr key={c.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium">{c.fullName}</td>
                    <td className="px-4 py-3">{c.phone}</td>
                    <td className="px-4 py-3 text-gray-500">{c.email}</td>
                    <td className="px-4 py-3"><div className="flex gap-2">
                      <button onClick={() => setHistoryClient(c)} className="text-gray-400 hover:text-indigo-600" title="History"><History size={16}/></button>
                      <button onClick={() => open(c)} className="text-gray-400 hover:text-teal-700"><Edit size={16}/></button>
                      <button onClick={() => { if(confirm('Delete this client?')) delMut.mutate(c.id); }} className="text-gray-400 hover:text-red-600"><Trash2 size={16}/></button>
                    </div></td>
                  </tr>
                ))}
                {data?.content.length === 0 && <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-400">No clients</td></tr>}
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

      {historyClient && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b">
              <div>
                <h3 className="text-lg font-semibold">Purchase history</h3>
                <p className="text-sm text-gray-500">{historyClient.fullName}{historyClient.phone ? ` • ${historyClient.phone}` : ''}</p>
              </div>
              <button onClick={() => setHistoryClient(null)}><X size={20}/></button>
            </div>
            <div className="p-4">
              {historyLoading ? (
                <p className="text-center text-gray-400 py-8">Loading...</p>
              ) : (!history?.warranties.length && !history?.issuanceActs.length) ? (
                <p className="text-center text-gray-400 py-8">No purchase history</p>
              ) : (
                <>
                  {!!history?.warranties.length && (
                    <div className="mb-5">
                      <h4 className="text-sm font-semibold text-gray-700 mb-2">Warranty certificates ({history.warranties.length})</h4>
                      <table className="w-full text-xs border rounded-lg overflow-hidden">
                        <thead className="bg-slate-50"><tr>
                          <th className="px-3 py-2 text-left">Number</th>
                          <th className="px-3 py-2 text-left">Model</th>
                          <th className="px-3 py-2 text-left">Brand</th>
                          <th className="px-3 py-2 text-left">Valid until</th>
                        </tr></thead>
                        <tbody className="divide-y">
                          {history.warranties.map(w => (
                            <tr key={w.id} className="hover:bg-gray-50">
                              <td className="px-3 py-2 font-mono">{w.warrantyNumber}</td>
                              <td className="px-3 py-2">{w.model}</td>
                              <td className="px-3 py-2">{w.brand}</td>
                              <td className="px-3 py-2">{w.expiresAt ? new Date(w.expiresAt).toLocaleDateString('en-US') : '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                  {!!history?.issuanceActs.length && (
                    <div>
                      <h4 className="text-sm font-semibold text-gray-700 mb-2">Issuance acts ({history.issuanceActs.length})</h4>
                      <table className="w-full text-xs border rounded-lg overflow-hidden">
                        <thead className="bg-slate-50"><tr>
                          <th className="px-3 py-2 text-left">Number</th>
                          <th className="px-3 py-2 text-left">Model</th>
                          <th className="px-3 py-2 text-left">Price</th>
                          <th className="px-3 py-2 text-left">Date</th>
                        </tr></thead>
                        <tbody className="divide-y">
                          {history.issuanceActs.map(a => (
                            <tr key={a.id} className="hover:bg-gray-50">
                              <td className="px-3 py-2 font-mono">{a.actNumber}</td>
                              <td className="px-3 py-2">{a.model}</td>
                              <td className="px-3 py-2">{a.price}</td>
                              <td className="px-3 py-2">{a.createdAt ? new Date(a.createdAt).toLocaleDateString('en-US') : '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}