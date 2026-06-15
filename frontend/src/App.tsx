import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import { useBrandConfig } from './hooks/useBrandConfig';
import { useState, useEffect } from 'react';
import api from './lib/api';
import LoginPage from './pages/LoginPage';
import OnboardingPage from './pages/OnboardingPage';
import DashboardLayout from './layouts/DashboardLayout';
import DashboardPage from './pages/admin/DashboardPage';
import ProductsPage from './pages/admin/ProductsPage';
import CategoriesPage from './pages/admin/CategoriesPage';
import ClientsPage from './pages/admin/ClientsPage';
import EmployeesPage from './pages/admin/EmployeesPage';
import AttendancePage from './pages/admin/AttendancePage';
import WarrantiesPage from './pages/admin/WarrantiesPage';
import IssuancesPage from './pages/admin/IssuancesPage';
import SchedulesPage from './pages/admin/SchedulesPage';
import UsersPage from './pages/admin/UsersPage';
import ReportsPage from './pages/admin/ReportsPage';
import SettingsPage from './pages/admin/SettingsPage';
import WarrantyTemplatePage from './pages/admin/WarrantyTemplatePage';
import WarrantyBrandsPage from './pages/admin/WarrantyBrandsPage';
import IntegrationMappingPage from './pages/admin/IntegrationMappingPage';
import AuditPage from './pages/admin/AuditPage';
import EmployeePage from './pages/EmployeePage';
import CatalogPage from './pages/CatalogPage';
import EstimatePage from './pages/EstimatePage';
import SchedulePage from './pages/SchedulePage';
import DocumentsPage from './pages/DocumentsPage';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex items-center justify-center h-screen">Loading...</div>;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  useBrandConfig();
  const [initialized, setInitialized] = useState<boolean | null>(null);

  useEffect(() => {
    api.get('/onboarding/status')
      .then(({ data }) => setInitialized(data.data.initialized))
      .catch(() => setInitialized(true));
  }, []);

  if (initialized === null) return <div className="flex items-center justify-center h-screen">Loading...</div>;
  if (!initialized) return <Routes><Route path="*" element={<OnboardingPage />} /></Routes>;

  return (
    <Routes>
      <Route path="/catalog" element={<CatalogPage />} />
      <Route path="/estimate" element={<EstimatePage />} />
      <Route path="/schedule" element={<SchedulePage />} />
      <Route path="/employee" element={<EmployeePage />} />
      <Route path="/documents" element={<DocumentsPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/onboarding" element={<OnboardingPage />} />
      <Route
        path="/admin/*"
        element={
          <ProtectedRoute>
            <DashboardLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="products" element={<ProductsPage />} />
        <Route path="categories" element={<CategoriesPage />} />
        <Route path="clients" element={<ClientsPage />} />
        <Route path="employees" element={<EmployeesPage />} />
        <Route path="attendance" element={<AttendancePage />} />
        <Route path="schedules" element={<SchedulesPage />} />
        <Route path="warranties" element={<WarrantiesPage />} />
        <Route path="warranty-template" element={<WarrantyTemplatePage />} />
        <Route path="warranty-template/:tab" element={<WarrantyTemplatePage />} />
        <Route path="warranty-brands" element={<WarrantyBrandsPage />} />
        <Route path="issuances" element={<IssuancesPage />} />
        <Route path="users" element={<UsersPage />} />
        <Route path="audit" element={<AuditPage />} />
        <Route path="reports" element={<ReportsPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="integration" element={<IntegrationMappingPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/catalog" replace />} />
    </Routes>
  );
}
