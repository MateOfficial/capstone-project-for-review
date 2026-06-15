import { useEffect, useRef, useState } from 'react';
import api from '../../lib/api';
import toast from 'react-hot-toast';
import { Upload, RefreshCw, AlertTriangle, Zap, Copy, Key, Wifi, FileSpreadsheet, CheckSquare, Square } from 'lucide-react';

type PageTab = 'import' | 'auto';

interface SyncSettings {
  syncApiKey: string | null;
  syncEnabled: boolean;
  lastSyncAt: string | null;
  lastSyncCount: number;
}

interface NotFoundRow {
  code: string;
  icName: string;
}

interface NameChangeRow {
  productId: number;
  currentName: string;
  icName: string;
  code: string;
}

interface ImportResult {
  updated: number;
  notFound: NotFoundRow[];
  nameChanges: NameChangeRow[];
}

interface PreflightResult {
  stockRows: number;
  priceRows: number;
  joinedCodes: number;
  stockOnly: number;
  priceOnly: number;
  warehouseCount: number;
  warehouseNames: string[];
}

export default function IntegrationMappingPage() {
  const stockFileRef = useRef<HTMLInputElement>(null);
  const priceFileRef = useRef<HTMLInputElement>(null);

  const [tab, setTab] = useState<PageTab>('import');

  // Two-file import state
  const [stockFile, setStockFile] = useState<File | null>(null);
  const [priceFile, setPriceFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [preflighting, setPreflighting] = useState(false);
  const [preflightResult, setPreflightResult] = useState<PreflightResult | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [selectedNames, setSelectedNames] = useState<Set<number>>(new Set());
  const [applyingNames, setApplyingNames] = useState(false);

  // Auto-sync state
  const [settings, setSettings] = useState<SyncSettings | null>(null);
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [keyHidden, setKeyHidden] = useState(true);

  const serverBase = `${window.location.protocol}//${window.location.hostname}:8080`;

  useEffect(() => {
    if (tab === 'auto' && !settings) loadSettings();
  }, [tab]);

  const loadSettings = async () => {
    setSettingsLoading(true);
    try {
      const res = await api.get('/admin/integrations/1c/settings');
      setSettings(res.data?.data ?? null);
    } catch {
      toast.error('Failed to load settings');
    } finally {
      setSettingsLoading(false);
    }
  };

  const regenerateKey = async () => {
    if (!confirm('The old key will stop working. Continue?')) return;
    try {
      const res = await api.post('/admin/integrations/1c/settings/regenerate-key');
      setSettings(res.data?.data ?? null);
      toast.success('New key created');
    } catch {
      toast.error('Error');
    }
  };

  const copyText = (text: string, label: string) => {
    navigator.clipboard.writeText(text).then(() => toast.success(`${label} copied`));
  };

  // ── Import logic ─────────────────────────────────────────────

  const handleImport = async () => {
    if (!stockFile || !priceFile) {
      toast.error('Upload both files: stock and prices');
      return;
    }
    setImporting(true);
    setImportResult(null);
    try {
      const fd = new FormData();
      fd.append('stockFile', stockFile);
      fd.append('priceFile', priceFile);
      const res = await api.post('/admin/integrations/1c/import', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const data: ImportResult = res.data?.data;
      setImportResult(data);
      // Pre-select all name changes
      setSelectedNames(new Set(data.nameChanges.map(nc => nc.productId)));
      if (data.updated > 0) {
        toast.success(`Updated ${data.updated} products`);
      } else {
        toast.error('No products updated — check SKUs');
      }
    } catch (err: unknown) {
      const axiosErr = err as {
        response?: { status?: number; data?: { message?: string; error?: { message?: string; code?: string } } };
        message?: string;
      };
      const status = axiosErr?.response?.status;
      const msg = axiosErr?.response?.data?.error?.message || axiosErr?.response?.data?.message || axiosErr?.message || 'Unknown error';
      if (status === 401) {
        toast.error('Session expired — sign in again');
      } else if (status === 413) {
        toast.error('File too large (>50MB)');
      } else {
        toast.error(`Import error (${status ?? 'network'}): ${msg}`);
      }
    } finally {
      setImporting(false);
    }
  };

  const handlePreflight = async () => {
    if (!stockFile || !priceFile) {
      toast.error('Upload both files: stock and prices');
      return;
    }
    setPreflighting(true);
    setPreflightResult(null);
    try {
      const fd = new FormData();
      fd.append('stockFile', stockFile);
      fd.append('priceFile', priceFile);
      const res = await api.post('/admin/integrations/1c/import/preflight', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const data: PreflightResult = res.data?.data;
      setPreflightResult(data);
      toast.success('File check completed');
    } catch (err: unknown) {
      const axiosErr = err as {
        response?: { status?: number; data?: { message?: string; error?: { message?: string } } };
        message?: string;
      };
      const msg = axiosErr?.response?.data?.error?.message || axiosErr?.response?.data?.message || axiosErr?.message || 'Unknown error';
      toast.error(`Check failed: ${msg}`);
    } finally {
      setPreflighting(false);
    }
  };

  const toggleName = (productId: number) => {
    setSelectedNames(prev => {
      const next = new Set(prev);
      if (next.has(productId)) next.delete(productId);
      else next.add(productId);
      return next;
    });
  };

  const toggleAllNames = () => {
    if (!importResult) return;
    if (selectedNames.size === importResult.nameChanges.length) {
      setSelectedNames(new Set());
    } else {
      setSelectedNames(new Set(importResult.nameChanges.map(nc => nc.productId)));
    }
  };

  const handleApplyNames = async () => {
    if (!importResult || selectedNames.size === 0) return;
    setApplyingNames(true);
    try {
      const items = importResult.nameChanges
        .filter(nc => selectedNames.has(nc.productId))
        .map(nc => ({ productId: nc.productId, newName: nc.icName }));
      const res = await api.post('/admin/integrations/1c/apply-names', items);
      const applied = res.data?.data?.applied ?? 0;
      toast.success(`Names updated: ${applied}`);
      setImportResult(prev => prev
        ? { ...prev, nameChanges: prev.nameChanges.filter(nc => !selectedNames.has(nc.productId)) }
        : null);
      setSelectedNames(new Set());
    } catch {
      toast.error('Failed to update names');
    } finally {
      setApplyingNames(false);
    }
  };

  // ── Render ───────────────────────────────────────────────────

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-bold text-slate-900">1C integration</h2>
        <p className="text-sm text-slate-500 mt-0.5">Upload stock and prices, automatic sync</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-slate-100 rounded-xl p-1 w-fit">
        <button onClick={() => setTab('import')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            tab === 'import' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
          }`}>
          <Upload size={14} /> File upload
        </button>
        <button onClick={() => setTab('auto')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            tab === 'auto' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
          }`}>
          <Zap size={14} /> Auto sync
        </button>
      </div>

      {/* ── IMPORT TAB ── */}
      {tab === 'import' && (
        <div className="space-y-6">
          {/* File upload zone */}
          <div className="grid grid-cols-2 gap-4">
            {/* Stock file */}
            <div
              onClick={() => stockFileRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${
                stockFile
                  ? 'border-teal-400 bg-teal-50/40'
                  : 'border-slate-300 hover:border-teal-400 hover:bg-teal-50/20'
              }`}
            >
              <input
                ref={stockFileRef}
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) setStockFile(f); e.target.value = ''; }}
              />
              <FileSpreadsheet size={28} className={`mx-auto mb-2 ${stockFile ? 'text-teal-600' : 'text-slate-400'}`} />
              <p className="font-semibold text-slate-700 text-sm">
                {stockFile ? stockFile.name : 'Stock file'}
              </p>
              <p className="text-xs text-slate-400 mt-1">
                stock.xlsx — Barcode, SKU, Quantity
              </p>
              {stockFile && (
                <button
                  onClick={e => { e.stopPropagation(); setStockFile(null); }}
                  className="mt-2 text-xs text-red-500 hover:text-red-700"
                >
                  Remove file
                </button>
              )}
            </div>

            {/* Price file */}
            <div
              onClick={() => priceFileRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${
                priceFile
                  ? 'border-teal-400 bg-teal-50/40'
                  : 'border-slate-300 hover:border-teal-400 hover:bg-teal-50/20'
              }`}
            >
              <input
                ref={priceFileRef}
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) setPriceFile(f); e.target.value = ''; }}
              />
              <FileSpreadsheet size={28} className={`mx-auto mb-2 ${priceFile ? 'text-teal-600' : 'text-slate-400'}`} />
              <p className="font-semibold text-slate-700 text-sm">
                {priceFile ? priceFile.name : 'Price file'}
              </p>
              <p className="text-xs text-slate-400 mt-1">
                prices.xls — SKU, Name, Price
              </p>
              {priceFile && (
                <button
                  onClick={e => { e.stopPropagation(); setPriceFile(null); }}
                  className="mt-2 text-xs text-red-500 hover:text-red-700"
                >
                  Remove file
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={handlePreflight}
              disabled={preflighting || importing || !stockFile || !priceFile}
              className="w-full flex items-center justify-center gap-2 py-3 border border-teal-700 text-teal-700 rounded-xl font-medium text-sm hover:bg-teal-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {preflighting
                ? <><RefreshCw size={16} className="animate-spin" /> Checking...</>
                : <><FileSpreadsheet size={16} /> Check files</>
              }
            </button>
            <button
              onClick={handleImport}
              disabled={importing || preflighting || !stockFile || !priceFile}
              className="w-full flex items-center justify-center gap-2 py-3 bg-teal-700 text-white rounded-xl font-medium text-sm hover:bg-teal-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-sm"
            >
              {importing
                ? <><RefreshCw size={16} className="animate-spin" /> Importing...</>
                : <><Upload size={16} /> Upload and update products</>
              }
            </button>
          </div>

          {preflightResult && (
            <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/60">
              <p className="text-sm font-semibold text-slate-800 mb-3">Preflight check</p>
              <div className="grid grid-cols-3 gap-3 text-sm">
                <div className="rounded-lg border border-slate-200 bg-white p-3">
                  <p className="text-slate-500 text-xs">Stock rows</p>
                  <p className="font-bold text-slate-800">{preflightResult.stockRows}</p>
                </div>
                <div className="rounded-lg border border-slate-200 bg-white p-3">
                  <p className="text-slate-500 text-xs">Price rows</p>
                  <p className="font-bold text-slate-800">{preflightResult.priceRows}</p>
                </div>
                <div className="rounded-lg border border-slate-200 bg-white p-3">
                  <p className="text-slate-500 text-xs">Unique SKUs</p>
                  <p className="font-bold text-slate-800">{preflightResult.joinedCodes}</p>
                </div>
                <div className="rounded-lg border border-slate-200 bg-white p-3">
                  <p className="text-slate-500 text-xs">Stock file only</p>
                  <p className="font-bold text-amber-600">{preflightResult.stockOnly}</p>
                </div>
                <div className="rounded-lg border border-slate-200 bg-white p-3">
                  <p className="text-slate-500 text-xs">Price file only</p>
                  <p className="font-bold text-amber-600">{preflightResult.priceOnly}</p>
                </div>
                <div className="rounded-lg border border-slate-200 bg-white p-3">
                  <p className="text-slate-500 text-xs">Warehouses in file</p>
                  <p className="font-bold text-slate-800">{preflightResult.warehouseCount}</p>
                </div>
              </div>
              {preflightResult.warehouseNames?.length > 0 && (
                <p className="text-xs text-slate-500 mt-3">Warehouses: {preflightResult.warehouseNames.join(', ')}</p>
              )}
            </div>
          )}

          {/* Results */}
          {importResult && (
            <div className="space-y-5">
              {/* Summary */}
              <div className="grid grid-cols-3 gap-4">
                <div className="border border-slate-200 rounded-xl p-4 bg-green-50/50">
                  <p className="text-xs text-slate-500 mb-1">Products updated</p>
                  <p className="text-3xl font-bold text-green-700">{importResult.updated}</p>
                </div>
                <div className="border border-slate-200 rounded-xl p-4">
                  <p className="text-xs text-slate-500 mb-1">Not found</p>
                  <p className="text-3xl font-bold text-amber-600">{importResult.notFound.length}</p>
                </div>
                <div className="border border-slate-200 rounded-xl p-4">
                  <p className="text-xs text-slate-500 mb-1">Name mismatches</p>
                  <p className="text-3xl font-bold text-slate-700">{importResult.nameChanges.length}</p>
                </div>
              </div>

              {/* Not found */}
              {importResult.notFound.length > 0 && (
                <div className="border border-amber-200 rounded-xl overflow-hidden">
                  <div className="bg-amber-50 px-4 py-3 flex items-center gap-2">
                    <AlertTriangle size={15} className="text-amber-600" />
                    <span className="text-sm font-semibold text-amber-800">
                      Not found in database ({importResult.notFound.length})
                    </span>
                    <span className="text-xs text-amber-600">— 1C SKUs with no match in the system</span>
                  </div>
                  <div className="max-h-60 overflow-y-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-amber-100 bg-amber-50/60">
                          <th className="px-4 py-2 text-left text-xs font-medium text-amber-700">SKU</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-amber-700">Name in 1C</th>
                        </tr>
                      </thead>
                      <tbody>
                        {importResult.notFound.map((row, i) => (
                          <tr key={i} className="border-b border-amber-50 hover:bg-amber-50/30">
                            <td className="px-4 py-2 font-mono text-xs text-slate-600">{row.code}</td>
                            <td className="px-4 py-2 text-slate-700">{row.icName}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Name changes */}
              {importResult.nameChanges.length > 0 && (
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <div className="bg-slate-50 px-4 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-slate-800">
                        Name normalization ({importResult.nameChanges.length})
                      </span>
                      <span className="text-xs text-slate-500">— 1C name differs from system</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <button onClick={toggleAllNames} className="text-xs text-teal-700 hover:text-teal-900 flex items-center gap-1">
                        {selectedNames.size === importResult.nameChanges.length
                          ? <><CheckSquare size={13} /> Deselect all</>
                          : <><Square size={13} /> Select all</>
                        }
                      </button>
                      <button
                        onClick={handleApplyNames}
                        disabled={applyingNames || selectedNames.size === 0}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-teal-700 text-white rounded-lg text-xs font-medium hover:bg-teal-800 disabled:opacity-40"
                      >
                        {applyingNames
                          ? <><RefreshCw size={12} className="animate-spin" /> Applying...</>
                          : <>Apply selected ({selectedNames.size})</>
                        }
                      </button>
                    </div>
                  </div>
                  <div className="max-h-96 overflow-y-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-100 bg-slate-50/60">
                          <th className="px-3 py-2 w-8"></th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-slate-600">SKU</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-slate-600">Current name (in system)</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-slate-600">Name from 1C</th>
                        </tr>
                      </thead>
                      <tbody>
                        {importResult.nameChanges.map((nc, i) => (
                          <tr
                            key={i}
                            onClick={() => toggleName(nc.productId)}
                            className={`border-b border-slate-50 cursor-pointer transition-colors ${
                              selectedNames.has(nc.productId) ? 'bg-teal-50/40' : 'hover:bg-slate-50'
                            }`}
                          >
                            <td className="px-3 py-3 text-center">
                              {selectedNames.has(nc.productId)
                                ? <CheckSquare size={15} className="text-teal-600 mx-auto" />
                                : <Square size={15} className="text-slate-300 mx-auto" />
                              }
                            </td>
                            <td className="px-4 py-3 font-mono text-xs text-slate-500">{nc.code}</td>
                            <td className="px-4 py-3 text-slate-500 text-xs">{nc.currentName}</td>
                            <td className="px-4 py-3 text-slate-800 font-medium text-xs">{nc.icName}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── AUTO SYNC TAB ── */}
      {tab === 'auto' && (
        <div className="space-y-6">
          {settingsLoading ? (
            <div className="flex items-center gap-3 py-12 text-teal-700 justify-center">
              <RefreshCw size={20} className="animate-spin" /> Loading...
            </div>
          ) : settings && (
            <>
              {/* Status card */}
              <div className="grid grid-cols-3 gap-4">
                <div className="border border-slate-200 rounded-xl p-4">
                  <p className="text-xs text-slate-500 mb-1">Status</p>
                  <div className="flex items-center gap-2">
                    <Wifi size={16} className="text-green-500" />
                    <span className="text-sm font-medium text-slate-800">Ready to receive</span>
                  </div>
                </div>
                <div className="border border-slate-200 rounded-xl p-4">
                  <p className="text-xs text-slate-500 mb-1">Last sync</p>
                  <p className="text-sm font-medium text-slate-800">
                    {settings.lastSyncAt
                      ? new Date(settings.lastSyncAt).toLocaleString('en-US')
                      : 'Never'}
                  </p>
                </div>
                <div className="border border-slate-200 rounded-xl p-4">
                  <p className="text-xs text-slate-500 mb-1">Products updated</p>
                  <p className="text-2xl font-bold text-teal-700">{settings.lastSyncCount}</p>
                </div>
              </div>

              {/* Endpoint URL */}
              <div className="border border-slate-200 rounded-xl p-5 space-y-4">
                <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                  <Wifi size={16} className="text-teal-600" /> Endpoint URL
                </h3>
                <div className="flex items-center gap-2">
                  <code className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono text-slate-700 break-all">
                    POST {serverBase}/api/integration/1c/sync
                  </code>
                  <button
                    onClick={() => copyText(`${serverBase}/api/integration/1c/sync`, 'URL')}
                    className="flex-shrink-0 p-2 rounded-lg border border-slate-200 hover:bg-slate-100">
                    <Copy size={15} />
                  </button>
                </div>
              </div>

              {/* API Key */}
              <div className="border border-slate-200 rounded-xl p-5 space-y-4">
                <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                  <Key size={16} className="text-teal-600" /> API key
                </h3>
                <div className="flex items-center gap-2">
                  <code className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono text-slate-700 tracking-wider">
                    {keyHidden ? '•'.repeat(32) : settings.syncApiKey}
                  </code>
                  <button onClick={() => setKeyHidden(h => !h)}
                    className="flex-shrink-0 px-3 py-2 rounded-lg border border-slate-200 hover:bg-slate-100 text-xs text-slate-600">
                    {keyHidden ? 'Show' : 'Hide'}
                  </button>
                  <button onClick={() => copyText(settings.syncApiKey!, 'Key')}
                    className="flex-shrink-0 p-2 rounded-lg border border-slate-200 hover:bg-slate-100">
                    <Copy size={15} />
                  </button>
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-xs text-slate-400">Send the key in header <code className="bg-slate-100 px-1 rounded">X-Api-Key</code></p>
                  <button onClick={regenerateKey}
                    className="flex items-center gap-1.5 text-xs text-red-600 hover:text-red-800">
                    <RefreshCw size={12} /> Generate new
                  </button>
                </div>
              </div>

              {/* curl example */}
              <div className="border border-slate-200 rounded-xl p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-slate-800">Sample request (curl)</h3>
                  <button
                    onClick={() => copyText(
                      `curl -X POST ${serverBase}/api/integration/1c/sync \\\n  -H "X-Api-Key: ${settings.syncApiKey}" \\\n  -H "Content-Type: application/json" \\\n  -d '[{"sku":"KLA-001","quantity":5}]'`,
                      'Command'
                    )}
                    className="flex items-center gap-1.5 text-xs text-teal-700 hover:text-teal-900">
                    <Copy size={12} /> Copy
                  </button>
                </div>
                <pre className="bg-slate-900 text-green-400 rounded-xl p-4 text-xs font-mono overflow-x-auto whitespace-pre-wrap">
{`curl -X POST ${serverBase}/api/integration/1c/sync \\
  -H "X-Api-Key: ${keyHidden ? '•••••••••••••••••' : settings.syncApiKey}" \\
  -H "Content-Type: application/json" \\
  -d '[{"sku":"KLA-001","quantity":5}]'`}
                </pre>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
        