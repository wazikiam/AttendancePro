import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { subscribers as subscribersAPI } from '../../../shared/utils/electron-api';

type SubscriberStatus = 'active' | 'inactive' | 'suspended';

type Subscriber = {
  id?: number;
  subscriber_code?: string;
  name?: string;
  id_number?: string;
  status?: SubscriberStatus | string;
  phone?: string;
  email?: string;
  address?: string;
  notes?: string;
  date_of_birth?: string;
  emergency_contact?: string;
  emergency_phone?: string;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => Promise<void> | void;
  subscriber?: Subscriber | null;
};

const readFileAsUint8Array = async (file: File): Promise<Uint8Array> => {
  const buf = await file.arrayBuffer();
  return new Uint8Array(buf);
};

const SubscriberForm: React.FC<Props> = ({
  open,
  onOpenChange,
  onSuccess,
  subscriber,
}) => {
  const { t } = useTranslation();
  const isEdit = !!subscriber?.id;

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // System (read-only)
  const [subscriberCode, setSubscriberCode] = useState('');

  // Mandatory
  const [name, setName] = useState('');
  const [idNumber, setIdNumber] = useState('');
  const [phone, setPhone] = useState('');

  // Optional
  const [status, setStatus] = useState<SubscriberStatus>('active');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [emergencyContact, setEmergencyContact] = useState('');
  const [emergencyPhone, setEmergencyPhone] = useState('');

  // Files
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [idDocFiles, setIdDocFiles] = useState<File[]>([]);

  const title = useMemo(
    () => (isEdit ? 'Edit Subscriber' : 'Add Subscriber'),
    [isEdit]
  );

  /* ============================================================
     Reset helper (CRITICAL FIX)
     ============================================================ */
  const resetForm = () => {
    setError(null);
    setSubscriberCode('');
    setName('');
    setIdNumber('');
    setPhone('');
    setStatus('active');
    setEmail('');
    setAddress('');
    setNotes('');
    setDateOfBirth('');
    setEmergencyContact('');
    setEmergencyPhone('');
    setPhotoFile(null);
    setIdDocFiles([]);
  };

  /* ============================================================
     Populate on open / subscriber change
     ============================================================ */
  useEffect(() => {
    if (!open) return;

    setError(null);
    setSaving(false);

    if (subscriber && subscriber.id) {
      // EDIT MODE
      setSubscriberCode(String(subscriber.subscriber_code ?? ''));
      setName(String(subscriber.name ?? ''));
      setIdNumber(String(subscriber.id_number ?? ''));
      setPhone(String(subscriber.phone ?? ''));
      setStatus(
        ((subscriber.status as SubscriberStatus) ?? 'active') as SubscriberStatus
      );
      setEmail(String(subscriber.email ?? ''));
      setAddress(String(subscriber.address ?? ''));
      setNotes(String(subscriber.notes ?? ''));
      setDateOfBirth(String(subscriber.date_of_birth ?? ''));
      setEmergencyContact(String(subscriber.emergency_contact ?? ''));
      setEmergencyPhone(String(subscriber.emergency_phone ?? ''));
    } else {
      // CREATE MODE (THIS WAS MISSING BEFORE)
      resetForm();
    }
  }, [open, subscriber]);

  if (!open) return null;

  const close = () => {
    if (!saving) {
      onOpenChange(false);
    }
  };

  const validate = () => {
    if (!name.trim()) return 'Full name is required';
    if (!idNumber.trim()) return 'ID Number is required';
    if (!phone.trim()) return 'Phone number is required';
    return null;
  };

  const extractId = (res: any): number | null => {
    if (!res) return null;
    if (typeof res.id === 'number') return res.id;
    if (typeof res.data === 'number') return res.data;
    return null;
  };

  const onSubmit = async () => {
    if (saving) return;

    setError(null);
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setSaving(true);

    try {
      const payload = {
        name: name.trim(),
        id_number: idNumber.trim(),
        phone: phone.trim(),
        status,
        email: email.trim() || null,
        address: address.trim() || null,
        notes: notes.trim() || null,
        date_of_birth: dateOfBirth.trim() || null,
        emergency_contact: emergencyContact.trim() || null,
        emergency_phone: emergencyPhone.trim() || null,
      };

      let subscriberId: number;

      if (isEdit && subscriber?.id) {
        const res = await subscribersAPI.update(subscriber.id, payload);
        if (!res || res.success === false) {
          throw new Error(res?.message || 'Update failed');
        }
        subscriberId = subscriber.id;
      } else {
        const res = await subscribersAPI.create(payload);
        const id = extractId(res);
        if (typeof id !== 'number') {
          throw new Error(res?.message || 'Create failed');
        }
        subscriberId = id;
      }

      if (photoFile) {
        const bytes = await readFileAsUint8Array(photoFile);
        const up = await subscribersAPI.uploadPhoto(
          subscriberId,
          photoFile.name,
          bytes
        );
        if (!up || up.success === false) {
          throw new Error(up?.message || 'Photo upload failed');
        }
      }

      for (const f of idDocFiles) {
        const bytes = await readFileAsUint8Array(f);
        const up = await subscribersAPI.uploadDocument(
          subscriberId,
          f.name,
          bytes
        );
        if (!up || up.success === false) {
          throw new Error(up?.message || `Document upload failed: ${f.name}`);
        }
      }

      await Promise.resolve(onSuccess());

      // IMPORTANT: reset form so next "Add Subscriber" works immediately
      resetForm();
      close();
    } catch (e: any) {
      console.error(e);
      setError(e?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50">
      <div
        className="absolute inset-0 bg-black/40"
        onClick={() => !saving && close()}
      />

      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div className="w-full max-w-3xl bg-white rounded-xl shadow-xl border flex flex-col max-h-[92vh]">
          <div className="px-6 py-4 border-b flex justify-between">
            <div>
              <h2 className="text-lg font-semibold">{t(title) || title}</h2>
              <p className="text-xs text-gray-500 mt-1">
                Required: Full Name, ID Number, Phone
              </p>
            </div>
            <button
              onClick={close}
              disabled={saving}
              className="border px-3 py-2 rounded"
            >
              Close
            </button>
          </div>

          <div className="p-6 overflow-y-auto grid grid-cols-1 md:grid-cols-2 gap-4">
            {error && (
              <div className="md:col-span-2 p-3 bg-red-50 border border-red-200 text-red-700">
                {error}
              </div>
            )}

            {isEdit && subscriberCode && (
              <input
                className="md:col-span-2 border px-3 py-2 rounded bg-gray-100 text-gray-700 cursor-not-allowed"
                value={subscriberCode}
                readOnly
                placeholder="Subscriber Code"
              />
            )}

            <input className="border px-3 py-2 rounded" placeholder="Full Name *" value={name} onChange={e => setName(e.target.value)} />
            <input className="border px-3 py-2 rounded" placeholder="ID Number *" value={idNumber} onChange={e => setIdNumber(e.target.value)} />
            <input className="border px-3 py-2 rounded" placeholder="Phone *" value={phone} onChange={e => setPhone(e.target.value)} />

            <select className="border px-3 py-2 rounded" value={status} onChange={e => setStatus(e.target.value as SubscriberStatus)}>
              <option value="active">active</option>
              <option value="inactive">inactive</option>
              <option value="suspended">suspended</option>
            </select>

            <input className="border px-3 py-2 rounded" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} />
            <input className="border px-3 py-2 rounded" type="date" value={dateOfBirth} onChange={e => setDateOfBirth(e.target.value)} />

            <input className="md:col-span-2 border px-3 py-2 rounded" placeholder="Address" value={address} onChange={e => setAddress(e.target.value)} />
            <textarea className="md:col-span-2 border px-3 py-2 rounded" placeholder="Notes" value={notes} onChange={e => setNotes(e.target.value)} />

            <input className="border px-3 py-2 rounded" placeholder="Emergency Contact" value={emergencyContact} onChange={e => setEmergencyContact(e.target.value)} />
            <input className="border px-3 py-2 rounded" placeholder="Emergency Phone" value={emergencyPhone} onChange={e => setEmergencyPhone(e.target.value)} />

            <input type="file" accept="image/*" onChange={e => setPhotoFile(e.target.files?.[0] ?? null)} />
            <input type="file" multiple accept=".pdf,image/*" onChange={e => setIdDocFiles(Array.from(e.target.files ?? []))} />
          </div>

          <div className="px-6 py-4 border-t flex justify-end gap-2">
            <button onClick={close} disabled={saving} className="border px-4 py-2 rounded">
              Cancel
            </button>
            <button onClick={onSubmit} disabled={saving} className="bg-blue-600 text-white px-4 py-2 rounded">
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SubscriberForm;
