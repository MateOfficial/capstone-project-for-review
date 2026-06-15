import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../lib/api';
import toast from 'react-hot-toast';
import type { Employee, ApiResponse } from '../../types';
import { ChevronLeft, ChevronRight, Copy } from 'lucide-react';

interface ScheduleEntry { id: number; employeeId: number; date: string; type: string; }

const DAYS_EN = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MONTHS_EN = ['January','February','March','April','May','June','July','August','September','October','November','December'];

function getCalendarDays(year: number, month: number) {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  let startDow = firstDay.getDay();
  startDow = startDow === 0 ? 6 : startDow - 1;
  const days: (number | null)[] = [];
  for (let i = 0; i < startDow; i++) days.push(null);
  for (let d = 1; d <= lastDay.getDate(); d++) days.push(d);
  while (days.length % 7 !== 0) days.push(null);
  return days;
}

export default function SchedulesPage() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [selectedEmp, setSelectedEmp] = useState<number | null>(null);
  const qc = useQueryClient();

  const prev = () => { if (month === 0) { setMonth(11); setYear(y => y - 1); } else setMonth(m => m - 1); };
  const next = () => { if (month === 11) { setMonth(0); setYear(y => y + 1); } else setMonth(m => m + 1); };

  const { data: employees } = useQuery({
    queryKey: ['employees'],
    queryFn: () => api.get<ApiResponse<Employee[]>>('/admin/hr/employees').then(r => r.data.data),
  });

  const { data: schedules } = useQuery({
    queryKey: ['schedules', year, month + 1],
    queryFn: () => api.get<ApiResponse<ScheduleEntry[]>>(`/admin/hr/schedules/${year}/${month + 1}`).then(r => r.data.data),
  });

  const assignMut = useMutation({
    mutationFn: (body: { employeeId: number; dates: string[]; type: string }) => api.post('/admin/hr/schedules/assign', body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['schedules'] }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => api.delete(`/admin/hr/schedules/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['schedules'] }),
  });

  const copyNextMut = useMutation({
    mutationFn: (empId: number) => api.post(`/admin/hr/schedules/copy-next/${empId}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['schedules'] }); toast.success('Copied to next month'); },
    onError: () => toast.error('Copy failed'),
  });

  const calDays = useMemo(() => getCalendarDays(year, month), [year, month]);

  const getEntry = (empId: number, day: number) => {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return (schedules || []).find(s => s.employeeId === empId && s.date === dateStr);
  };

  const toggleDay = (day: number) => {
    if (!selectedEmp) return;
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const existing = getEntry(selectedEmp, day);
    if (!existing) {
      assignMut.mutate({ employeeId: selectedEmp, dates: [dateStr], type: 'dayoff-stable' });
    } else if (existing.type === 'dayoff-stable') {
      deleteMut.mutate(existing.id);
      setTimeout(() => assignMut.mutate({ employeeId: selectedEmp, dates: [dateStr], type: 'dayoff-rotating' }), 200);
    } else {
      deleteMut.mutate(existing.id);
    }
  };

  const isToday = (day: number) => year === now.getFullYear() && month === now.getMonth() && day === now.getDate();

  const activeEmps = employees?.filter(e => e.active) || [];

  return (
    <div>
      <h2 className="text-xl font-bold mb-4">Work schedule</h2>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Employee list */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="p-3 border-b bg-gray-50">
            <p className="text-sm font-medium text-gray-700">Employees</p>
          </div>
          <div className="divide-y divide-gray-100">
            {activeEmps.map(emp => (
              <button
                key={emp.id}
                onClick={() => setSelectedEmp(emp.id)}
                className={`w-full text-left px-3 py-2.5 text-sm transition-colors ${
                  selectedEmp === emp.id ? 'bg-teal-50 text-teal-800 font-medium' : 'hover:bg-gray-50'
                }`}
              >
                <p className="font-medium">{emp.name}</p>
                <p className="text-xs text-gray-500">{emp.position}</p>
              </button>
            ))}
            {activeEmps.length === 0 && <p className="p-3 text-sm text-gray-400">No employees</p>}
          </div>
          {selectedEmp && (
            <div className="p-3 border-t">
              <button
                onClick={() => copyNextMut.mutate(selectedEmp)}
                disabled={copyNextMut.isPending}
                className="flex items-center gap-1.5 w-full px-3 py-2 bg-gray-100 rounded-lg text-xs font-medium text-gray-700 hover:bg-gray-200"
              >
                <Copy size={14} /> Copy to next month
              </button>
            </div>
          )}
        </div>

        {/* Calendar */}
        <div className="lg:col-span-3 bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="flex items-center justify-between p-3 border-b">
            <button onClick={prev} className="p-1.5 hover:bg-gray-100 rounded"><ChevronLeft size={18} /></button>
            <h3 className="text-sm font-bold text-gray-800">{MONTHS_EN[month]} {year}</h3>
            <button onClick={next} className="p-1.5 hover:bg-gray-100 rounded"><ChevronRight size={18} /></button>
          </div>

          {!selectedEmp ? (
            <div className="p-12 text-center text-gray-400">
              <p>Select an employee to edit schedule</p>
            </div>
          ) : (
            <div className="grid grid-cols-7">
              {DAYS_EN.map(d => (
                <div key={d} className="text-center py-1.5 text-xs font-medium text-gray-500 border-b bg-gray-50">{d}</div>
              ))}
              {calDays.map((day, i) => {
                if (day === null) return <div key={i} className="h-16 border-b border-r border-gray-100 bg-gray-50/50" />;
                const entry = getEntry(selectedEmp, day);
                const bg = entry?.type === 'dayoff-stable'
                  ? 'bg-green-100 hover:bg-green-200 border-green-300'
                  : entry?.type === 'dayoff-rotating'
                    ? 'bg-amber-100 hover:bg-amber-200 border-amber-300'
                    : 'bg-white hover:bg-gray-50 border-gray-100';
                return (
                  <button
                    key={i}
                    onClick={() => toggleDay(day)}
                    className={`h-16 border-b border-r text-sm font-medium transition-colors ${bg} ${isToday(day) ? 'ring-2 ring-teal-400 ring-inset' : ''}`}
                  >
                    <span className={isToday(day) ? 'text-teal-700 font-bold' : 'text-gray-700'}>{day}</span>
                    {entry && (
                      <p className="text-[10px] mt-0.5 text-gray-500">
                        {entry.type === 'dayoff-stable' ? 'fixed' : 'rot.'}
                      </p>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Legend */}
      <div className="flex gap-6 mt-4 text-xs text-gray-500">
        <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-green-200 border border-green-300" /> Fixed day off</div>
        <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-amber-200 border border-amber-300" /> Rotating day off</div>
        <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-white border border-gray-300" /> Work day</div>
        <p className="text-gray-400">Click: fixed → rotating → clear</p>
      </div>
    </div>
  );
}
