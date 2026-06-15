import { useQuery } from '@tanstack/react-query';
import api from '../../lib/api';
import type { ReportSummary, ApiResponse } from '../../types';
import { Package, Users, Shield, UserCheck, Clock, Tag } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export default function DashboardPage() {
  const { t } = useTranslation();
  const { data, isLoading } = useQuery({
    queryKey: ['reports', 'summary'],
    queryFn: () => api.get<ApiResponse<ReportSummary>>('/admin/reports/summary').then((r) => r.data.data),
  });

  if (isLoading) return <p>{t('dashboard.loading')}</p>;

  const stats = [
    { label: t('dashboard.products'), value: data?.totalProducts ?? 0, icon: Package, color: 'bg-blue-50 text-blue-600' },
    { label: t('dashboard.discounted'), value: data?.discountedProducts ?? 0, icon: Tag, color: 'bg-green-50 text-green-600' },
    { label: t('dashboard.clients'), value: data?.totalClients ?? 0, icon: Users, color: 'bg-purple-50 text-purple-600' },
    { label: t('dashboard.warranties'), value: data?.totalWarranties ?? 0, icon: Shield, color: 'bg-yellow-50 text-yellow-600' },
    { label: t('dashboard.employees'), value: data?.totalEmployees ?? 0, icon: UserCheck, color: 'bg-pink-50 text-pink-600' },
    { label: t('dashboard.attendance'), value: data?.recentAttendance ?? 0, icon: Clock, color: 'bg-indigo-50 text-indigo-600' },
  ];

  return (
    <div className="sf-fade-in">
      <h2 className="text-2xl font-bold text-slate-900 mb-5">{t('dashboard.title')}</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {stats.map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="rounded-2xl p-5 border border-slate-200 bg-white shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${color}`}><Icon size={20} /></div>
              <div>
                <p className="text-3xl font-bold text-slate-900 leading-none">{value}</p>
                <p className="text-sm text-slate-500 mt-1">{label}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
