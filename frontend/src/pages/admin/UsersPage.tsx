import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../lib/api';
import toast from 'react-hot-toast';
import type { ApiResponse } from '../../types';
import { Plus, Trash2, Edit, X, Shield, Key } from 'lucide-react';

interface UserDto { id: number; username: string; fullName: string; email: string; roles: string[]; permissions: string[]; active: boolean; systemAccount: boolean; }

const PERM_LABELS: Record<string, string> = {
  'catalog.view': 'View catalog', 'catalog.manage': 'Manage catalog',
  'crm.view': 'View CRM', 'crm.manage': 'Manage CRM',
  'hr.view': 'View HR', 'hr.manage': 'Manage HR',
  'documents.view': 'View documents', 'documents.manage': 'Manage documents', 'documents.templates': 'Templates',
  'reports.view': 'Reports',
  'settings.view': 'View settings', 'settings.manage': 'Manage settings',
  'admin.users': 'Manage users', 'admin.audit': 'Audit',
};

const ALL_PERMS = Object.keys(PERM_LABELS);

interface UserForm { username: string; password: string; fullName: string; email: string; role: string; permissions: string[]; }
const empty: UserForm = { username: '', password: '', fullName: '', email: '', role: 'admin', permissions: [] };

export default function UsersPage() {
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<UserForm>(empty);
  const [showPwModal, setShowPwModal] = useState(false);
  const [pwForm, setPwForm] = useState({ oldPassword: '', newPassword: '' });
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: () => api.get<ApiResponse<UserDto[]>>('/admin/users').then(r => r.data.data),
  });

  const createMut = useMutation({
    mutationFn: (body: Record<string, unknown>) => api.post('/admin/users', body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['users'] }); toast.success('User created'); close(); },
    onError: () => toast.error('Error'),
  });

  const updateMut = useMutation({
    mutationFn: (d: { id: number; body: Record<string, unknown> }) => api.put(`/admin/users/${d.id}`, d.body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['users'] }); toast.success('Updated'); close(); },
    onError: () => toast.error('Error'),
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => api.delete(`/admin/users/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['users'] }); toast.success('Deleted'); },
    onError: () => toast.error('Cannot delete system account'),
  });

  const changePwMut = useMutation({
    mutationFn: (body: { oldPassword: string; newPassword: string }) => api.post('/auth/change-password', body),
    onSuccess: () => { toast.success('Password changed'); setShowPwModal(false); setPwForm({ oldPassword: '', newPassword: '' }); },
    onError: () => toast.error('Error. Check your current password.'),
  });

  const open = (u?: UserDto) => {
    if (u) {
      setForm({ username: u.username, password: '', fullName: u.fullName, email: u.email || '', role: u.roles[0] || 'admin', permissions: u.permissions || [] });
      setEditId(u.id);
    } else { setForm(empty); setEditId(null); }
    setShowForm(true);
  };
  const close = () => { setShowForm(false); setEditId(null); };

  const togglePerm = (perm: string) => {
    setForm(f => ({
      ...f,
      permissions: f.permissions.includes(perm) ? f.permissions.filter(p => p !== perm) : [...f.permissions, perm],
    }));
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const body: Record<string, unknown> = { username: form.username, fullName: form.fullName, email: form.email || null, role: form.role, permissions: form.permissions };
    if (form.password) body.password = form.password;
    if (editId) updateMut.mutate({ id: editId, body });
    else createMut.mutate(body);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold">Users</h2>
        <div className="flex gap-2">
          <button onClick={() => setShowPwModal(true)} className="flex items-center gap-2 px-3 py-2 border rounded-lg text-sm hover:bg-gray-50">
            <Key size={16} /> Change password
          </button>
          <button onClick={() => open()} className="flex items-center gap-2 px-4 py-2 bg-teal-700 text-white rounded-lg hover:bg-teal-800 text-sm">
            <Plus size={16} /> Add
          </button>
        </div>
      </div>

      {/* User Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-lg font-semibold">{editId ? 'Edit' : 'New user'}</h3>
              <button onClick={close}><X size={20} /></button>
            </div>
            <form onSubmit={submit} className="p-4 space-y-3">
              <div><label className="text-sm font-medium text-gray-700">Username *</label>
                <input required value={form.username} onChange={e => setForm({ ...form, username: e.target.value })}
                  disabled={!!editId} className="w-full mt-1 px-3 py-2 border rounded-lg text-sm disabled:bg-gray-100" /></div>
              {!editId && (
                <div><label className="text-sm font-medium text-gray-700">Password *</label>
                  <input required type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })}
                    className="w-full mt-1 px-3 py-2 border rounded-lg text-sm" /></div>
              )}
              <div><label className="text-sm font-medium text-gray-700">Full name</label>
                <input value={form.fullName} onChange={e => setForm({ ...form, fullName: e.target.value })}
                  className="w-full mt-1 px-3 py-2 border rounded-lg text-sm" /></div>
              <div><label className="text-sm font-medium text-gray-700">Email</label>
                <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })}
                  className="w-full mt-1 px-3 py-2 border rounded-lg text-sm" /></div>
              <div><label className="text-sm font-medium text-gray-700">Role</label>
                <select value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}
                  className="w-full mt-1 px-3 py-2 border rounded-lg text-sm">
                  <option value="super_admin">Super admin</option>
                  <option value="admin">Administrator</option>
                </select></div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">Permissions</label>
                <div className="grid grid-cols-2 gap-1.5">
                  {ALL_PERMS.map(perm => (
                    <label key={perm} className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-xs cursor-pointer transition-colors ${
                      form.permissions.includes(perm) ? 'bg-teal-50 border-teal-300 text-teal-800' : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}>
                      <input type="checkbox" checked={form.permissions.includes(perm)} onChange={() => togglePerm(perm)} className="sr-only" />
                      {PERM_LABELS[perm]}
                    </label>
                  ))}
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={close} className="px-4 py-2 border rounded-lg text-sm">Cancel</button>
                <button type="submit" disabled={createMut.isPending || updateMut.isPending}
                  className="px-4 py-2 bg-teal-700 text-white rounded-lg text-sm hover:bg-teal-800 disabled:opacity-50">
                  Save</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Change Password Modal */}
      {showPwModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-lg font-semibold">Change password</h3>
              <button onClick={() => setShowPwModal(false)}><X size={20} /></button>
            </div>
            <form onSubmit={e => { e.preventDefault(); changePwMut.mutate(pwForm); }} className="p-4 space-y-3">
              <div><label className="text-sm font-medium text-gray-700">Current password</label>
                <input required type="password" value={pwForm.oldPassword} onChange={e => setPwForm({ ...pwForm, oldPassword: e.target.value })}
                  className="w-full mt-1 px-3 py-2 border rounded-lg text-sm" /></div>
              <div><label className="text-sm font-medium text-gray-700">New password</label>
                <input required type="password" value={pwForm.newPassword} onChange={e => setPwForm({ ...pwForm, newPassword: e.target.value })}
                  className="w-full mt-1 px-3 py-2 border rounded-lg text-sm" /></div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowPwModal(false)} className="px-4 py-2 border rounded-lg text-sm">Cancel</button>
                <button type="submit" disabled={changePwMut.isPending}
                  className="px-4 py-2 bg-teal-700 text-white rounded-lg text-sm hover:bg-teal-800 disabled:opacity-50">
                  Save</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Users Table */}
      {isLoading ? <p>Loading...</p> : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left"><tr>
              <th className="px-4 py-3">Username</th><th className="px-4 py-3">Full name</th>
              <th className="px-4 py-3">Role</th><th className="px-4 py-3">Permissions</th>
              <th className="px-4 py-3 w-24">Actions</th>
            </tr></thead>
            <tbody className="divide-y divide-gray-100">
              {data?.map(u => (
                <tr key={u.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">
                    {u.username} {u.systemAccount && <Shield size={14} className="inline text-amber-500 ml-1" />}
                  </td>
                  <td className="px-4 py-3">{u.fullName}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs ${
                      u.roles.includes('super_admin') ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'
                    }`}>{u.roles.includes('super_admin') ? 'Super admin' : 'Admin'}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {u.permissions?.slice(0, 4).map(p => (
                        <span key={p} className="px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded text-[10px]">{PERM_LABELS[p] || p}</span>
                      ))}
                      {(u.permissions?.length || 0) > 4 && <span className="text-xs text-gray-400">+{u.permissions.length - 4}</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3"><div className="flex gap-2">
                    <button onClick={() => open(u)} className="text-gray-400 hover:text-teal-700"><Edit size={16} /></button>
                    {!u.systemAccount && (
                      <button onClick={() => { if (confirm('Delete this user?')) deleteMut.mutate(u.id); }} className="text-gray-400 hover:text-red-600"><Trash2 size={16} /></button>
                    )}
                  </div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
