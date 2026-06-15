import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import type { ApiResponse } from '../types';
import { ChevronLeft, ChevronRight, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

const pub = axios.create({ baseURL: '/api' });

interface ScheduleEntry { id: number; employeeId: number; date: string; type: string; }
interface EmployeeItem { id: number; name: string; position: string; active: boolean; }

const DAYS_EN = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MONTHS_EN = ['January','February','March','April','May','June','July','August','September','October','November','December'];

function getCalendarDays(year: number, month: number) {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  let startDow = firstDay.getDay();
  startDow = startDow === 0 ? 6 : startDow - 1; // Monday-based
  const days: (number | null)[] = [];
  for (let i = 0; i < startDow; i++) days.push(null);
  for (let d = 1; d <= lastDay.getDate(); d++) days.push(d);
  while (days.length % 7 !== 0) days.push(null);
  return days;
}

export default function SchedulePage() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());

  const prev = () => { if (month === 0) { setMonth(11); setYear(y => y - 1); } else setMonth(m => m - 1); };
  const next = () => { if (month === 11) { setMonth(0); setYear(y => y + 1); } else setMonth(m => m + 1); };

  const { data: schedules } = useQuery({
    queryKey: ['pub-schedules', year, month + 1],
    queryFn: () => pub.get<ApiResponse<ScheduleEntry[]>>(`/employee/schedule/${year}/${month + 1}`).then(r => r.data.data),
  });

  const { data: employees } = useQuery({
    queryKey: ['pub-employees'],
    queryFn: () => pub.get<ApiResponse<EmployeeItem[]>>('/employee/list').then(r => r.data.data),
  });

  const calDays = useMemo(() => getCalendarDays(year, month), [year, month]);

  const getOffsForDay = (day: number) => {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return (schedules || []).filter(s => s.date === dateStr && (s.type === 'dayoff-stable' || s.type === 'dayoff-rotating'));
  };

  const today = now.getDate();
  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth();

  const todayOffs = isCurrentMonth ? getOffsForDay(today) : [];

  return (
    <div className="min-h-screen bg-transparent sf-fade-in">
      <header className="bg-white/85 backdrop-blur-md shadow-sm border-b border-slate-200/80">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/catalog" className="text-slate-400 hover:text-slate-600"><ArrowLeft size={20} /></Link>
            <h1 className="text-xl font-bold text-slate-900">📅 Work schedule</h1>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Today's offs */}
        {isCurrentMonth && todayOffs.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
            <p className="text-sm font-medium text-amber-800 mb-2">🏠 Today off for:</p>
            <div className="flex flex-wrap gap-2">
              {todayOffs.map(off => {
                const emp = employees?.find(e => e.id === off.employeeId);
                return emp ? <span key={off.id} className="px-3 py-1 bg-amber-100 text-amber-800 rounded-full text-sm">{emp.name}</span> : null;
              })}
            </div>
          </div>
        )}

        {/* Calendar */}
        <div className="sf-card rounded-xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="flex items-center justify-between p-4 border-b border-slate-100">
            <button onClick={prev} className="p-2 hover:bg-slate-100 rounded-lg"><ChevronLeft size={20} /></button>
            <h2 className="text-lg font-bold text-slate-800">{MONTHS_EN[month]} {year}</h2>
            <button onClick={next} className="p-2 hover:bg-slate-100 rounded-lg"><ChevronRight size={20} /></button>
          </div>

          <div className="grid grid-cols-7">
            {DAYS_EN.map(d => (
              <div key={d} className="text-center py-2 text-xs font-medium text-slate-500 border-b bg-slate-50">{d}</div>
            ))}
            {calDays.map((day, i) => {
              if (day === null) return <div key={i} className="min-h-[80px] border-b border-r border-slate-100 bg-slate-50/50" />;
              const offs = getOffsForDay(day);
              const isToday = isCurrentMonth && day === today;
              return (
                <div key={i} className={`min-h-[80px] border-b border-r border-slate-100 p-1 ${isToday ? 'bg-teal-50' : ''}`}>
                  <div className={`text-xs font-medium mb-1 ${isToday ? 'text-teal-700 font-bold' : 'text-slate-600'}`}>{day}</div>
                  <div className="space-y-0.5">
                    {offs.map(off => {
                      const emp = employees?.find(e => e.id === off.employeeId);
                      if (!emp) return null;
                      const isStable = off.type === 'dayoff-stable';
                      return (
                        <div key={off.id} className={`text-[10px] px-1 py-0.5 rounded truncate ${isStable ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                          {emp.name.split(' ')[0]}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Legend */}
        <div className="flex gap-6 mt-4 justify-center text-xs text-slate-500">
          <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-green-200 border border-green-300" /> Fixed day off</div>
          <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-amber-200 border border-amber-300" /> Rotating day off</div>
        </div>
      </div>
    </div>
  );
}
