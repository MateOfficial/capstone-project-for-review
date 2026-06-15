export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  error?: ApiError;
  timestamp: string;
}

export interface ApiError {
  code: string;
  message: string;
  fieldErrors?: Record<string, string>;
}

export interface PageResponse<T> {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  last: boolean;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: UserInfo;
}

export interface UserInfo {
  id: number;
  username: string;
  fullName: string;
  email: string;
  storeId: number;
  storeName: string;
  permissions: string[];
}

export interface Product {
  id: number;
  code: string;
  name: string;
  searchKey: string;
  description: string;
  detailedDescription: string;
  categoryId: number;
  categoryName: string;
  price: number;
  discount: number | null;
  discountedPrice: number | null;
  stockQuantity: number;
  warehouseStock?: Record<string, number>;
  active: boolean;
  features: string[];
  characteristics: string;
  images: ProductImage[];
  createdAt: string;
  updatedAt: string;
}

export interface ProductImage {
  id: number;
  url: string;
  altText: string;
  primaryImage: boolean;
}

export interface Category {
  id: number;
  name: string;
  slug: string;
  parentId: number | null;
  sortOrder: number;
  active: boolean;
  productCount: number;
}

export interface Client {
  id: number;
  fullName: string;
  phone: string;
  email: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface Employee {
  id: number;
  name: string;
  phone: string;
  position: string;
  hireDate?: string | null;
  email?: string | null;
  emergencyContact?: string | null;
  hrNotes?: string | null;
  active: boolean;
  createdAt: string;
}

export interface Attendance {
  id: number;
  employeeId: number;
  employeeName: string;
  type: string;
  ipAddress: string;
  timestamp: string;
  workedMinutes?: number | null;
}

export interface AuditLog {
  id: number;
  username: string;
  action: string;
  entityType: string | null;
  entityId: string | null;
  details?: Record<string, unknown> | null;
  ipAddress: string | null;
  timestamp: string;
}

export interface Schedule {
  id: number;
  employeeName: string;
  year: number;
  month: number;
  days: Record<string, string>;
}

export interface Warranty {
  id: number;
  warrantyNumber: string;
  model: string;
  serialNumber: string;
  brand: string;
  durationMonths: number;
  clientId: number | null;
  clientName: string | null;
  signatureData: string;
  expiresAt: string;
  createdAt: string;
}

export interface WarrantyRule {
  id: number;
  brand: string;
  durationMonths: number;
  terms: string;
  active: boolean;
}

export interface DocumentTemplate {
  id: number;
  type: string;
  name: string;
  version: number;
  content: string;
  status: string;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface IssuanceAct {
  id: number;
  actNumber: string;
  model: string;
  serialNumber: string;
  price: string;
  returnDate: string | null;
  clientId: number | null;
  clientName: string;
  clientPhone: string;
  condition: string;
  completeness: string[];
  notes: string;
  signatureData: string;
  status: string;
  createdAt: string;
}

export interface ClientHistory {
  client: Client;
  warranties: Warranty[];
  issuanceActs: IssuanceAct[];
}

export interface DocumentTemplate {
  id: number;
  name: string;
  code: string;
  type: string;
  htmlContent: string;
  cssContent: string;
  status: string;
  version: number;
}

export interface ReportSummary {
  totalProducts: number;
  totalClients: number;
  totalWarranties: number;
  totalEmployees: number;
  recentAttendance: number;
  discountedProducts: number;
}

export interface OnboardingStatus {
  initialized: boolean;
  currentStep: string;
  completedSteps: string[];
  storeId: number | null;
}
