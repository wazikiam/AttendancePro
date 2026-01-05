import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { subscribers as subscribersAPI } from '../../shared/utils/electron-api';
import SubscriberForm from '../components/subscribers/SubscriberForm';

/* ============================================================
   Types
   ============================================================ */

type SubscriberRecord = {
  id: number;
  subscriber_code?: string;
  name?: string;
  id_number?: string;
  status?: 'active' | 'inactive' | 'suspended' | string;
  phone?: string;
  email?: string;
  address?: string;
  notes?: string;
  date_of_birth?: string;
  emergency_contact?: string;
  emergency_phone?: string;
  created_at?: string;
  updated_at?: string;
  photo_path?: string;
};

type DocumentFile = {
  name: string;
  path: string;
  size: number;
  modifiedAt: string;
};

/* ============================================================
   Helpers
   ============================================================ */

const fileUrl = (p?: string) =>
  p ? `file://${String(p).replace(/\\/g, '/')}` : '';

const formatBytes = (bytes: number) => {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let n = bytes;
  let i = 0;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i++;
  }
  return `${n.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
};

/* ============================================================
   Component
   ============================================================ */

const SubscriberDetailsPage: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams();

  const subscriberId = useMemo(() => Number(id), [id]);

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [subscriber, setSubscriber] = useState<SubscriberRecord | null>(null);

  const [docs, setDocs] = useState<DocumentFile[]>([]);
  const [docsLoading, setDocsLoading] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  /* ============================================================
     Load Subscriber (STRICT BY ID)
     ============================================================ */

  const loadSubscriber = async () => {
    if (!Number.isFinite(subscriberId) || subscriberId <= 0) {
      setError('Invalid subscriber ID');
      setSubscriber(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Prefer getById if the renderer API exposes it; otherwise fallback to list API.
      const apiAny = subscribersAPI as any;

      if (typeof apiAny.getById === 'function') {
        const res = await apiAny.getById(subscriberId);
        const row = res?.success ? res?.data : null;

        if (!row) {
          setError('Subscriber not found');
          setSubscriber(null);
          return;
        }

        setSubscriber(row as SubscriberRecord);
        return;
      }

      // Fallback path (now safe because backend getSubscribers supports filters.id)
      const res = await subscribersAPI.get({ id: subscriberId }, 1, 1);
      const rows = res?.success ? res?.data?.rows : null;

      if (!Array.isArray(rows) || rows.length === 0) {
        setError('Subscriber not found');
        setSubscriber(null);
        return;
      }

      setSubscriber(rows[0] as SubscriberRecord);
    } catch (e) {
      console.error(e);
      setError('Failed to load subscriber');
      setSubscriber(null);
    } finally {
      setLoading(false);
    }
  };

  /* ============================================================
     Load Documents
     ============================================================ */

  const loadDocuments = async () => {
    if (!subscriber) return;

    setDocsLoading(true);
    try {
      const res = await subscribersAPI.listDocuments(subscriber.id);
      setDocs(res?.success ? res.files || [] : []);
    } catch {
      setDocs([]);
    } finally {
      setDocsLoading(false);
    }
  };

  useEffect(() => {
    loadSubscriber();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subscriberId]);

  useEffect(() => {
    loadDocuments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subscriber?.id]);

  /* ============================================================
     Delete
     ============================================================ */

  const onDelete = async () => {
    if (!subscriber) return;

    const ok = confirm(`Delete subscriber "${subscriber.name}"?\nThis cannot be undone.`);
    if (!ok) return;

    setBusy(true);
    try {
      const res = await subscribersAPI.delete(subscriber.id);
      if (!res?.success) throw new Error(res?.message || 'Delete failed');

      navigate('/subscribers', { replace: true });
    } catch (e: any) {
      console.error(e);
      alert(e?.message || 'Delete failed');
    } finally {
      setBusy(false);
    }
  };

  const reveal = async (path: string) => {
    try {
      await subscribersAPI.revealInFolder(path);
    } catch (e) {
      console.error(e);
    }
  };

  /* ============================================================
     Render
     ============================================================ */

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Subscriber Details</h1>
        <div className="flex gap-2">
          <button onClick={() => navigate('/subscribers')} className="px-3 py-2 border rounded">
            Back
          </button>
          <button
            onClick={() => setEditOpen(true)}
            disabled={!subscriber || loading}
            className="px-3 py-2 bg-blue-600 text-white rounded"
          >
            Edit
          </button>
          <button
            onClick={onDelete}
            disabled={!subscriber || busy}
            className="px-3 py-2 bg-red-600 text-white rounded"
          >
            Delete
          </button>
        </div>
      </div>

      {loading && <div>Loading…</div>}
      {error && <div className="text-red-600">{error}</div>}

      {subscriber && !loading && (
        <>
          <div className="bg-white border rounded p-6 mb-6">
            <div className="text-xl font-semibold">{subscriber.name}</div>

            <div className="text-sm text-gray-600 mt-2 space-y-1">
              <div><strong>Subscriber Code:</strong> {subscriber.subscriber_code || '—'}</div>
              <div><strong>ID Number:</strong> {subscriber.id_number || '—'}</div>
              <div><strong>Status:</strong> {subscriber.status}</div>
              <div><strong>Date of Birth:</strong> {subscriber.date_of_birth || '—'}</div>
            </div>

            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div><strong>Phone:</strong> {subscriber.phone || '—'}</div>
              <div><strong>Email:</strong> {subscriber.email || '—'}</div>
              <div><strong>Address:</strong> {subscriber.address || '—'}</div>
              <div><strong>Notes:</strong> {subscriber.notes || '—'}</div>
            </div>
          </div>

          <div className="bg-white border rounded p-6 mb-6">
            <h2 className="font-semibold mb-3">Emergency Contact</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div><strong>Name:</strong> {subscriber.emergency_contact || '—'}</div>
              <div><strong>Phone:</strong> {subscriber.emergency_phone || '—'}</div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white border rounded p-6">
              <h2 className="font-semibold mb-3">Photo</h2>
              {subscriber.photo_path ? (
                <>
                  <img src={fileUrl(subscriber.photo_path)} className="w-40 h-40 object-cover rounded border" />
                  <button
                    onClick={() => reveal(subscriber.photo_path!)}
                    className="mt-2 px-3 py-1 border rounded"
                  >
                    Reveal
                  </button>
                </>
              ) : (
                <div className="text-gray-500">No photo</div>
              )}
            </div>

            <div className="bg-white border rounded p-6">
              <h2 className="font-semibold mb-3">Documents</h2>
              {docsLoading ? (
                <div>Loading…</div>
              ) : docs.length === 0 ? (
                <div className="text-gray-500">No documents</div>
              ) : (
                <div className="space-y-3">
                  {docs.map((d) => (
                    <div key={d.path} className="flex justify-between items-center border p-3 rounded">
                      <div>
                        <div className="font-medium">{d.name}</div>
                        <div className="text-xs text-gray-500">{formatBytes(d.size)}</div>
                      </div>
                      <button
                        onClick={() => reveal(d.path)}
                        className="px-3 py-1 border rounded"
                      >
                        Reveal
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <SubscriberForm
            open={editOpen}
            onOpenChange={setEditOpen}
            subscriber={subscriber}
            onSuccess={async () => {
              setEditOpen(false);
              await loadSubscriber();
            }}
          />
        </>
      )}
    </div>
  );
};

export default SubscriberDetailsPage;
