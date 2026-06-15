import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../../lib/api';
import toast from 'react-hot-toast';
import type { ApiResponse, ReportSummary, Client, Attendance, PageResponse } from '../../types';
import { Download, Package, Users, Shield, UserCheck, Clock, BarChart3 } from 'lucide-react';

function generateCSV(headers: string[], rows: string[][]): string {
  const escape = (s: string) => `"${String(s || '').replace(/"/g, '""')}"`;
  return [headers.map(escape).join(','), ...rows.map(r => r.map(escape).join(','))].join('\n');
}

function downloadCSV(csv: string, filename: string) {
  const bom = '\uFEFF';
  const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

export default function ReportsPage() {
  const today = new Date().toISOString().slice(0, 10);
  const monthAgo = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
  const [from, setFrom] = useState(monthAgo);
  const [to, setTo] = useState(today);

  const { data: summary, isLoading } = useQuery({
    queryKey: ['report-summary'],
    queryFn: () => api.get<ApiResponse<ReportSummary>>('/admin/reports/summary').then(r => r.data.data),
  });

  const exportCRM = async () => {
    try {
      const resp = await api.get<ApiResponse<PageResponse<Client>>>('/admin/clients', { params: { size: 10000 } });
      const clients = resp.data.data.content;
      const csv = generateCSV(
        ['Full name', 'Phone', 'Email', 'Notes', 'Created at'],
        clients.map(c => [c.fullName, c.phone, c.email, c.notes, c.createdAt ? new Date(c.createdAt).toLocaleDateString('en-US') : ''])
      );
      downloadCSV(csv, `crm_export_${today}.csv`);
      toast.success('CRM exported');
    } catch { toast.error('Export failed'); }
  };

  const exportAttendance = async () => {
    try {
      const resp = await api.get<ApiResponse<Attendance[]>>('/admin/hr/attendance', { params: { from, to } });
      const records = resp.data.data;
      const csv = generateCSV(
        ['Employee', 'Type', 'Date', 'Time', 'IP address'],
        records.map(a => [
          a.employeeName,
          a.type === 'check-in' ? 'Check-in' : 'Check-out',
          new Date(a.timestamp).toLocaleDateString('en-US'),
          new Date(a.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
          a.ipAddress || '',
        ])
      );
      downloadCSV(csv, `attendance_${from}_${to}.csv`);
      toast.success('Attendance exported');
    } catch { toast.error('Export failed'); }
  };

  const stats = summary ? [
    { label: 'Products', value: summary.totalProducts, icon: Package, color: 'bg-blue-50 text-blue-600' },
    { label: 'Discounted', value: summary.discountedProducts, icon: BarChart3, color: 'bg-green-50 text-green-600' },
    { label: 'Clients', value: summary.totalClients, icon: Users, color: 'bg-purple-50 text-purple-600' },
    { label: 'Warranties', value: summary.totalWarranties, icon: Shield, color: 'bg-yellow-50 text-yellow-600' },
    { label: 'Employees', value: summary.totalEmployees, icon: UserCheck, color: 'bg-pink-50 text-pink-600' },
    { label: 'Visits (7d)', value: summary.recentAttendance, icon: Clock, color: 'bg-indigo-50 text-indigo-600' },
  ] : [];

  return (
    <div>
      <h2 className="text-xl font-bold mb-4">Reports and analytics</h2>

      {/* Stats */}
      {isLoading ? <p>Loading...</p> : (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
          {stats.map(s => (
            <div key={s.label} className={`rounded-xl p-4 ${s.color}`}>
              <div className="flex items-center gap-3">
                <s.icon size={24} />
                <div>
                  <p className="text-2xl font-bold">{s.value}</p>
                  <p className="text-xs opacity-75">{s.label}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Export sections */}
      <div className="grid md:grid-cols-2 gap-4">
        {/* CRM Export */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-sm font-bold text-gray-700 mb-2">Export CRM</h3>
          <p className="text-xs text-gray-500 mb-4">Export full client database to CSV</p>
          <button onClick={exportCRM} className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700">
            <Download size={16} /> Download CSV
          </button>
        </div>

        {/* Attendance Export */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-sm font-bold text-gray-700 mb-2">Export attendance</h3>
          <p className="text-xs text-gray-500 mb-3">Export attendance log for period</p>
          <div className="flex gap-3 mb-3 items-end">
            <div><label className="text-xs text-gray-600">From</label>
              <input type="date" value={from} onChange={e => setFrom(e.target.value)} className="ml-1 px-2 py-1.5 border rounded-lg text-sm" /></div>
            <div><label className="text-xs text-gray-600">To</label>
              <input type="date" value={to} onChange={e => setTo(e.target.value)} className="ml-1 px-2 py-1.5 border rounded-lg text-sm" /></div>
          </div>
          <button onClick={exportAttendance} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">
            <Download size={16} /> Download CSV
          </button>
        </div>
      </div>
    </div>
  );
}
