import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import AttendanceMarking from '../components/attendance/AttendanceMarking';
import { database } from '../../shared/utils/electron-api';

type AttendanceRow = {
  subscriber_id: number;
  name: string;
  id_number: string;
  phone: string;
  email?: string;
  address?: string;
  status: string;
  marked_at?: string;
};

const todayISO = () => new Date().toISOString().split('T')[0];

const normalizeRows = <T,>(result: any): T[] => {
  if (Array.isArray(result)) return result as T[];
  if (Array.isArray(result?.data)) return result.data as T[];
  return [];
};

const formatDisplayDate = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });

const Attendance: React.FC = () => {
  const { t } = useTranslation();

  const [selectedDate, setSelectedDate] = useState(todayISO());
  const [pendingDate, setPendingDate] = useState(selectedDate);
  const [changeDateOpen, setChangeDateOpen] = useState(false);

  const [markingOpen, setMarkingOpen] = useState(false);
  const [rows, setRows] = useState<AttendanceRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  /* ---------------- LOAD RECORDS ---------------- */
  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      try {
        const result = await database.query(
          `
          SELECT
            a.subscriber_id,
            s.name,
            s.id_number,
            s.phone,
            s.email,
            s.address,
            a.status,
            a.created_at AS marked_at
          FROM attendance a
          JOIN subscribers s ON s.id = a.subscriber_id
          WHERE DATE(a.date) = :date
          ORDER BY a.created_at DESC
          `,
          { date: selectedDate }
        );

        if (!cancelled) {
          setRows(normalizeRows<AttendanceRow>(result));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [selectedDate, refreshKey]);

  /* ---------------- UNMARK ---------------- */
  const handleUnmark = async (subscriber_id: number) => {
    await (window as any).electronAPI.attendance.unmark(
      subscriber_id,
      selectedDate
    );
    setRefreshKey((v) => v + 1);
  };

  /* ---------------- EXPORT CSV ---------------- */
  const exportCSV = () => {
    if (!rows.length) return alert('No attendance records');

    const headers = ['Name', 'ID', 'Phone', 'Status', 'Time'];
    const body = rows.map((r) =>
      [
        r.name,
        r.id_number,
        r.phone,
        r.status,
        r.marked_at ? new Date(r.marked_at).toLocaleTimeString() : '',
      ]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(',')
    );

    const csv = '\uFEFF' + [headers.join(','), ...body].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });

    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `attendance-${selectedDate}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  /* ---------------- PRINT (IPC ONLY) ---------------- */
  const printAttendance = async () => {
    await (window as any).electronAPI.printAttendance(selectedDate);
  };

  return (
    <div className="max-w-7xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">
        Attendance — {formatDisplayDate(selectedDate)}
      </h1>

      {/* ACTION BAR */}
      <div className="bg-white border rounded p-4 mb-4 flex justify-between">
        <div className="flex gap-2">
          <button
            onClick={() => setMarkingOpen(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded"
          >
            Mark Attendance
          </button>

          <button
            onClick={printAttendance}
            className="px-4 py-2 bg-gray-800 text-white rounded"
          >
            Print Attendance
          </button>

          <button
            onClick={exportCSV}
            className="px-4 py-2 bg-green-700 text-white rounded"
          >
            Export CSV
          </button>
        </div>

        <button
          onClick={() => {
            setPendingDate(selectedDate);
            setChangeDateOpen(true);
          }}
          className="px-3 py-2 border rounded bg-gray-50"
        >
          Change date
        </button>
      </div>

      {/* CHANGE DATE */}
      {changeDateOpen && (
        <div className="bg-white border rounded p-4 mb-6 max-w-md">
          <input
            type="date"
            value={pendingDate}
            onChange={(e) => setPendingDate(e.target.value)}
            className="border rounded px-2 py-1 mr-2"
          />
          <button
            onClick={() => {
              setSelectedDate(pendingDate);
              setChangeDateOpen(false);
            }}
            className="px-3 py-1 bg-blue-600 text-white rounded"
          >
            Apply
          </button>
          <button
            onClick={() => setChangeDateOpen(false)}
            className="px-3 py-1 ml-2 border rounded"
          >
            Cancel
          </button>
        </div>
      )}

      {/* TABLE */}
      <div className="bg-white border rounded p-4">
        {loading ? (
          <p>Loading…</p>
        ) : rows.length === 0 ? (
          <p>No attendance records.</p>
        ) : (
          <table className="min-w-full border text-sm">
            <thead className="bg-gray-100">
              <tr>
                <th className="border px-2 py-1">Name</th>
                <th className="border px-2 py-1">ID</th>
                <th className="border px-2 py-1">Phone</th>
                <th className="border px-2 py-1">Status</th>
                <th className="border px-2 py-1">Time</th>
                <th className="border px-2 py-1">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={`${selectedDate}:${r.subscriber_id}`}>
                  <td className="border px-2 py-1">{r.name}</td>
                  <td className="border px-2 py-1">{r.id_number}</td>
                  <td className="border px-2 py-1">{r.phone}</td>
                  <td className="border px-2 py-1">{r.status}</td>
                  <td className="border px-2 py-1">
                    {r.marked_at
                      ? new Date(r.marked_at).toLocaleTimeString()
                      : ''}
                  </td>
                  <td className="border px-2 py-1">
                    <button
                      onClick={() => handleUnmark(r.subscriber_id)}
                      className="px-3 py-1 border rounded"
                    >
                      Unmark
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <AttendanceMarking
        date={selectedDate}
        open={markingOpen}
        onOpenChange={setMarkingOpen}
        onSuccess={() => setRefreshKey((v) => v + 1)}
      />
    </div>
  );
};

export default Attendance;
