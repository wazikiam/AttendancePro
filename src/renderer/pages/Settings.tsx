import React, { useEffect, useState } from 'react';

type SettingsMap = Record<string, any>;

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({
  title,
  children,
}) => (
  <section className="bg-white rounded-lg shadow p-6 mb-6">
    <h2 className="text-lg font-semibold mb-4">{title}</h2>
    {children}
  </section>
);

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({
  label,
  children,
}) => (
  <div className="mb-4">
    <label className="block text-sm font-medium text-gray-700 mb-1">
      {label}
    </label>
    {children}
  </div>
);

const Settings: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<SettingsMap>({});
  const [error, setError] = useState<string | null>(null);

  const uiLang = settings['locale.ui_language'] || 'en';

  useEffect(() => {
    const load = async () => {
      try {
        const res = await (window as any).electronAPI.settings.getAll();
        if (!res?.success) throw new Error('Failed to load settings');
        setSettings(res.data || {});
      } catch (e: any) {
        setError(e.message || 'Error loading settings');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const update = (key: string, value: any) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      await (window as any).electronAPI.settings.setMany(settings);
      alert('Settings saved successfully');
    } catch (e: any) {
      setError(e.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleFilePick = async (key: string) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async () => {
      if (!input.files || !input.files[0]) return;
      const file = input.files[0];
      const path = (file as any).path; // Electron file path
      update(key, path);
    };
    input.click();
  };

  if (loading) {
    return <div className="text-gray-500">Loading settings…</div>;
  }

  return (
    <div className="max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Settings</h1>

      {error && (
        <div className="mb-4 text-red-600 font-medium">{error}</div>
      )}

      {/* ================= ORGANIZATION ================= */}
      <Section title="Organization">
        <Field label="Organization name">
          <input
            className="w-full border rounded px-3 py-2"
            value={settings['org.name'] || ''}
            onChange={(e) => update('org.name', e.target.value)}
          />
        </Field>

        <Field label="Address">
          <input
            className="w-full border rounded px-3 py-2"
            value={settings['org.address'] || ''}
            onChange={(e) => update('org.address', e.target.value)}
          />
        </Field>

        <Field label="Phone">
          <input
            className="w-full border rounded px-3 py-2"
            value={settings['org.phone'] || ''}
            onChange={(e) => update('org.phone', e.target.value)}
          />
        </Field>

        <Field label="Email">
          <input
            className="w-full border rounded px-3 py-2"
            value={settings['org.email'] || ''}
            onChange={(e) => update('org.email', e.target.value)}
          />
        </Field>

        <Field label="Organization logo">
          <button
            className="px-4 py-2 bg-gray-100 border rounded"
            onClick={() => handleFilePick('org.logo_path')}
          >
            Upload logo
          </button>
          {settings['org.logo_path'] && (
            <div className="text-xs mt-1 text-gray-500">
              {settings['org.logo_path']}
            </div>
          )}
        </Field>

        <Field label="Electronic stamp">
          <button
            className="px-4 py-2 bg-gray-100 border rounded"
            onClick={() => handleFilePick('org.stamp_path')}
          >
            Upload stamp
          </button>
          {settings['org.stamp_path'] && (
            <div className="text-xs mt-1 text-gray-500">
              {settings['org.stamp_path']}
            </div>
          )}
        </Field>
      </Section>

      {/* ================= LOCALIZATION ================= */}
      <Section title="Localization">
        <Field label="UI Language">
          <select
            className="w-full border rounded px-3 py-2"
            value={settings['locale.ui_language']}
            onChange={(e) => update('locale.ui_language', e.target.value)}
          >
            <option value="en">English</option>
            <option value="fr">Français</option>
            <option value="ar">العربية</option>
          </select>
        </Field>

        <Field label="Date format">
          <select
            className="w-full border rounded px-3 py-2"
            value={settings['locale.date_format']}
            onChange={(e) => update('locale.date_format', e.target.value)}
          >
            <option value="YYYY-MM-DD">YYYY-MM-DD</option>
            <option value="DD/MM/YYYY">DD/MM/YYYY</option>
          </select>
        </Field>

        <Field label="Time format">
          <select
            className="w-full border rounded px-3 py-2"
            value={settings['locale.time_format']}
            onChange={(e) => update('locale.time_format', e.target.value)}
          >
            <option value="24h">24h</option>
            <option value="12h">12h</option>
          </select>
        </Field>
      </Section>

      {/* ================= PRINTING & PRIVACY ================= */}
      <Section title="Printing & Privacy">
        <Field label="Privacy level">
          <select
            className="w-full border rounded px-3 py-2"
            value={settings['print.privacy_level']}
            onChange={(e) => update('print.privacy_level', e.target.value)}
          >
            <option value="internal">Internal</option>
            <option value="external">External</option>
          </select>
        </Field>

        <Field label="Enable disclaimer">
          <input
            type="checkbox"
            checked={settings['print.disclaimer.enabled'] !== false}
            onChange={(e) =>
              update('print.disclaimer.enabled', e.target.checked)
            }
          />
        </Field>

        <Field label="Disclaimer text (printed on documents)">
          <textarea
            className="w-full border rounded px-3 py-2"
            rows={3}
            value={
              settings['print.disclaimer.text']?.[uiLang] || ''
            }
            onChange={(e) =>
              update('print.disclaimer.text', {
                ...(settings['print.disclaimer.text'] || {}),
                [uiLang]: e.target.value,
              })
            }
          />
        </Field>

        <div className="grid grid-cols-2 gap-2">
          {Object.entries(settings['print.fields'] || {}).map(([k, v]) => (
            <label key={k} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={!!v}
                onChange={(e) =>
                  update('print.fields', {
                    ...settings['print.fields'],
                    [k]: e.target.checked,
                  })
                }
              />
              {k.replace('_', ' ')}
            </label>
          ))}
        </div>
      </Section>

      {/* ================= SAVE ================= */}
      <div className="flex justify-end">
        <button
          onClick={save}
          disabled={saving}
          className="px-6 py-2 rounded bg-blue-600 text-white font-semibold disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save Settings'}
        </button>
      </div>
    </div>
  );
};

export default Settings;
