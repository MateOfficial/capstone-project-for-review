import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../../lib/api';
import type { Attendance, ApiResponse } from '../../types';
import { Download } from 'lucide-react';

interface MergedRow {
  key: string;
  employeeId: number;
  employeeName: string;
  date: string;
  checkIn: string | null;
  checkOut: string | null;
  ipAddress: string;
  workedMinutes: number | null;
}

function mergeRecords(records: Attendance[]): MergedRow[] {
  const map = new Map<string, MergedRow>();
  for (const a of records) {
    const date = new Date(a.timestamp).toLocaleDateString('en-US');
    const key = `${a.employeeId}_${date}`;
    if (!map.has(key)) {
      map.set(key, {
        key,
        employeeId: a.employeeId,
        employeeName: a.employeeName,
        date,
        checkIn: null,
        checkOut: null,
        ipAddress: a.ipAddress,
        workedMinutes: a.workedMinutes ?? null,
      });
    }
    const row = map.get(key)!;
    if (a.type === 'check-in') row.checkIn = a.timestamp;
    else row.checkOut = a.timestamp;
    if (a.ipAddress) row.ipAddress = a.ipAddress;
    if (a.workedMinutes !== undefined && a.workedMinutes !== null) row.workedMinutes = a.workedMinutes;
  }
  return Array.from(map.values()).sort((a, b) => a.date < b.date ? 1 : -1);
}

function fmtTime(s: string | null) {
  if (!s) return '—';
  return new Date(s).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

function exportCsv(rows: MergedRow[]) {
  const header = 'Employee;Date;Check-in;Check-out\n';
  const body = rows.map(r => `${r.employeeName};${r.date};${fmtTime(r.checkIn)};${fmtTime(r.checkOut)}`).join('\n');
  const bom = '\uFEFF';
  const blob = new Blob([bom + header + body], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `attendance_${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function AttendancePage() {
  const today = new Date().toISOString().slice(0, 10);
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
  const monthAgo = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
  const [startDate, setStartDate] = useState(weekAgo);
  const [endDate, setEndDate] = useState(today);

  const { data, isLoading } = useQuery({
    queryKey: ['attendance', startDate, endDate],
    queryFn: () => api.get<ApiResponse<Attendance[]>>('/admin/hr/attendance', {
      params: { from: startDate, to: endDate },
    }).then(r => r.data.data),
  });

  const rows = mergeRecords(data || []);

  const periods = [
    { label: 'Today', start: today, end: today },
    { label: 'Week', start: weekAgo, end: today },
    { label: 'Month', start: monthAgo, end: today },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold">Attendance</h2>
        <button onClick={() => exportCsv(rows)} disabled={rows.length === 0}
          className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-50 text-sm disabled:opacity-40">
          <Download size={16}/> Download Excel (CSV)
        </button>
      </div>

      <div className="flex gap-2 mb-3 flex-wrap">
        {periods.map(p => (
          <button key={p.label}
            onClick={() => { setStartDate(p.start); setEndDate(p.end); }}
            className={`px-3 py-1.5 rounded-lg text-sm border transition-all ${startDate === p.start && endDate === p.end ? 'bg-teal-700 text-white border-teal-700' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'}`}>
            {p.label}
          </button>
        ))}
        <div className="flex gap-2 items-center ml-2">
          <label className="text-sm text-gray-600">From</label>
          <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="px-3 py-1.5 border rounded-lg text-sm"/>
          <label className="text-sm text-gray-600">To</label>
          <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="px-3 py-1.5 border rounded-lg text-sm"/>
        </div>
      </div>

      {isLoading ? <p>Loading...</p> : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left"><tr>
              <th className="px-4 py-3">Employee</th>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3 text-green-700">✓ Check-in</th>
              <th className="px-4 py-3 text-orange-600">→ Check-out</th>
              <th className="px-4 py-3 text-gray-500">Hours worked</th>
            </tr></thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map(r => {
                const worked = r.workedMinutes !== null
                  ? `${Math.floor(r.workedMinutes / 60)}h ${r.workedMinutes % 60}m`
                  : r.checkIn && r.checkOut
                  ? (() => {
                      const diff = new Date(r.checkOut).getTime() - new Date(r.checkIn).getTime();
                      const h = Math.floor(diff / 3600000);
                      const m = Math.floor((diff % 3600000) / 60000);
                      return `${h}h ${m}m`;
                    })()
                  : null;
                return (
                  <tr key={r.key} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium">{r.employeeName}</td>
                    <td className="px-4 py-3 text-gray-500">{r.date}</td>
                    <td className="px-4 py-3">
                      {r.checkIn
                        ? <span className="inline-flex items-center gap-1 text-green-700"><span className="w-2 h-2 bg-green-500 rounded-full"/>{fmtTime(r.checkIn)}</span>
                        : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      {r.checkOut
                        ? <span className="inline-flex items-center gap-1 text-orange-600"><span className="w-2 h-2 bg-orange-400 rounded-full"/>{fmtTime(r.checkOut)}</span>
                        : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-3 text-gray-500 font-mono text-xs">{worked || '—'}</td>
                  </tr>
                );
              })}
              {rows.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">No records for the selected period</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}