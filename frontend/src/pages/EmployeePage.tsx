import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import type { ApiResponse } from '../types';
import { Clock, UserCheck, LogIn, LogOut, CalendarOff, Users, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import AiAssistantEmployee from '../components/AiAssistantEmployee';
import { useTranslation } from 'react-i18next';

const api = axios.create({ baseURL: '/api' });

interface EmployeePublic { id: number; name: string; position: string; active: boolean; }
interface CheckinRecord { id: number; employeeId: number; employeeName: string; type: string; timestamp: string; }
interface ScheduleEntry { employeeId: number; employeeName: string; date: string; type: string; }

export default function EmployeePage() {
  const { t } = useTranslation();
  const [selected, setSelected] = useState<number | null>(null);
  const qc = useQueryClient();
  const now = new Date();

  const { data: employees } = useQuery({
    queryKey: ['pub-employees'],
    queryFn: () => api.get<ApiResponse<EmployeePublic[]>>('/employee/list').then(r => r.data.data),
  });

  const { data: checkins } = useQuery({
    queryKey: ['pub-checkins'],
    queryFn: () => api.get<ApiResponse<CheckinRecord[]>>('/employee/checkins/today').then(r => r.data.data),
    refetchInterval: 15000,
  });

  const { data: schedules } = useQuery({
    queryKey: ['pub-schedule', now.getFullYear(), now.getMonth() + 1],
    queryFn: () => api.get<ApiResponse<ScheduleEntry[]>>(`/employee/schedule/${now.getFullYear()}/${now.getMonth() + 1}`).then(r => r.data.data),
  });

  const checkinMut = useMutation({
    mutationFn: (employeeId: number) => api.post<ApiResponse<CheckinRecord>>('/employee/checkin', { employeeId }),
    onSuccess: (resp) => {
      qc.invalidateQueries({ queryKey: ['pub-checkins'] });
      const d = resp.data.data;
      setSelected(null);
      alert(`${d.type === 'check-in' ? `✅ ${t('employee.checkIn')}` : `🚪 ${t('employee.checkOut')}`} ${t('employee.fixedFor')} ${d.employeeName}`);
    },
    onError: (error: any) => {
      const msg = error?.response?.data?.error?.message || t('employee.errorTryAgain');
      alert(msg);
    },
  });

  const fmtTime = (s: string) => new Date(s).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const todayOffIds = new Set((schedules || []).filter(s => s.date === todayStr).map(s => s.employeeId));

  const getLastCheckin = (empId: number) => {
    if (!checkins) return null;
    return checkins.filter(c => c.employeeId === empId).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];
  };

  const isAtWork = (empId: number) => {
    const last = getLastCheckin(empId);
    return last?.type === 'check-in';
  };

  const atWorkNow = (employees || []).filter(e => e.active && isAtWork(e.id));
  const selectedEmp = employees?.find(e => e.id === selected);
  const selectedIsDayOff = selected ? todayOffIds.has(selected) : false;
  const selectedIsCheckedIn = selected ? isAtWork(selected) : false;

  return (
    <>
    <div className="min-h-screen bg-transparent sf-fade-in">
      {/* Header */}
      <div className="bg-white/85 backdrop-blur-md shadow-sm border-b border-slate-200/80">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/catalog" className="flex items-center gap-1.5 text-sm text-teal-700 hover:text-teal-800">
              <ArrowLeft size={16} /> {t('common.catalog')}
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Yamaha Store</h1>
              <p className="text-sm text-slate-500">{t('employee.timeTracking')}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-slate-500">
            <Clock size={20} />
            <span className="text-lg font-mono">{now.toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long' })}</span>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="grid md:grid-cols-3 gap-6">
          {/* Left: Employee Grid */}
          <div className="md:col-span-2">
            <h2 className="text-lg font-semibold text-slate-700 mb-4">{t('employee.selectEmployee')}</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6">
              {employees?.filter(e => e.active).map(emp => {
                const isDayOff = todayOffIds.has(emp.id);
                const checkedIn = isAtWork(emp.id);
                const last = getLastCheckin(emp.id);
                return (
                  <button
                    key={emp.id}
                    onClick={() => setSelected(emp.id)}
                    disabled={isDayOff}
                    className={`p-4 rounded-xl border-2 transition-all text-left ${
                      isDayOff ? 'border-orange-200 bg-orange-50 opacity-70 cursor-not-allowed' :
                      selected === emp.id
                        ? 'border-teal-500 bg-teal-50 shadow-md scale-[1.02]'
                        : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm'
                    }`}
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm ${
                        isDayOff ? 'bg-orange-400' : checkedIn ? 'bg-green-500' : 'bg-slate-400'
                      }`}>
                        {isDayOff ? <CalendarOff size={16} /> : emp.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-slate-800 truncate">{emp.name}</p>
                        <p className="text-xs text-slate-500">{emp.position}</p>
                      </div>
                    </div>
                    {isDayOff ? (
                      <p className="text-xs text-orange-600 font-medium">🏠 {t('employee.todayOff')}</p>
                    ) : last ? (
                      <p className={`text-xs ${checkedIn ? 'text-green-600' : 'text-orange-600'}`}>
                        {checkedIn ? `● ${t('employee.atWork')}` : `○ ${t('employee.leftWork')}`} {t('employee.from')} {fmtTime(last.timestamp)}
                      </p>
                    ) : (
                      <p className="text-xs text-slate-400">{t('employee.notCheckedInYet')}</p>
                    )}
                  </button>
                );
              })}
              {!employees?.length && <p className="col-span-full text-center text-slate-400 py-8">{t('employee.noActiveEmployees')}</p>}
            </div>

            {/* Action area */}
            {selected && selectedEmp && (
              <div className="bg-white rounded-2xl border-2 border-teal-200 p-6 text-center mb-6 shadow-sm">
                <p className="text-lg font-bold text-slate-800 mb-1">{selectedEmp.name}</p>
                {selectedIsDayOff ? (
                  <p className="text-orange-600 font-medium mb-3">🏠 {t('employee.dayOffUnavailable')}</p>
                ) : selectedIsCheckedIn ? (
                  <>
                    <p className="text-green-600 font-medium mb-3">✅ {t('employee.youAtWork')}</p>
                    <button
                      onClick={() => checkinMut.mutate(selected)}
                      disabled={checkinMut.isPending}
                      className="flex items-center gap-3 px-8 py-4 mx-auto bg-orange-500 text-white rounded-2xl text-lg font-semibold hover:bg-orange-600 shadow-lg transition-all disabled:opacity-50"
                    >
                      <LogOut size={24} />
                      {checkinMut.isPending ? t('employee.processing') : t('employee.leaving')}
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => checkinMut.mutate(selected)}
                    disabled={checkinMut.isPending}
                    className="flex items-center gap-3 px-8 py-4 mx-auto bg-teal-700 text-white rounded-2xl text-lg font-semibold hover:bg-teal-800 shadow-lg hover:shadow-xl transition-all disabled:opacity-50"
                  >
                    <UserCheck size={24} />
                    {checkinMut.isPending ? t('employee.processing') : t('employee.arrived')}
                  </button>
                )}
              </div>
            )}

            {/* Today's Log */}
            <h2 className="text-lg font-semibold text-slate-700 mb-3">{t('employee.todayLog')}</h2>
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
              {checkins && checkins.length > 0 ? (
                <div className="divide-y divide-slate-100">
                  {[...checkins].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).map(c => (
                    <div key={c.id} className="flex items-center gap-3 px-4 py-3">
                      <div className={`p-1.5 rounded-lg ${c.type === 'check-in' ? 'bg-green-100 text-green-600' : 'bg-orange-100 text-orange-600'}`}>
                        {c.type === 'check-in' ? <LogIn size={16} /> : <LogOut size={16} />}
                      </div>
                      <div className="flex-1">
                        <span className="font-medium text-slate-800">{c.employeeName}</span>
                        <span className="text-slate-400 mx-2">—</span>
                        <span className={`text-sm ${c.type === 'check-in' ? 'text-green-600' : 'text-orange-600'}`}>
                          {c.type === 'check-in' ? t('employee.checkIn') : t('employee.checkOut')}
                        </span>
                      </div>
                      <span className="text-sm text-slate-500 font-mono">{fmtTime(c.timestamp)}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-slate-400 py-8">{t('employee.noTodayRecords')}</p>
              )}
            </div>
          </div>

          {/* Right sidebar: at work now */}
          <div>
            <div className="bg-white rounded-2xl border border-slate-200 p-5 sticky top-4 shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <Users size={20} className="text-green-600" />
                <h3 className="text-sm font-bold text-slate-700">{t('employee.atWorkNow')}</h3>
                <span className="ml-auto bg-green-100 text-green-700 px-2 py-0.5 rounded-full text-xs font-bold">{atWorkNow.length}</span>
              </div>
              {atWorkNow.length > 0 ? (
                <div className="space-y-2">
                  {atWorkNow.map(emp => {
                    const last = getLastCheckin(emp.id);
                    return (
                      <div key={emp.id} className="flex items-center gap-3 p-2 bg-green-50 rounded-lg">
                        <div className="w-8 h-8 rounded-full bg-green-500 text-white flex items-center justify-center text-xs font-bold">
                          {emp.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-slate-800 truncate">{emp.name}</p>
                          <p className="text-[10px] text-green-600">{t('employee.from')} {last ? fmtTime(last.timestamp) : '—'}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-center text-slate-400 text-sm py-4">{t('employee.nobody')}</p>
              )}

              {/* Day offs today */}
              {todayOffIds.size > 0 && (
                <div className="mt-6">
                  <div className="flex items-center gap-2 mb-3">
                    <CalendarOff size={18} className="text-orange-500" />
                    <h3 className="text-sm font-bold text-slate-700">{t('employee.todayDaysOff')}</h3>
                    <span className="ml-auto bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full text-xs font-bold">{todayOffIds.size}</span>
                  </div>
                  <div className="space-y-1.5">
                    {(employees || []).filter(e => todayOffIds.has(e.id)).map(emp => (
                      <div key={emp.id} className="flex items-center gap-2 p-2 bg-orange-50 rounded-lg">
                        <div className="w-8 h-8 rounded-full bg-orange-400 text-white flex items-center justify-center text-xs font-bold">
                          <CalendarOff size={12} />
                        </div>
                        <p className="text-sm text-slate-700 truncate">{emp.name}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
    <AiAssistantEmployee />
    </>
  );
}
