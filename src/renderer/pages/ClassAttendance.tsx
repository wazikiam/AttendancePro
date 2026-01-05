import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  attendance,
  subscriptions,
} from '../../shared/utils/electron-api';

type SubscriberRow = {
  id: number;
  name: string;
  id_number: string;
  subscription_id: number;
};

type AttendanceStatus =
  | 'present'
  | 'absent'
  | 'late'
  | 'excused'
  | 'holiday';

const todayISO = () => new Date().toISOString().slice(0, 10);

const ClassAttendance: React.FC = () => {
  const { classId } = useParams<{ classId: string }>();
  const navigate = useNavigate();

  const [date, setDate] = useState(todayISO());
  const [rows, setRows] = useState<SubscriberRow[]>([]);
  const [marks, setMarks] = useState<Record<number, AttendanceStatus>>({});
  const [loading, setLoading] = useState(true);
  const [deletingClass, setDeletingClass] = useState(false);
  const [removingSub, setRemovingSub] = useState<number | null>(null);

  /* ============================================================
     LOAD SUBSCRIBERS (ACTIVE SUBSCRIPTIONS) + ATTENDANCE
     ============================================================ */
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classId, date]);

  async function load() {
    if (!classId) return;

    setLoading(true);

    try {
      // ✅ ONLY subscribers who are ACTIVE on this date
      const subsRes = await subscriptions.listForClassOnDate(
        Number(classId),
        date
      );

      const list: SubscriberRow[] = subsRes.data || [];
      setRows(list);

      // Load attendance for date
      const att = await attendance.getByDate(date);
      const map: Record<number, AttendanceStatus> = {};

      (att.data || []).forEach((a: any) => {
        map[a.subscriber_id] = a.status;
      });

      setMarks(map);
    } finally {
      setLoading(false);
    }
  }

  /* ============================================================
     MARK ATTENDANCE
     ============================================================ */
  async function mark(subscriber_id: number, status: AttendanceStatus) {
    setMarks((m) => ({ ...m, [subscriber_id]: status }));

    await attendance.mark({
      subscriber_id,
      date,
      status,
    });
  }

  /* ============================================================
     REMOVE SUBSCRIBER FROM CLASS (END SUBSCRIPTION)
     ============================================================ */
  async function removeFromClass(subscriberId: number) {
    if (!classId) return;

    const ok = window.confirm(
      'Remove this subscriber from the class?\n\nAttendance history will be preserved.'
    );
    if (!ok) return;

    try {
      setRemovingSub(subscriberId);

      // ✅ End subscription BEFORE selected date
      await subscriptions.end(
        subscriberId,
        Number(classId),
        date
      );

      // Reload → subscriber disappears immediately
      await load();
    } catch (e: any) {
      alert(e?.message || 'Failed to remove subscriber');
    } finally {
      setRemovingSub(null);
    }
  }

  /* ============================================================
     DELETE CLASS
     ============================================================ */
  async function deleteClass() {
    if (!classId) return;

    const confirmed = window.confirm(
      'Are you sure you want to delete this class?\n\nSubscriptions will be removed.\nAttendance history will remain.'
    );

    if (!confirmed) return;

    try {
      setDeletingClass(true);
      await (window as any).electronAPI.classes.delete(Number(classId));
      navigate('/classes');
    } catch (e: any) {
      alert(e?.message || 'Failed to delete class');
    } finally {
      setDeletingClass(false);
    }
  }

  /* ============================================================
     UI
     ============================================================ */
  return (
    <div className="max-w-6xl mx-auto space-y-4">
      {/* HEADER */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Class Attendance</h1>

        <div className="flex items-center gap-3">
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="border rounded px-2 py-1"
          />

          <button
            onClick={deleteClass}
            disabled={deletingClass}
            className="bg-red-600 text-white rounded px-4 py-2 disabled:opacity-50"
          >
            {deletingClass ? 'Deleting…' : 'Delete Class'}
          </button>
        </div>
      </div>

      {loading && <div>Loading…</div>}

      {!loading && rows.length === 0 && (
        <div className="text-gray-500">
          No subscribers assigned to this class for the selected date.
        </div>
      )}

      {!loading && rows.length > 0 && (
        <div className="overflow-x-auto border rounded bg-white">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-100">
              <tr>
                <th className="px-3 py-2 text-left">#</th>
                <th className="px-3 py-2 text-left">Name</th>
                <th className="px-3 py-2 text-left">ID Number</th>
                <th className="px-3 py-2 text-left">Attendance</th>
                <th className="px-3 py-2 text-left">Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.id} className="border-t">
                  <td className="px-3 py-2">{i + 1}</td>
                  <td className="px-3 py-2 font-medium">{r.name}</td>
                  <td className="px-3 py-2">{r.id_number}</td>
                  <td className="px-3 py-2">
                    <select
                      value={marks[r.id] || 'absent'}
                      onChange={(e) =>
                        mark(r.id, e.target.value as AttendanceStatus)
                      }
                      className="border rounded px-2 py-1"
                    >
                      <option value="present">Present</option>
                      <option value="absent">Absent</option>
                      <option value="late">Late</option>
                      <option value="excused">Excused</option>
                      <option value="holiday">Holiday</option>
                    </select>
                  </td>
                  <td className="px-3 py-2">
                    <button
                      onClick={() => removeFromClass(r.id)}
                      disabled={removingSub === r.id}
                      className="text-red-600 hover:underline disabled:opacity-50"
                    >
                      {removingSub === r.id ? 'Removing…' : 'Remove'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default ClassAttendance;
