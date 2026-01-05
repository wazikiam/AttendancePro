import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import * as Dialog from '@radix-ui/react-dialog';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';
import { Cross2Icon, TrashIcon } from '@radix-ui/react-icons';

type AttendanceStatus = 'present' | 'absent' | 'late' | 'excused';

interface Subscriber {
  id: number;
  name?: string;
  id_number?: string;
  phone?: string;
  status?: string;
}

interface AttendanceRowFromDB {
  subscriber_id: number;
  status: AttendanceStatus;
  notes?: string | null;
}

interface AttendanceMarkingProps {
  date: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

type MarkDraft = {
  subscriber_id: number;
  date: string;
  status: AttendanceStatus;
  notes?: string;
  recorded_by: number;
};

const AttendanceMarking: React.FC<AttendanceMarkingProps> = ({
  date,
  open,
  onOpenChange,
  onSuccess,
}) => {
  const { t } = useTranslation();
  const searchRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [query, setQuery] = useState('');

  const [existingBySubscriberId, setExistingBySubscriberId] =
    useState<Record<number, AttendanceRowFromDB>>({});

  const [selected, setSelected] = useState<Subscriber | null>(null);
  const [draft, setDraft] = useState<MarkDraft | null>(null);

  useEffect(() => {
    if (!open) return;

    // Hard reset when dialog opens
    setQuery('');
    setSelected(null);
    setDraft(null);

    setTimeout(() => searchRef.current?.focus(), 0);

    const run = async () => {
      setLoading(true);
      try {
        const subsRes = await window.electronAPI.subscribers.get(
          { status: 'active' },
          1,
          5000
        );
        setSubscribers(subsRes?.data || []);

        const attRes = await window.electronAPI.attendance.getByDate(date);
        const map: Record<number, AttendanceRowFromDB> = {};
        (attRes?.data || []).forEach((r: any) => {
          map[r.subscriber_id] = r;
        });
        setExistingBySubscriberId(map);
      } finally {
        setLoading(false);
      }
    };

    run();
  }, [open, date]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return subscribers;
    return subscribers.filter((s) =>
      `${s.name} ${s.id_number} ${s.phone}`.toLowerCase().includes(q)
    );
  }, [query, subscribers]);

  const selectedExisting = selected
    ? existingBySubscriberId[selected.id]
    : null;

  const resetForNext = () => {
    setQuery('');
    setSelected(null);
    setDraft(null);
    setTimeout(() => searchRef.current?.focus(), 0);
  };

  const ensureDraft = (s: Subscriber) => {
    setDraft({
      subscriber_id: s.id,
      date,
      status: selectedExisting?.status || 'present',
      notes: selectedExisting?.notes || '',
      recorded_by: 1,
    });
  };

  const saveAttendance = async () => {
    if (!draft) return;
    setSaving(true);
    try {
      await window.electronAPI.attendance.mark(draft);
      onSuccess?.(); // refresh list, NOT close dialog
      resetForNext();
    } catch (e: any) {
      alert(e.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const unmarkAttendance = async () => {
    if (!selected) return;

    if (!window.confirm('Unmark this attendance?')) return;

    setSaving(true);
    try {
      await window.electronAPI.attendance.unmark(selected.id, date);
      setExistingBySubscriberId((prev) => {
        const next = { ...prev };
        delete next[selected.id];
        return next;
      });
      onSuccess?.();
      resetForNext();
    } catch (e: any) {
      alert(e.message || 'Unmark failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50" />
        <Dialog.Content className="fixed top-1/2 left-1/2 w-[90vw] max-w-5xl -translate-x-1/2 -translate-y-1/2 bg-white rounded-xl p-6">

          {/* REQUIRED BY RADIX */}
          <Dialog.Title className="text-xl font-semibold">
            Attendance — {date}
          </Dialog.Title>

          <VisuallyHidden>
            <Dialog.Description>
              Mark attendance for subscribers on selected date
            </Dialog.Description>
          </VisuallyHidden>

          <Dialog.Close className="absolute top-4 right-4">
            <Cross2Icon />
          </Dialog.Close>

          <div className="grid grid-cols-2 gap-6 mt-4">
            <div>
              <input
                ref={searchRef}
                className="w-full border px-3 py-2 rounded mb-3"
                placeholder="Search subscriber"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />

              <div className="max-h-[400px] overflow-auto space-y-2">
                {filtered.map((s) => (
                  <button
                    key={s.id}
                    className={`w-full text-left p-2 border rounded ${
                      selected?.id === s.id ? 'bg-gray-900 text-white' : ''
                    }`}
                    onClick={() => {
                      setSelected(s);
                      ensureDraft(s);
                    }}
                  >
                    {s.name} — {s.id_number}
                  </button>
                ))}
              </div>
            </div>

            <div>
              {!selected && (
                <div className="text-gray-500 flex items-center justify-center h-full">
                  Select a subscriber
                </div>
              )}

              {selected && draft && (
                <div className="space-y-4">
                  <div className="font-semibold">{selected.name}</div>

                  <div className="flex gap-2">
                    {(['present', 'absent', 'late', 'excused'] as AttendanceStatus[]).map(
                      (st) => (
                        <button
                          key={st}
                          className={`px-3 py-1 border rounded ${
                            draft.status === st ? 'bg-black text-white' : ''
                          }`}
                          onClick={() =>
                            setDraft({ ...draft, status: st })
                          }
                        >
                          {st}
                        </button>
                      )
                    )}
                  </div>

                  <textarea
                    className="w-full border px-3 py-2 rounded"
                    placeholder="Notes"
                    value={draft.notes || ''}
                    onChange={(e) =>
                      setDraft({ ...draft, notes: e.target.value })
                    }
                  />

                  <div className="flex justify-between">
                    {selectedExisting && (
                      <button
                        onClick={unmarkAttendance}
                        className="px-4 py-2 bg-red-600 text-white rounded flex items-center gap-2"
                        disabled={saving}
                      >
                        <TrashIcon /> Unmark
                      </button>
                    )}

                    <button
                      onClick={saveAttendance}
                      disabled={saving}
                      className="px-4 py-2 bg-green-700 text-white rounded"
                    >
                      Save & Next
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};

export default AttendanceMarking;
