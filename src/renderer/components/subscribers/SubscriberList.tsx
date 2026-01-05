// SubscriberList.tsx
// ============================================================
// COMPLETE FILE — SINGLE IMPORT BUTTON — SERVER PAGINATION + SEARCH
// (FIX: race-safe loading so search input never freezes)
// ============================================================

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  PlusIcon,
  TrashIcon,
  DownloadIcon,
  UploadIcon,
  Pencil2Icon,
} from '@radix-ui/react-icons';

import SubscriberForm from './SubscriberForm';
import { database, subscribers as subscribersApi } from '../../../shared/utils/electron-api';

/* ============================================================
   Types
   ============================================================ */

export interface Subscriber {
  id: number;
  subscriber_code?: string | null;
  name: string;
  phone?: string;
  email?: string;
  id_number: string;
  status: 'active' | 'inactive' | 'suspended' | string;
  address?: string;
  notes?: string;
  created_at?: string;
  updated_at?: string;
}

type SubscriberGetResult = {
  rows: Subscriber[];
  total: number;
};

/* ============================================================
   Helpers
   ============================================================ */

const unwrapRows = (res: any): Subscriber[] => {
  if (Array.isArray(res)) return res as Subscriber[];

  // Common IPC shapes we’ve used elsewhere:
  if (res?.success && Array.isArray(res.data)) return res.data as Subscriber[];
  if (res?.success && Array.isArray(res.data?.rows)) return res.data.rows as Subscriber[];

  // Defensive fallbacks
  if (Array.isArray(res?.data?.rows)) return res.data.rows as Subscriber[];

  return [];
};

const unwrapTotal = (res: any, fallbackRowsLen: number): number => {
  // Common shapes:
  if (typeof res?.total === 'number') return res.total;
  if (typeof res?.data?.total === 'number') return res.data.total;
  if (typeof res?.data?.count === 'number') return res.data.count;
  if (typeof res?.count === 'number') return res.count;

  // If backend doesn’t provide total yet, we fallback to rows length (won’t paginate correctly),
  // but this prevents crashes and preserves existing functionality.
  return fallbackRowsLen;
};

const statusBadgeClass = (status?: string) => {
  const s = (status || '').toLowerCase();
  if (s === 'active') return 'bg-green-100 text-green-700 border-green-200';
  if (s === 'inactive') return 'bg-gray-100 text-gray-700 border-gray-200';
  if (s === 'suspended') return 'bg-red-100 text-red-700 border-red-200';
  return 'bg-yellow-100 text-yellow-700 border-yellow-200';
};

/* ============================================================
   CSV IMPORT (simple + deterministic)
   ============================================================ */

const parseCSV = (text: string) => {
  const lines = text.replace(/\r/g, '').split('\n').filter(Boolean);
  if (!lines.length) return [];

  const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());
  const rows = lines.slice(1).map((line) => {
    const values = line.split(',');
    const obj: any = {};
    headers.forEach((h, i) => (obj[h] = (values[i] || '').trim()));
    return obj;
  });
  return rows;
};

/* ============================================================
   Pagination UI helper (compact)
   ============================================================ */

const buildPageItems = (current: number, totalPages: number) => {
  // For small counts, show all pages
  if (totalPages <= 9) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  // For large counts, show: 1 ... (current-2..current+2) ... last
  const items: (number | '...')[] = [];
  const clamp = (n: number) => Math.max(1, Math.min(totalPages, n));

  const start = clamp(current - 2);
  const end = clamp(current + 2);

  items.push(1);

  if (start > 2) items.push('...');

  for (let p = Math.max(2, start); p <= Math.min(totalPages - 1, end); p++) {
    items.push(p);
  }

  if (end < totalPages - 1) items.push('...');

  items.push(totalPages);

  // Remove duplicates (can happen near edges)
  const deduped: (number | '...')[] = [];
  for (const it of items) {
    if (deduped.length === 0 || deduped[deduped.length - 1] !== it) deduped.push(it);
  }
  return deduped;
};

/* ============================================================
   Component
   ============================================================ */

