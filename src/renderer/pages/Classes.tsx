import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { database, classes } from '../../shared/utils/electron-api';

/* ============================
   Types
   ============================ */
type ClassRow = {
  id: number;
  name: string;
  description?: string;
  status: 'active' | 'inactive' | 'full';
  created_at: string;
};

/* ============================
   Schedule (JSON)
   ============================ */
type UISchedule = {
  days: string[];
  startTime: string;
  endTime: string;
};

const ALL_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function buildSchedule(s: UISchedule): string | null {
  const hasData = s.days.length || s.startTime || s.endTime;
  if (!hasData) return null;

  return JSON.stringify({
    days: s.days,
    startTime: s.startTime,
    endTime: s.endTime,
  });
}

/* ============================
   Component
   ============================ */
const Classes: React.FC = () => {
  const [rows, setRows] = useState<ClassRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /* Create modal */
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);

  /* Form state */
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [schedule, setSchedule] = useState<UISchedule>({
    days: [],
    startTime: '',
    endTime: '',
  });

  useEffect(() => {
    load();
  }, []);

  async function load() {
    try {
      setLoading(true);
      setError(null);

      const res = await database.query(`
        SELECT
          id,
          name,
          description,
          status,
          created_at
        FROM classes
        ORDER BY created_at DESC
      `);

      setRows(res.data || []);
    } catch (e: any) {
      setError(e?.message || 'Failed to load classes');
    } finally {
      setLoading(false);
    }
  }

  function resetForm() {
    setName('');
    setDescription('');
    setSchedule({ days: [], startTime: '', endTime: '' });
  }

  async function createClass() {
    if (!name.trim()) return;

    try {
      setCreating(true);
      setError(null);

      await classes.create({
        name: name.trim(),
        description: description.trim() || null,
        status: 'active',
        schedule: buildSchedule(schedule),
      });

      resetForm();
      setOpen(false);
      await load();
    } catch (e: any) {
      setError(e?.message || 'Failed to create class');
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-semibold">Classes</h1>
          <p className="text-sm text-gray-500">
            Manage classes and attendance.
          </p>
        </div>

        <button
          onClick={() => setOpen(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded font-medium"
        >
          + New Class
        </button>
      </div>

      {loading && <div>Loading…</div>}
      {error && <div className="text-red-600">{error}</div>}

      {!loading && rows.length === 0 && (
        <div className="text-gray-500">No classes found.</div>
      )}

      {!loading && rows.length > 0 && (
        <div className="overflow-x-auto border rounded bg-white">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-100">
              <tr>
                <th className="px-3 py-2 text-left">#</th>
                <th className="px-3 py-2 text-left">Name</th>
                <th className="px-3 py-2 text-left">Description</th>
                <th className="px-3 py-2 text-left">Status</th>
                <th className="px-3 py-2 text-left">Created</th>
                <th className="px-3 py-2 text-left">Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.id} className="border-t">
                  <td className="px-3 py-2">{i + 1}</td>
                  <td className="px-3 py-2 font-medium">
                    <Link
                      to={`/classes/${r.id}`}
                      className="text-blue-700 hover:underline"
                    >
                      {r.name}
                    </Link>
                  </td>
                  <td className="px-3 py-2">{r.description || '—'}</td>
                  <td className="px-3 py-2">{r.status}</td>
                  <td className="px-3 py-2">
                    {new Date(r.created_at).toLocaleString()}
                  </td>
                  <td className="px-3 py-2">
                    <Link
                      to={`/classes/${r.id}/attendance`}
                      className="text-blue-600 hover:underline"
                    >
                      View Attendance
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create Class Modal */}
      {open && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-xl p-6 space-y-5">
            <h2 className="text-lg font-semibold">Create New Class</h2>

            <div>
              <label className="block text-sm font-medium">
                Class Name <span className="text-red-600">*</span>
              </label>
              <input
                className="border rounded px-3 py-2 w-full mt-1"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-sm font-medium">
                Description
              </label>
              <textarea
                className="border rounded px-3 py-2 w-full mt-1"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Schedule (optional)
              </label>

              <div className="flex flex-wrap gap-2 mb-3">
                {ALL_DAYS.map((d) => (
                  <label
                    key={d}
                    className="flex items-center gap-1 text-xs border rounded px-2 py-1"
                  >
                    <input
                      type="checkbox"
                      checked={schedule.days.includes(d)}
                      onChange={() =>
                        setSchedule((s) => ({
                          ...s,
                          days: s.days.includes(d)
                            ? s.days.filter((x) => x !== d)
                            : [...s.days, d],
                        }))
                      }
                    />
                    {d}
                  </label>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <input
                  type="time"
                  className="border rounded px-2 py-1"
                  value={schedule.startTime}
                  onChange={(e) =>
                    setSchedule((s) => ({
                      ...s,
                      startTime: e.target.value,
                    }))
                  }
                />
                <input
                  type="time"
                  className="border rounded px-2 py-1"
                  value={schedule.endTime}
                  onChange={(e) =>
                    setSchedule((s) => ({
                      ...s,
                      endTime: e.target.value,
                    }))
                  }
                />
              </div>

              <p className="text-xs text-gray-500 mt-2">
                Instructor can be assigned later from Class Details.
              </p>
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <button
                onClick={() => {
                  if (!creating) {
                    resetForm();
                    setOpen(false);
                  }
                }}
                className="px-4 py-2 rounded border text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={createClass}
                disabled={creating || !name.trim()}
                className="px-5 py-2 rounded bg-blue-600 text-white font-medium hover:bg-blue-700 disabled:opacity-50"
              >
                {creating ? 'Creating…' : 'Create Class'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Classes;
