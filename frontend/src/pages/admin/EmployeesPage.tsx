import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../lib/api';
import toast from 'react-hot-toast';
import type { Employee, ApiResponse } from '../../types';
import { Plus, Trash2, X } from 'lucide-react';

interface EmpForm {
  name: string;
  phone: string;
  position: string;
  hireDate: string;
  email: string;
  emergencyContact: string;
  hrNotes: string;
}

interface EmpPayload {
  name: string;
  phone: string | null;
  position: string | null;
  hireDate: string | null;
  email: string | null;
  emergencyContact: string | null;
  hrNotes: string | null;
}
const empty: EmpForm = {
  name: '',
  phone: '',
  position: '',
  hireDate: '',
  email: '',
  emergencyContact: '',
  hrNotes: '',
};

export default function EmployeesPage() {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<EmpForm>(empty);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['employees'],
    queryFn: () => api.get<ApiResponse<Employee[]>>('/admin/hr/employees').then(r => r.data.data),
  });

  const saveMut = useMutation({
    mutationFn: (body: EmpPayload) => api.post('/admin/hr/employees', body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['employees'] }); toast.success('Employee added'); close(); },
    onError: () => toast.error('Error'),
  });

  const delMut = useMutation({
    mutationFn: (id: number) => api.delete(`/admin/hr/employees/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['employees'] }); toast.success('Deleted'); },
  });

  const activeEmployees = (data ?? []).filter((e) => e.active);

  const open = () => { setForm(empty); setShowForm(true); };
  const close = () => { setShowForm(false); };
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload: EmpPayload = {
      name: form.name.trim(),
      phone: form.phone.trim() || null,
      position: form.position.trim() || null,
      hireDate: form.hireDate || null,
      email: form.email.trim() || null,
      emergencyContact: form.emergencyContact.trim() || null,
      hrNotes: form.hrNotes.trim() || null,
    };
    saveMut.mutate(payload);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold">Employees</h2>
        <button onClick={open} className="flex items-center gap-2 px-4 py-2 bg-teal-700 text-white rounded-lg hover:bg-teal-800 text-sm">
          <Plus size={16}/> Add
        </button>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-lg font-semibold">New employee</h3>
              <button onClick={close}><X size={20}/></button>
            </div>
            <form onSubmit={submit} className="p-4 space-y-3">
              <div><label className="text-sm font-medium text-gray-700">Full name *</label>
                <input required value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="w-full mt-1 px-3 py-2 border rounded-lg text-sm"/></div>
              <div><label className="text-sm font-medium text-gray-700">Position</label>
                <input value={form.position} onChange={e => setForm({...form, position: e.target.value})} className="w-full mt-1 px-3 py-2 border rounded-lg text-sm"/></div>
              <div><label className="text-sm font-medium text-gray-700">Phone</label>
                <input value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} className="w-full mt-1 px-3 py-2 border rounded-lg text-sm"/></div>
              <div><label className="text-sm font-medium text-gray-700">Hire date</label>
                <input type="date" value={form.hireDate} onChange={e => setForm({...form, hireDate: e.target.value})} className="w-full mt-1 px-3 py-2 border rounded-lg text-sm"/></div>
              <div><label className="text-sm font-medium text-gray-700">Email</label>
                <input type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} className="w-full mt-1 px-3 py-2 border rounded-lg text-sm"/></div>
              <div><label className="text-sm font-medium text-gray-700">Emergency contact</label>
                <input value={form.emergencyContact} onChange={e => setForm({...form, emergencyContact: e.target.value})} className="w-full mt-1 px-3 py-2 border rounded-lg text-sm"/></div>
              <div><label className="text-sm font-medium text-gray-700">HR notes</label>
                <textarea value={form.hrNotes} onChange={e => setForm({...form, hrNotes: e.target.value})} className="w-full mt-1 px-3 py-2 border rounded-lg text-sm min-h-20"/></div>
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
              <th className="px-4 py-3">Full name</th><th className="px-4 py-3">Position</th>
              <th className="px-4 py-3">Phone</th><th className="px-4 py-3">Hire date</th><th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 w-20">Actions</th>
            </tr></thead>
            <tbody className="divide-y divide-slate-100">
              {activeEmployees.map(e => (
                <tr key={e.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{e.name}</td>
                  <td className="px-4 py-3">{e.position}</td>
                  <td className="px-4 py-3">{e.phone}</td>
                  <td className="px-4 py-3">{e.hireDate ? new Date(e.hireDate).toLocaleDateString('en-US') : '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs ${e.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {e.active ? 'Active' : 'Inactive'}</span>
                  </td>
                  <td className="px-4 py-3">
                    <button onClick={() => { if(confirm('Delete this employee?')) delMut.mutate(e.id); }} className="text-gray-400 hover:text-red-600"><Trash2 size={16}/></button>
                  </td>
                </tr>
              ))}
              {activeEmployees.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">No employees</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}