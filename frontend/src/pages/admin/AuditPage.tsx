import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../../lib/api';
import type { ApiResponse, AuditLog, PageResponse } from '../../types';
import { Activity, Filter, RefreshCw, ShieldAlert, Wifi, PackageOpen } from 'lucide-react';

const actionLabels: Record<string, string> = {
  INTEGRATION_IMPORT_1C: '1C import',
  INTEGRATION_IMPORT_PREFLIGHT_1C: '1C file check',
};

const entityOptions = [
  { value: '', label: 'All entities' },
  { value: 'integration', label: 'Integrations' },
];

function formatAction(action: string) {
  return actionLabels[action] || action;
}

function formatDetails(details?: Record<string, unknown> | null) {
  if (!details) return '—';
  const parts: string[] = [];
  const updated = details.updated;
  const notFoundCount = details.notFoundCount;
  const nameChangesCount = details.nameChangesCount;
  const stockRows = details.stockRows;
  const priceRows = details.priceRows;
  const joinedCodes = details.joinedCodes;
  const stockOnly = details.stockOnly;
  const priceOnly = details.priceOnly;

  if (typeof updated === 'number') parts.push(`updated: ${updated}`);
  if (typeof notFoundCount === 'number') parts.push(`not found: ${notFoundCount}`);
  if (typeof nameChangesCount === 'number') parts.push(`names: ${nameChangesCount}`);
  if (typeof stockRows === 'number') parts.push(`stock: ${stockRows}`);
  if (typeof priceRows === 'number') parts.push(`prices: ${priceRows}`);
  if (typeof joinedCodes === 'number') parts.push(`SKUs: ${joinedCodes}`);
  if (typeof stockOnly === 'number') parts.push(`stock only: ${stockOnly}`);
  if (typeof priceOnly === 'number') parts.push(`prices only: ${priceOnly}`);

  if (parts.length > 0) return parts.join(' · ');
  return JSON.stringify(details);
}

export default function AuditPage() {
  const [entityType, setEntityType] = useState('');
  const [page, setPage] = useState(0);

  const { data, isLoading, isFetching, refetch, error } = useQuery({
    queryKey: ['audit-log', entityType, page],
    queryFn: () => api.get<ApiResponse<PageResponse<AuditLog>>>('/admin/audit', {
      params: { page, size: 25, ...(entityType ? { entityType } : {}) },
    }).then(r => r.data.data),
  });

  const items = data?.content ?? [];
  const importStats = useMemo(() => {
    const imports = items.filter(item => item.action === 'INTEGRATION_IMPORT_1C');
    const preflights = items.filter(item => item.action === 'INTEGRATION_IMPORT_PREFLIGHT_1C');
    const updated = imports.reduce((sum, item) => sum + Number(item.details?.updated ?? 0), 0);
    return { imports: imports.length, preflights: preflights.length, updated };
  }, [items]);

  return (
    <div className="sf-fade-in">
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">System audit</h2>
          <p className="text-sm text-slate-500 mt-1">Import and system action history for this store</p>
        </div>
        <button
          onClick={() => refetch()}
          className="flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-600 hover:bg-slate-50"
        >
          <RefreshCw size={15} className={isFetching ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-teal-50 text-teal-700"><Activity size={18} /></div>
            <div>
              <p className="text-2xl font-bold text-slate-900">{importStats.imports}</p>
              <p className="text-sm text-slate-500">Imports in current selection</p>
            </div>
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-50 text-blue-700"><Wifi size={18} /></div>
            <div>
              <p className="text-2xl font-bold text-slate-900">{importStats.preflights}</p>
              <p className="text-sm text-slate-500">File checks</p>
            </div>
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-green-50 text-green-700"><PackageOpen size={18} /></div>
            <div>
              <p className="text-2xl font-bold text-slate-900">{importStats.updated}</p>
              <p className="text-sm text-slate-500">Updated products</p>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
        <div className="flex items-center justify-between gap-4 px-4 py-3 border-b border-slate-200 bg-slate-50/70">
          <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
            <Filter size={14} /> Filter
          </div>
          <select
            value={entityType}
            onChange={(e) => { setEntityType(e.target.value); setPage(0); }}
            className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white text-slate-700"
          >
            {entityOptions.map(option => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </div>

        {isLoading ? (
          <div className="py-16 text-center text-slate-500">Loading...</div>
        ) : error ? (
          <div className="py-16 text-center text-red-600 flex items-center justify-center gap-2">
            <ShieldAlert size={16} /> Failed to load audit log
          </div>
        ) : items.length === 0 ? (
          <div className="py-16 text-center text-slate-500">No records yet</div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/60 text-slate-600">
                    <th className="px-4 py-3 text-left font-medium">Time</th>
                    <th className="px-4 py-3 text-left font-medium">Action</th>
                    <th className="px-4 py-3 text-left font-medium">User</th>
                    <th className="px-4 py-3 text-left font-medium">Entity</th>
                    <th className="px-4 py-3 text-left font-medium">Details</th>
                    <th className="px-4 py-3 text-left font-medium">IP</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.id} className="border-b border-slate-100 hover:bg-slate-50/50 align-top">
                      <td className="px-4 py-3 whitespace-nowrap text-slate-500">
                        {new Date(item.timestamp).toLocaleString('en-US')}
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-800">{formatAction(item.action)}</td>
                      <td className="px-4 py-3 text-slate-700">{item.username || 'system'}</td>
                      <td className="px-4 py-3 text-slate-500">{item.entityType || '—'}</td>
                      <td className="px-4 py-3 text-slate-600 max-w-xl">{formatDetails(item.details)}</td>
                      <td className="px-4 py-3 text-slate-400 whitespace-nowrap">{item.ipAddress || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 bg-slate-50/60">
              <p className="text-xs text-slate-500">
                Total records: {data?.totalElements ?? 0}
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={page === 0}
                  className="px-3 py-1.5 text-sm rounded-lg border border-slate-200 disabled:opacity-40 hover:bg-white"
                >
                  Back
                </button>
                <span className="text-sm text-slate-600">
                  {page + 1} / {Math.max(data?.totalPages ?? 1, 1)}
                </span>
                <button
                  onClick={() => setPage((p) => p + 1)}
                  disabled={data?.last ?? true}
                  className="px-3 py-1.5 text-sm rounded-lg border border-slate-200 disabled:opacity-40 hover:bg-white"
                >
                  Forward
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}