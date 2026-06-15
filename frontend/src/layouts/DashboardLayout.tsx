import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import AiAssistant from '../components/AiAssistant';
import {
  LayoutDashboard, Package, FolderTree, Users, UserCheck,
  Clock, Shield, FileText, Settings, LogOut, Calendar,
  UsersRound, BarChart3, Globe, Link2, History,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

const nav = [
  { to: '/admin', icon: LayoutDashboard, labelKey: 'admin.menu.dashboard', end: true },
  { to: '/admin/products', icon: Package, labelKey: 'admin.menu.products', permissions: ['catalog.view', 'catalog.manage'] },
  { to: '/admin/categories', icon: FolderTree, labelKey: 'admin.menu.categories', permissions: ['catalog.view', 'catalog.manage'] },
  { to: '/admin/clients', icon: Users, labelKey: 'admin.menu.clients', permissions: ['crm.view', 'crm.manage'] },
  { to: '/admin/employees', icon: UserCheck, labelKey: 'admin.menu.employees', permissions: ['hr.view', 'hr.manage'] },
  { to: '/admin/attendance', icon: Clock, labelKey: 'admin.menu.attendance', permissions: ['hr.view', 'hr.manage'] },
  { to: '/admin/schedules', icon: Calendar, labelKey: 'admin.menu.schedules', permissions: ['hr.view', 'hr.manage'] },
  { to: '/admin/warranties', icon: Shield, labelKey: 'admin.menu.warranties', permissions: ['documents.view', 'documents.manage'] },
  { to: '/admin/warranty-template', icon: Shield, labelKey: 'admin.menu.warrantyTemplate', permissions: ['documents.templates', 'documents.manage'] },
  { to: '/admin/warranty-brands', icon: Shield, labelKey: 'admin.menu.warrantyBrands', permissions: ['documents.templates', 'documents.manage'] },
  { to: '/admin/issuances', icon: FileText, labelKey: 'admin.menu.issuances', permissions: ['documents.view', 'documents.manage'] },
  { to: '/admin/users', icon: UsersRound, labelKey: 'admin.menu.users', permissions: ['admin.users'] },
  { to: '/admin/audit', icon: History, labelKey: 'admin.menu.audit', permissions: ['admin.audit'] },
  { to: '/admin/reports', icon: BarChart3, labelKey: 'admin.menu.reports', permissions: ['reports.view'] },
  { to: '/admin/settings', icon: Settings, labelKey: 'admin.menu.settings', permissions: ['settings.view', 'settings.manage'] },
  { to: '/admin/integration', icon: Link2, labelKey: 'admin.menu.integration', permissions: ['catalog.manage', 'catalog.import'] },
];

export default function DashboardLayout() {
  const { user, logout, hasPermission } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();

  const visibleNav = nav.filter((item) =>
    !item.permissions || item.permissions.some((permission) => hasPermission(permission))
  );

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="flex h-screen bg-transparent sf-fade-in">
      <aside className="w-72 border-r border-slate-200/80 bg-white/85 backdrop-blur-md flex flex-col">
        <div className="p-5 border-b border-slate-200/80">
          <h1 className="text-xl font-bold text-slate-900">Configurable Platform</h1>
          <p className="text-xs text-slate-500 mt-1">{user?.storeName}</p>
        </div>
        <nav className="flex-1 p-3 space-y-1.5 overflow-y-auto">
          {visibleNav.map(({ to, icon: Icon, labelKey, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm transition-all ${
                  isActive
                    ? 'bg-teal-50 text-teal-800 font-semibold sf-soft-ring'
                    : 'text-slate-600 hover:bg-slate-100/80 hover:text-slate-800'
                }`
              }
            >
              <Icon size={18} />
              {t(labelKey)}
            </NavLink>
          ))}
        </nav>
        <div className="p-4 border-t border-slate-200/80">
          <div className="text-sm font-medium text-slate-800">{user?.fullName}</div>
          <div className="text-xs text-slate-500">{user?.username}</div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 mt-2 text-sm text-red-600 hover:text-red-700"
          >
            <LogOut size={16} /> {t('common.logout')}
          </button>
        </div>
        <a href="/catalog" className="flex items-center gap-2 px-4 py-3 text-sm text-teal-700 hover:text-teal-800 border-t border-slate-200/80 bg-teal-50/40">
          <Globe size={16} /> {t('common.openCatalog')}
        </a>
      </aside>
      <main className="flex-1 overflow-y-auto p-6 md:p-7 lg:p-8">
        <div className="max-w-[1320px] mx-auto sf-card p-5 md:p-6 lg:p-7">
          <Outlet />
        </div>
      </main>
      <AiAssistant />
    </div>
  );
}
