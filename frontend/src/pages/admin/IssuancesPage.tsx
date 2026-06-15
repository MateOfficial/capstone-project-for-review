import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../lib/api';
import toast from 'react-hot-toast';
import type { IssuanceAct, ApiResponse, PageResponse, Client } from '../../types';
import { Plus, Trash2, Download, X } from 'lucide-react';

const COMPLETENESS_OPTIONS = [
  'Box', 'Inserts', 'Case/bag', 'Passport', 'Warranty card', 'Cables', 'Accessories',
];
const CONDITION_OPTIONS = ['New', 'Display unit', 'Used', 'Other'];

interface IForm {
  model: string; serialNumber: string; price: string; clientId: number | '';
  clientName: string; clientPhone: string;
  condition: string; completeness: string[]; notes: string; returnDate: string;
}
const empty: IForm = { model:'', serialNumber:'', price:'', clientId:'', clientName:'', clientPhone:'', condition:'New', completeness:[], notes:'', returnDate:'' };

export default function IssuancesPage() {
  const [page, setPage] = useState(0);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<IForm>(empty);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['issuances', page],
    queryFn: () => api.get<ApiResponse<PageResponse<IssuanceAct>>>('/admin/issuances', { params: { page, size: 20 } }).then(r => r.data.data),
  });

  const { data: clientsData } = useQuery({
    queryKey: ['clients-all'],
    queryFn: () => api.get<ApiResponse<PageResponse<Client>>>('/admin/clients', { params: { page: 0, size: 500 } }).then(r => r.data.data),
  });

  const createMut = useMutation({
    mutationFn: (body: Record<string,unknown>) => api.post('/admin/issuances', body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['issuances'] }); toast.success('Act created'); close(); },
    onError: () => toast.error('Error'),
  });

  const delMut = useMutation({
    mutationFn: (id: number) => api.delete(`/admin/issuances/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['issuances'] }); toast.success('Deleted'); },
  });

  const downloadPdf = async (id: number) => {
    try {
      const resp = await api.get(`/admin/issuances/${id}/pdf`, { responseType: 'blob' });
      const url = URL.createObjectURL(new Blob([resp.data]));
      const a = document.createElement('a'); a.href = url; a.download = `act-${id}.pdf`; a.click();
      URL.revokeObjectURL(url);
    } catch { toast.error('PDF download error'); }
  };

  const toggleComplete = (item: string) => {
    setForm(f => ({ ...f, completeness: f.completeness.includes(item) ? f.completeness.filter(i => i !== item) : [...f.completeness, item] }));
  };

  const close = () => setShowForm(false);
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    createMut.mutate({ ...form, clientId: form.clientId || null, returnDate: form.returnDate || null });
  };

  const fmtDate = (s: string) => s ? new Date(s).toLocaleDateString('en-US') : '—';
  const statusBadge = (s: string) => {
    const colors: Record<string,string> = { active: 'bg-blue-100 text-blue-700', returned: 'bg-green-100 text-green-700', cancelled: 'bg-gray-100 text-gray-500' };
    const labels: Record<string,string> = { active: 'Active', returned: 'Returned', cancelled: 'Cancelled' };
    return <span className={`px-2 py-0.5 rounded-full text-xs ${colors[s]||'bg-gray-100 text-gray-500'}`}>{labels[s]||s}</span>;
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold">Issuance acts</h2>
        <button onClick={() => { setForm(empty); setShowForm(true); }} className="flex items-center gap-2 px-4 py-2 bg-teal-700 text-white rounded-lg hover:bg-teal-800 text-sm">
          <Plus size={16}/> Create act
        </button>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-lg font-semibold">New issuance act</h3>
              <button onClick={close}><X size={20}/></button>
            </div>
            <form onSubmit={submit} className="p-4 space-y-3">
              <div><label className="text-sm font-medium text-gray-700">Model *</label>
                <input required value={form.model} onChange={e => setForm({...form, model: e.target.value})} className="w-full mt-1 px-3 py-2 border rounded-lg text-sm"/></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-sm font-medium text-gray-700">Serial #</label>
                  <input value={form.serialNumber} onChange={e => setForm({...form, serialNumber: e.target.value})} className="w-full mt-1 px-3 py-2 border rounded-lg text-sm"/></div>
                <div><label className="text-sm font-medium text-gray-700">Price</label>
                  <input value={form.price} onChange={e => setForm({...form, price: e.target.value})} className="w-full mt-1 px-3 py-2 border rounded-lg text-sm"/></div>
              </div>
              <div><label className="text-sm font-medium text-gray-700">Client from database</label>
                <select value={form.clientId} onChange={e => {
                  const id = e.target.value ? Number(e.target.value) : '';
                  const client = clientsData?.content.find(c => c.id === id);
                  setForm(f => ({ ...f, clientId: id, clientName: client?.fullName ?? f.clientName, clientPhone: client?.phone ?? f.clientPhone }));
                }} className="w-full mt-1 px-3 py-2 border rounded-lg text-sm">
                  <option value="">— not selected —</option>
                  {clientsData?.content.map(c => <option key={c.id} value={c.id}>{c.fullName} {c.phone ? `(${c.phone})` : ''}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-sm font-medium text-gray-700">Client (full name)</label>
                  <input value={form.clientName} onChange={e => setForm({...form, clientName: e.target.value})} className="w-full mt-1 px-3 py-2 border rounded-lg text-sm"/></div>
                <div><label className="text-sm font-medium text-gray-700">Client phone</label>
                  <input value={form.clientPhone} onChange={e => setForm({...form, clientPhone: e.target.value})} className="w-full mt-1 px-3 py-2 border rounded-lg text-sm"/></div>
              </div>
              <div><label className="text-sm font-medium text-gray-700">Condition</label>
                <select value={form.condition} onChange={e => setForm({...form, condition: e.target.value})} className="w-full mt-1 px-3 py-2 border rounded-lg text-sm">
                  {CONDITION_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                </select></div>
              <div><label className="text-sm font-medium text-gray-700">Included items</label>
                <div className="mt-1 flex flex-wrap gap-2">
                  {COMPLETENESS_OPTIONS.map(item => (
                    <label key={item} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm cursor-pointer transition-colors ${form.completeness.includes(item) ? 'bg-teal-50 border-teal-300 text-teal-800' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                      <input type="checkbox" checked={form.completeness.includes(item)} onChange={() => toggleComplete(item)} className="sr-only"/>
                      {item}
                    </label>
                  ))}
                </div></div>
              <div><label className="text-sm font-medium text-gray-700">Return date</label>
                <input type="date" value={form.returnDate} onChange={e => setForm({...form, returnDate: e.target.value})} className="w-full mt-1 px-3 py-2 border rounded-lg text-sm"/></div>
              <div><label className="text-sm font-medium text-gray-700">Notes</label>
                <textarea rows={2} value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} className="w-full mt-1 px-3 py-2 border rounded-lg text-sm"/></div>
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
                <th className="px-4 py-3">Client</th><th className="px-4 py-3">Price</th>
                <th className="px-4 py-3">Status</th><th className="px-4 py-3">Date</th>
                <th className="px-4 py-3 w-24">Actions</th>
              </tr></thead>
              <tbody className="divide-y divide-slate-100">
                {data?.content.map(a => (
                  <tr key={a.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono text-xs">{a.actNumber}</td>
                    <td className="px-4 py-3 font-medium">{a.model}</td>
                    <td className="px-4 py-3">{a.clientName}</td>
                    <td className="px-4 py-3">{a.price}</td>
                    <td className="px-4 py-3">{statusBadge(a.status)}</td>
                    <td className="px-4 py-3">{fmtDate(a.createdAt)}</td>
                    <td className="px-4 py-3"><div className="flex gap-2">
                      <button onClick={() => downloadPdf(a.id)} className="text-gray-400 hover:text-teal-700" title="Download PDF"><Download size={16}/></button>
                      <button onClick={() => { if(confirm('Delete this act?')) delMut.mutate(a.id); }} className="text-gray-400 hover:text-red-600"><Trash2 size={16}/></button>
                    </div></td>
                  </tr>
                ))}
                {data?.content.length === 0 && <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">No acts</td></tr>}
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