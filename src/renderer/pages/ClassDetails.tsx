import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  classes,
  subscribers,
  subscriptions,
} from '../../shared/utils/electron-api';

/* ============================
   Types
   ============================ */
type ClassDetailsType = {
  id: number;
  name: string;
  description?: string;
  schedule?: string;
  status: 'active' | 'inactive' | 'full';
  start_date: string;
  end_date?: string;
  created_at: string;
};

type SubscriberRow = {
  id: number;
  name: string;
  id_number: string;
  phone?: string;
};

/* ============================
   Helpers
   ============================ */
const todayISO = () => new Date().toISOString().split('T')[0];
const yesterdayISO = () => {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().split('T')[0];
};

type UISchedule = {
  days: string[];
  startTime: string;
  endTime: string;
  instructor?: string;
};

const ALL_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function parseSchedule(raw?: string): UISchedule {
  if (!raw)
    return { days: [], startTime: '', endTime: '', instructor: '' };
  try {
    const obj = JSON.parse(raw);
    return {
      days: Array.isArray(obj?.days) ? obj.days : [],
      startTime: obj?.startTime || '',
      endTime: obj?.endTime || '',
      instructor: obj?.instructor || '',
    };
  } catch {
    return { days: [], startTime: '', endTime: '', instructor: '' };
  }
}

function serializeSchedule(ui: UISchedule): string {
  return JSON.stringify(ui);
}

function formatSchedule(ui: UISchedule): string {
  if (!ui.days.length) return '—';
  const time =
    ui.startTime && ui.endTime
      ? `${ui.startTime} → ${ui.endTime}`
      : '';
  return `${ui.days.join(', ')} ${time}`.trim();
}

/* ============================
   Component
   ============================ */
const ClassDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [data, setData] = useState<ClassDetailsType | null>(null);
  const [subs, setSubs] = useState<SubscriberRow[]>([]);
  const [allSubs, setAllSubs] = useState<SubscriberRow[]>([]);
  const [loading, setLoading] = useState(true);

  /* Add subscriber search */
  const [search, setSearch] = useState('');
  const [addingSubId, setAddingSubId] = useState<number | null>(null);

  /* Edit modal */
  const [editOpen, setEditOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<any>(null);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function load() {
    if (!id) return;

    const cls = await classes.getById(Number(id));
    setData(cls.data || null);

    const subRes = await subscriptions.listForClassOnDate(
      Number(id),
      todayISO()
    );
    setSubs(subRes.data || []);

    const all = await subscribers.get();
    setAllSubs(all.data || []);

    setLoading(false);
  }

  /* ============================
     Autocomplete (senior UX)
     - shows results as you type
     - no select dropdown
     ============================ */
  const filteredSubs = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [];

    const alreadyInClass = new Set(subs.map((s) => s.id));

    return allSubs
      .filter((s) => {
        if (alreadyInClass.has(s.id)) return false;

        const name = s.name?.toLowerCase() || '';
        const idn = s.id_number?.toLowerCase() || '';
        const phone = s.phone?.toLowerCase() || '';

        // Expectations for admin search:
        // - name contains
        // - id_number exact or prefix
        // - phone prefix or contains (some users paste full numbers)
        return (
          name.includes(q) ||
          idn === q ||
          idn.startsWith(q) ||
          phone.startsWith(q) ||
          phone.includes(q)
        );
      })
      .slice(0, 12);
  }, [search, allSubs, subs]);

  async function addSubscriber(subscriberId: number) {
    if (!id) return;

    try {
      setAddingSubId(subscriberId);
      await subscriptions.add(subscriberId, Number(id));
      setSearch('');
      await load();
    } finally {
      setAddingSubId(null);
    }
  }

  async function removeSubscriber(subscriberId: number) {
    if (!id) return;
    if (!window.confirm('Remove subscriber starting today?')) return;

    await subscriptions.end(subscriberId, Number(id), yesterdayISO());
    await load();
  }

  async function handleDelete() {
    if (!data) return;
    if (!window.confirm(`Delete class "${data.name}"?`)) return;
    await classes.delete(data.id);
    navigate('/classes');
  }

  function openEdit() {
    if (!data) return;
    setForm({
      name: data.name,
      description: data.description || '',
      status: data.status,
      start_date: data.start_date,
      end_date: data.end_date || '',
      schedule: parseSchedule(data.schedule),
    });
    setEditOpen(true);
  }

  async function saveEdit() {
    if (!data || !form) return;

    const patch: any = {};

    if (form.name !== data.name) patch.name = form.name;
    if ((form.description || '') !== (data.description || ''))
      patch.description = form.description || null;
    if (form.status !== data.status) patch.status = form.status;
    if (form.start_date !== data.start_date) patch.start_date = form.start_date;
    if ((form.end_date || '') !== (data.end_date || ''))
      patch.end_date = form.end_date || null;

    const currentSchedule = parseSchedule(data.schedule);
    if (JSON.stringify(form.schedule) !== JSON.stringify(currentSchedule)) {
      patch.schedule = serializeSchedule(form.schedule);
    }

    if (!Object.keys(patch).length) {
      setEditOpen(false);
      return;
    }

    setSaving(true);
    await classes.update(data.id, patch);
    await load();
    setEditOpen(false);
    setSaving(false);
  }

  if (loading || !data) return <div>Loading…</div>;

  const scheduleUI = parseSchedule(data.schedule);

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold">{data.name}</h1>
        <div className="flex gap-2">
          <button
            onClick={openEdit}
            className="px-4 py-2 bg-gray-800 text-white rounded"
          >
            Edit Class
          </button>
          <Link
            to={`/classes/${data.id}/attendance`}
            className="px-4 py-2 bg-blue-600 text-white rounded"
          >
            View Attendance
          </Link>
          <button
            onClick={handleDelete}
            className="px-4 py-2 bg-red-600 text-white rounded"
          >
            Delete
          </button>
        </div>
      </div>

      {/* Class Information */}
      <div className="bg-white border rounded p-4 space-y-2">
        <h2 className="font-semibold">Class Information</h2>

        <div><strong>Status:</strong> {data.status}</div>
        <div><strong>Start Date:</strong> {data.start_date}</div>
        <div><strong>End Date:</strong> {data.end_date || '—'}</div>
        <div>
          <strong>Created At:</strong>{' '}
          {new Date(data.created_at).toLocaleString()}
        </div>

        <hr />

        <div><strong>Description:</strong> {data.description || '—'}</div>
        <div><strong>Instructor:</strong> {scheduleUI.instructor || '—'}</div>
        <div><strong>Schedule:</strong> {formatSchedule(scheduleUI)}</div>
      </div>

      {/* Subscribers */}
      <div className="bg-white border rounded p-4 space-y-3">
        <h2 className="font-semibold">Subscribers</h2>

        {subs.length === 0 && (
          <div className="text-sm text-gray-500">
            No subscribers assigned to this class.
          </div>
        )}

        {subs.map((s) => (
          <div key={s.id} className="flex justify-between border-b py-2 text-sm">
            <span>
              {s.name} — {s.id_number} {s.phone ? `— ${s.phone}` : ''}
            </span>
            <button
              onClick={() => removeSubscriber(s.id)}
              className="text-red-600 hover:underline"
            >
              Remove
            </button>
          </div>
        ))}

        {/* Autocomplete search */}
        <div className="pt-2">
          <input
            className="border rounded px-3 py-2 w-full"
            placeholder="Type name, ID number, or phone…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          {/* Results appear automatically while typing */}
          {search.trim() !== '' && (
            <div className="mt-2 border rounded bg-white overflow-hidden">
              {filteredSubs.length === 0 ? (
                <div className="px-3 py-2 text-sm text-gray-500">
                  No matching subscriber found.
                </div>
              ) : (
                filteredSubs.map((s) => (
                  <div
                    key={s.id}
                    className="flex items-center justify-between px-3 py-2 text-sm border-t first:border-t-0 hover:bg-gray-50"
                  >
                    <div className="min-w-0">
                      <div className="font-medium truncate">{s.name}</div>
                      <div className="text-gray-500 truncate">
                        {s.id_number}
                        {s.phone ? ` — ${s.phone}` : ''}
                      </div>
                    </div>

                    <button
                      onClick={() => addSubscriber(s.id)}
                      disabled={addingSubId === s.id}
                      className="ml-3 px-3 py-1 rounded bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
                    >
                      {addingSubId === s.id ? 'Adding…' : 'Add'}
                    </button>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      <Link to="/classes" className="text-blue-600 hover:underline">
        ← Back to Classes
      </Link>

      {/* Edit Modal */}
      {editOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded p-6 w-full max-w-xl space-y-4">
            <h2 className="font-semibold">Edit Class</h2>

            <input
              className="border px-2 py-1 w-full"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />

            <textarea
              className="border px-2 py-1 w-full"
              value={form.description}
              onChange={(e) =>
                setForm({ ...form, description: e.target.value })
              }
            />

            <input
              className="border px-2 py-1 w-full"
              placeholder="Instructor / Trainer"
              value={form.schedule.instructor}
              onChange={(e) =>
                setForm({
                  ...form,
                  schedule: { ...form.schedule, instructor: e.target.value },
                })
              }
            />

            {/* Schedule */}
            <div>
              <div className="flex flex-wrap gap-2 mb-2">
                {ALL_DAYS.map((d) => (
                  <label key={d} className="text-xs flex gap-1">
                    <input
                      type="checkbox"
                      checked={form.schedule.days.includes(d)}
                      onChange={() =>
                        setForm({
                          ...form,
                          schedule: {
                            ...form.schedule,
                            days: form.schedule.days.includes(d)
                              ? form.schedule.days.filter(
                                  (x: string) => x !== d
                                )
                              : [...form.schedule.days, d],
                          },
                        })
                      }
                    />
                    {d}
                  </label>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-2">
                <input
                  type="time"
                  className="border px-2 py-1"
                  value={form.schedule.startTime}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      schedule: { ...form.schedule, startTime: e.target.value },
                    })
                  }
                />
                <input
                  type="time"
                  className="border px-2 py-1"
                  value={form.schedule.endTime}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      schedule: { ...form.schedule, endTime: e.target.value },
                    })
                  }
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3">
              <button onClick={() => setEditOpen(false)}>Cancel</button>
              <button
                onClick={saveEdit}
                disabled={saving}
                className="px-4 py-2 bg-blue-600 text-white rounded"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ClassDetails;
