import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import type { Product, Category, ApiResponse, PageResponse } from '../types';
import { Search, X, ChevronLeft, ChevronRight, Grid3X3, Lock, ArrowLeft, Calendar, UserCheck, FileText } from 'lucide-react';
import { Link } from 'react-router-dom';

const pub = axios.create({ baseURL: '/api' });

export default function CatalogPage() {
  const { t } = useTranslation();
  const fmt = (n: number) => new Intl.NumberFormat('en-US').format(n) + ' sum';
  
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [view, setView] = useState<'categories' | 'products'>('categories');

  const { data: categories } = useQuery({
    queryKey: ['pub-categories'],
    queryFn: () => pub.get<ApiResponse<Category[]>>('/public/categories').then(r => r.data.data),
  });

  // Today's offs
  const now = new Date();
  const { data: scheduleData } = useQuery({
    queryKey: ['pub-schedule-today', now.getFullYear(), now.getMonth() + 1],
    queryFn: () => pub.get<ApiResponse<{ employeeId: number; employeeName: string; date: string; type: string }[]>>(`/employee/schedule/${now.getFullYear()}/${now.getMonth() + 1}`).then(r => r.data.data),
  });

  const todayOffs = (() => {
    if (!scheduleData) return [];
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    return scheduleData.filter(s => s.date === todayStr).map(s => s.employeeName);
  })();

  const { data: products, isLoading } = useQuery({
    queryKey: ['pub-products', search, page, selectedCategory],
    queryFn: () => {
      const params: Record<string, unknown> = { page, size: 24 };
      if (search) params.q = search;
      if (selectedCategory !== null) params.categoryId = selectedCategory;
      const endpoint = search ? '/public/products/search' : '/public/products';
      return pub.get<ApiResponse<PageResponse<Product>>>(endpoint, { params }).then(r => r.data.data);
    },
    enabled: view === 'products' || !!search,
  });

  const hasRealDiscount = (p: Product) =>
    p.discountedPrice !== null &&
    Number(p.discountedPrice) > 0 &&
    Number(p.discountedPrice) < Number(p.price) &&
    Number(p.discount ?? 0) > 0;

  const handleSearch = (q: string) => {
    setSearch(q);
    setPage(0);
    if (q) { setView('products'); setSelectedCategory(null); }
  };

  const handleCategoryClick = (catId: number) => {
    setSelectedCategory(catId);
    setSearch('');
    setPage(0);
    setView('products');
  };

  const handleBack = () => {
    setView('categories');
    setSelectedCategory(null);
    setSearch('');
    setPage(0);
  };

  const selectedCatName = categories?.find(c => c.id === selectedCategory)?.name;

  return (
    <div className="min-h-screen bg-transparent sf-fade-in">
      {/* Header */}
      <header className="bg-white/85 backdrop-blur-md border-b border-slate-200/80 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-4">
          <Link to="/" className="text-xl font-bold text-slate-900 whitespace-nowrap">Yamaha Store</Link>
          <div className="relative flex-1 max-w-xl">
            <Search size={18} className="absolute left-3 top-2.5 text-slate-400" />
            <input
              placeholder={t('catalog.search')}
              value={search}
              onChange={e => handleSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-xl text-sm bg-white/90 focus:outline-none focus:ring-2 focus:ring-teal-300"
            />
            {search && <button onClick={() => handleSearch('')} className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"><X size={18} /></button>}
          </div>
          <div className="flex items-center gap-2">
            <Link to="/documents" className="flex items-center gap-1.5 px-3 py-2 text-sm text-slate-600 hover:text-teal-700 hover:bg-slate-100 rounded-lg">
              <FileText size={16} /> {t('common.documents')}
            </Link>
            <Link to="/employee" className="flex items-center gap-1.5 px-3 py-2 text-sm text-slate-600 hover:text-teal-700 hover:bg-slate-100 rounded-lg">
              <UserCheck size={16} /> {t('employee.attendance')}
            </Link>
            <Link to="/schedule" className="flex items-center gap-1.5 px-3 py-2 text-sm text-slate-600 hover:text-teal-700 hover:bg-slate-100 rounded-lg">
              <Calendar size={16} /> {t('schedule.title')}
            </Link>
            <Link to="/admin" className="p-2 text-slate-400 hover:text-teal-700"><Lock size={18} /></Link>
          </div>
        </div>
        {todayOffs.length > 0 && (
          <div className="bg-amber-50/90 border-t border-amber-200 px-4 py-1.5">
            <div className="max-w-7xl mx-auto flex items-center gap-2 text-sm text-amber-800">
              <span className="font-medium">{t('common.todayOffs')}</span>
              {todayOffs.map((n, i) => <span key={i} className="px-2 py-0.5 bg-amber-100 rounded-full text-xs font-medium">{n}</span>)}
            </div>
          </div>
        )}
      </header>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Breadcrumb / Back */}
        {view === 'products' && (
          <button onClick={handleBack} className="flex items-center gap-1 text-sm text-teal-700 hover:text-teal-800 mb-4">
            <ArrowLeft size={16} /> {t('common.allCategories')}
          </button>
        )}

        {selectedCatName && <h2 className="text-2xl font-bold text-gray-800 mb-4">{selectedCatName}</h2>}

        {/* Category Grid */}
        {view === 'categories' && !search && (
          <div>
            <h2 className="text-2xl font-bold text-gray-800 mb-4">{t('catalog.title')}</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 mb-8">
              <button
                onClick={() => { setSelectedCategory(null); setView('products'); }}
                className="p-6 sf-card border-2 border-teal-200 hover:border-teal-400 hover:shadow-md transition-all text-left"
              >
                <Grid3X3 size={28} className="text-teal-700 mb-2" />
                <p className="font-semibold text-slate-800">{t('common.allProducts')}</p>
                <p className="text-xs text-slate-500 mt-1">{categories?.reduce((s, c) => s + (c.productCount || 0), 0)} {t('catalog.countProducts')}</p>
              </button>
              {categories?.filter(c => c.active).map(cat => (
                <button
                  key={cat.id}
                  onClick={() => handleCategoryClick(cat.id)}
                  className="p-6 sf-card border border-slate-200 hover:border-teal-300 hover:shadow-md transition-all text-left"
                >
                  <p className="font-semibold text-slate-800">{cat.name}</p>
                  <p className="text-xs text-slate-500 mt-1">{cat.productCount || 0} {t('catalog.countProducts')}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Products Grid */}
        {(view === 'products' || search) && (
          <div>
            {isLoading ? (
              <div className="flex items-center justify-center py-20">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-700" />
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                  {products?.content.map(p => (
                    <div key={p.id} className="sf-card rounded-xl border border-slate-200 overflow-hidden hover:shadow-lg transition-shadow group">
                      <button onClick={() => setSelectedProduct(p)} className="w-full text-left">
                        <div className="aspect-square bg-slate-100 flex items-center justify-center p-4">
                          {p.images?.length > 0 ? (
                            <img src={p.images[0].url} alt={p.name} className="max-h-full max-w-full object-contain" />
                          ) : (
                            <Package size={48} className="text-gray-300" />
                          )}
                        </div>
                        <div className="p-3">
                          <p className="text-xs text-slate-400 font-mono">{p.code}</p>
                          <p className="text-sm font-medium text-slate-800 line-clamp-2 mt-0.5">{p.name}</p>
                          <p className="text-xs text-slate-500 mt-1">{p.categoryName}</p>
                          <div className="mt-2">
                            {hasRealDiscount(p) ? (
                              <div>
                                <span className="text-xs line-through text-slate-400">{fmt(p.price)}</span>
                                <span className="ml-1 text-sm font-bold text-green-600">{fmt(p.discountedPrice ?? p.price)}</span>
                                <span className="ml-1 text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded">-{p.discount}%</span>
                              </div>
                            ) : (
                              <span className="text-sm font-bold text-slate-800">{fmt(p.price)}</span>
                            )}
                          </div>
                        </div>
                      </button>
                      <div className="px-3 pb-3">
                        <button
                          onClick={() => setSelectedProduct(p)}
                          className="w-full py-2 border border-teal-700 text-teal-700 rounded-lg text-sm font-medium hover:bg-teal-50 transition-colors"
                        >
                          {t('common.details')}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                {products?.content.length === 0 && (
                  <div className="text-center py-20 text-gray-400">
                    <Search size={48} className="mx-auto mb-3 opacity-50" />
                    <p className="text-lg">{t('common.nothingFound')}</p>
                  </div>
                )}
                {products && products.totalPages > 1 && (
                  <div className="flex gap-2 mt-6 justify-center items-center">
                    <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0} className="px-4 py-2 border rounded-lg disabled:opacity-50 hover:bg-gray-100"><ChevronLeft size={18} /></button>
                    <span className="px-4 py-2 text-sm text-gray-600">{page + 1} / {products.totalPages}</span>
                    <button onClick={() => setPage(p => p + 1)} disabled={products.last} className="px-4 py-2 border rounded-lg disabled:opacity-50 hover:bg-gray-100"><ChevronRight size={18} /></button>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Product Detail Modal */}
      {selectedProduct && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setSelectedProduct(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-slate-200">
              <h3 className="text-lg font-bold text-slate-900">{selectedProduct.name}</h3>
              <button onClick={() => setSelectedProduct(null)} className="p-1 hover:bg-slate-100 rounded-lg"><X size={20} /></button>
            </div>
            <div className="p-6">
              <div className="grid md:grid-cols-2 gap-6">
                <div className="aspect-square bg-slate-100 rounded-xl flex items-center justify-center p-6">
                  {selectedProduct.images?.length > 0 ? (
                    <img src={selectedProduct.images[0].url} alt={selectedProduct.name} className="max-h-full max-w-full object-contain" />
                  ) : (
                    <Package size={80} className="text-gray-300" />
                  )}
                </div>
                <div>
                  <p className="text-xs text-slate-400 font-mono mb-1">{selectedProduct.code}</p>
                  <p className="text-sm text-slate-500 mb-3">{selectedProduct.categoryName}</p>
                  <div className="mb-4">
                    {hasRealDiscount(selectedProduct) ? (
                      <div>
                        <span className="text-sm line-through text-slate-400">{fmt(selectedProduct.price)}</span>
                        <span className="ml-2 text-2xl font-bold text-green-600">{fmt(selectedProduct.discountedPrice ?? selectedProduct.price)}</span>
                        <span className="ml-2 bg-red-100 text-red-600 px-2 py-1 rounded text-sm font-medium">-{selectedProduct.discount}%</span>
                      </div>
                    ) : (
                      <span className="text-2xl font-bold text-slate-800">{fmt(selectedProduct.price)}</span>
                    )}
                  </div>
                  {selectedProduct.description && <p className="text-sm text-slate-600 mb-3">{selectedProduct.description}</p>}
                  {selectedProduct.characteristics && (
                    <div className="mb-3">
                      <p className="text-xs font-medium text-slate-500 uppercase mb-1">{t('catalog.characteristics')}</p>
                      <p className="text-sm text-slate-600">{selectedProduct.characteristics}</p>
                    </div>
                  )}
                  {selectedProduct.features && selectedProduct.features.length > 0 && (
                    <div className="mb-4">
                      <p className="text-xs font-medium text-slate-500 uppercase mb-1">{t('catalog.features')}</p>
                      <div className="flex flex-wrap gap-1.5">
                        {selectedProduct.features.map((f, i) => (
                          <span key={i} className="px-2 py-1 bg-slate-100 text-slate-600 rounded text-xs">{f}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="mt-4 p-3 bg-slate-50 rounded-xl">
                    <p className="text-xs font-medium text-slate-500 uppercase mb-2">{t('catalog.warehouse')}</p>
                    {getPositiveWarehouseEntries(selectedProduct.warehouseStock).length > 0 ? (
                      <div className="space-y-1">
                        {getPositiveWarehouseEntries(selectedProduct.warehouseStock).map(([wh, qty]) => (
                          <div key={wh} className="flex justify-between text-sm">
                            <span className="text-slate-600">{wh}</span>
                            <span className="font-medium text-slate-800">{qty} {t('common.item')}</span>
                          </div>
                        ))}
                        <div className="flex justify-between text-sm border-t border-slate-200 pt-1 mt-1">
                          <span className="text-slate-500 font-medium">{t('common.total')}</span>
                          <span className="font-bold text-slate-800">{selectedProduct.stockQuantity ?? 0} pcs</span>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-slate-700 font-medium">{selectedProduct.stockQuantity ?? '—'} {t('common.item')}</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}


    </div>
  );
}

function getPositiveWarehouseEntries(warehouseStock?: Record<string, number>) {
  if (!warehouseStock) return [];
  return Object.entries(warehouseStock).filter(([, qty]) => Number(qty) > 0);
}

function Package({ size, className }: { size: number; className: string }) {
  return (
    <svg width={size} height={size} className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m7.5 4.27 9 5.15" /><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
      <path d="m3.3 7 8.7 5 8.7-5" /><path d="M12 22V12" />
    </svg>
  );
}