const SubscriberList: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  // Data
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [totalCount, setTotalCount] = useState(0);

  // UX state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form
  const [formOpen, setFormOpen] = useState(false);
  const [editingSubscriber, setEditingSubscriber] = useState<Subscriber | null>(null);

  // Import
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [importing, setImporting] = useState(false);

  // Pagination + Search
  const LIMIT = 50;
  const [page, setPage] = useState(1);

  // A single search string that queries: subscriber_code, name, id_number, phone
  const [search, setSearch] = useState('');
  const [searchDebounced, setSearchDebounced] = useState('');

  // FIX: request sequencing guard (prevents old responses overwriting new ones)
  const requestSeqRef = useRef(0);

  // Debounce typing (fast + avoids spamming IPC)
  useEffect(() => {
    const h = window.setTimeout(() => setSearchDebounced(search.trim()), 200);
    return () => window.clearTimeout(h);
  }, [search]);

  // Reset to page 1 whenever search changes (required behavior)
  useEffect(() => {
    setPage(1);
  }, [searchDebounced]);

  const totalPages = useMemo(() => {
    const tp = Math.max(1, Math.ceil((totalCount || 0) / LIMIT));
    return tp;
  }, [totalCount]);

  const pageItems = useMemo(() => buildPageItems(page, totalPages), [page, totalPages]);

  /* ============================================================
     Load (SERVER-DRIVEN)
     ============================================================ */

  const loadSubscribers = async (opts?: { page?: number; search?: string }) => {
    const targetPage = opts?.page ?? page;
    const q = (opts?.search ?? searchDebounced ?? '').trim();

    // Sequence id for this request
    const seq = ++requestSeqRef.current;

    setLoading(true);
    setError(null);

    try {
      // Filters must be passed to SQL on the backend. We send a single search term.
      // Backend must apply deterministic order: ORDER BY subscriber_code ASC (required).
      const filters: any = {};
      if (q.length > 0) filters.search = q;

      const res = await subscribersApi.get(filters, targetPage, LIMIT);

      // If a newer request started after this one, ignore this response completely.
      if (seq !== requestSeqRef.current) return;

      const rows = unwrapRows(res);
      const total = unwrapTotal(res, rows.length);

      setSubscribers(rows);
      setTotalCount(total);

      // Clamp page if backend total shrank (e.g., after delete with search active)
      const computedTotalPages = Math.max(1, Math.ceil((total || 0) / LIMIT));
      if (targetPage > computedTotalPages) {
        // Still only execute if we're the latest request
        setPage(computedTotalPages);
      }
    } catch (e: any) {
      if (seq !== requestSeqRef.current) return;
      setError(e?.message || 'Failed to load subscribers');
    } finally {
      if (seq !== requestSeqRef.current) return;
      setLoading(false);
    }
  };

  // Load on mount + whenever page/search changes
  useEffect(() => {
    loadSubscribers({ page, search: searchDebounced });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, searchDebounced]);

  /* ============================================================
     Actions
     ============================================================ */

  const deleteSubscriber = async (s: Subscriber) => {
    if (!confirm(`Delete subscriber "${s.name}"?`)) return;

    try {
      await subscribersApi.delete(s.id);
      // Refresh current page using server (keeps ordering + pagination correct)
      await loadSubscribers({ page, search: searchDebounced });
    } catch (e: any) {
      alert(e?.message || 'Delete failed');
    }
  };

  const exportCSV = async () => {
    // Export is not the primary objective, but keep deterministic ordering consistent.
    // This does not touch subscriber code generation or import logic.
    const res = await database.query(`SELECT * FROM subscribers ORDER BY subscriber_code ASC`);
    const rows = (Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : []) as any[];
    if (!rows.length) return;

    const headers = Object.keys(rows[0]).join(',');
    const body = rows
      .map((r: any) =>
        Object.values(r)
          .map((v) => `"${String(v ?? '').replaceAll('"', '""')}"`)
          .join(',')
      )
      .join('\n');

    const blob = new Blob([headers + '\n' + body], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = 'subscribers.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const triggerImport = () => {
    if (!importing) fileInputRef.current?.click();
  };

  const handleImport = async (file: File) => {
    setImporting(true);
    try {
      const text = await file.text();
      const rows = parseCSV(text);

      // Expected headers: name,id_number,phone,email,status
      const payload = rows
        .map((r: any) => ({
          name: r.name ?? r.full_name ?? '',
          id_number: r.id_number ?? '',
          phone: r.phone ?? null,
          email: r.email ?? null,
          status: r.status ?? 'active',
        }))
        .filter(
          (r) =>
            String(r.name || '').trim().length > 0 &&
            String(r.id_number || '').trim().length > 0
        );

      const res = await subscribersApi.import(payload);
      alert(
        `Import completed.\nInserted: ${res.inserted}\nSkipped: ${res.skipped}\nTotal: ${res.total}`
      );

      // After import, reload using server pagination/search (stays stable)
      await loadSubscribers({ page: 1, search: searchDebounced });
      setPage(1);
    } catch (e: any) {
      alert(e?.message || 'Import failed');
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const goToPage = (p: number) => {
    const next = Math.max(1, Math.min(totalPages, p));
    if (next === page) return;
    setPage(next);
  };

  /* ============================================================
     Render
     ============================================================ */

  return (
    <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv"
        hidden
        onChange={(e) => e.target.files && handleImport(e.target.files[0])}
      />

      <div className="flex justify-between items-start mb-4 gap-4">
        <div className="min-w-[240px]">
          <h2 className="text-xl font-bold">{t('subscribers.title') || 'Subscribers'}</h2>
          <div className="text-sm text-gray-500">
            {t('subscribers.total') || 'Total'}: {totalCount}
          </div>
          <div className="text-xs text-gray-400 mt-1">
            Page {page} / {totalPages} • {LIMIT} per page
          </div>
        </div>

        <div className="flex-1 flex items-center justify-center">
          <div className="w-full max-w-xl">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search code, name, ID number, phone…"
              className="w-full px-4 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-200"
            />
            {search.trim().length > 0 && (
              <div className="mt-1 text-xs text-gray-500 flex justify-between">
                <span>Filtering results…</span>
                <button
                  type="button"
                  className="text-blue-700 hover:underline"
                  onClick={() => setSearch('')}
                >
                  Clear
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={exportCSV}
            className="flex items-center gap-2 px-4 py-2 border rounded hover:bg-gray-50"
            title="Export CSV"
          >
            <DownloadIcon />
            Export CSV
          </button>

          <button
            onClick={triggerImport}
            disabled={importing}
            className="flex items-center gap-2 px-4 py-2 border rounded hover:bg-gray-50 disabled:opacity-60"
            title="Import CSV"
          >
            <UploadIcon />
            {importing ? 'Importing…' : 'Import CSV'}
          </button>

          <button
            onClick={() => {
              setEditingSubscriber(null);
              setFormOpen(true);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            <PlusIcon /> Add Subscriber
          </button>
        </div>
      </div>

      {error && <div className="text-red-600 mb-3">{error}</div>}

      <div className="overflow-x-auto">
        <table className="w-full border">
          <thead className="bg-gray-100">
            <tr className="text-left">
              <th className="p-2 border">Code</th>
              <th className="p-2 border">Name</th>
              <th className="p-2 border">ID Number</th>
              <th className="p-2 border">Status</th>
              <th className="p-2 border text-center w-28">Actions</th>
            </tr>
          </thead>

          <tbody>
            {subscribers.map((s) => (
              <tr key={s.id} className="hover:bg-gray-50">
                <td className="p-2 border font-mono text-sm">{s.subscriber_code || '—'}</td>

                <td className="p-2 border">
                  <button
                    onClick={() => navigate(`/subscribers/${s.id}`)}
                    className="text-blue-700 hover:underline font-medium text-left"
                  >
                    {s.name}
                  </button>
                </td>

                <td className="p-2 border">{s.id_number}</td>

                <td className="p-2 border">
                  <span
                    className={`inline-flex px-2 py-0.5 text-xs font-semibold border rounded ${statusBadgeClass(
                      String(s.status)
                    )}`}
                  >
                    {String(s.status)}
                  </span>
                </td>

                <td className="p-2 border text-center">
                  <button
                    onClick={() => {
                      setEditingSubscriber(s);
                      setFormOpen(true);
                    }}
                    className="p-2 rounded hover:bg-gray-100"
                    title="Edit"
                  >
                    <Pencil2Icon />
                  </button>

                  <button
                    onClick={() => deleteSubscriber(s)}
                    className="p-2 rounded hover:bg-red-50 text-red-600"
                    title="Delete"
                  >
                    <TrashIcon />
                  </button>
                </td>
              </tr>
            ))}

            {!loading && subscribers.length === 0 && (
              <tr>
                <td colSpan={5} className="p-6 text-center text-gray-500">
                  No subscribers
                </td>
              </tr>
            )}

            {loading && (
              <tr>
                <td colSpan={5} className="p-6 text-center text-gray-500">
                  Loading…
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="mt-4 flex items-center justify-between gap-3">
        <div className="text-sm text-gray-600">
          Showing page <span className="font-semibold">{page}</span> of{' '}
          <span className="font-semibold">{totalPages}</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            className="px-3 py-1 border rounded hover:bg-gray-50 disabled:opacity-50"
            disabled={page <= 1 || loading}
            onClick={() => goToPage(page - 1)}
            title="Previous"
          >
            Prev
          </button>

          <div className="flex items-center gap-1">
            {pageItems.map((it, idx) =>
              it === '...' ? (
                <span key={`ellipsis-${idx}`} className="px-2 text-gray-500">
                  …
                </span>
              ) : (
                <button
                  key={it}
                  className={`px-3 py-1 border rounded hover:bg-gray-50 ${
                    it === page ? 'bg-blue-600 text-white border-blue-600 hover:bg-blue-700' : ''
                  }`}
                  disabled={loading}
                  onClick={() => goToPage(it)}
                >
                  {it}
                </button>
              )
            )}
          </div>

          <button
            className="px-3 py-1 border rounded hover:bg-gray-50 disabled:opacity-50"
            disabled={page >= totalPages || loading}
            onClick={() => goToPage(page + 1)}
            title="Next"
          >
            Next
          </button>
        </div>
      </div>

      <SubscriberForm
        open={formOpen}
        onOpenChange={setFormOpen}
        subscriber={editingSubscriber}
        onSuccess={async () => {
          // After create/update, reload current server page deterministically
          await loadSubscribers({ page, search: searchDebounced });
        }}
      />
    </div>
  );
};

export default SubscriberList;
