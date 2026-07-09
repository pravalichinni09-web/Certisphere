/**
 * Management → Global Settings
 *
 * Configures the global-product knobs for CertiSphere:
 *   - Organisation identity (name, short-name, accreditation body)
 *   - Default country / timezone / currency / language
 *   - Supported countries + languages (multi-select)
 *   - Contact + legal footer
 *
 * Persists to the `cms_global_config_v1` store and broadcasts so every
 * open page can refresh its header.
 */

import React, { useEffect, useState } from 'react';
import {
  Globe,
  Save,
  RotateCcw,
  Building2,
  Mail,
  Phone,
  Languages,
  DollarSign,
  Clock,
  Award,
} from 'lucide-react';
import {
  GlobalConfig,
  readGlobalConfig,
  writeGlobalConfig,
  DEFAULT_CONFIG,
  flagOf,
} from '../../utils/globalConfig';

const COUNTRY_OPTIONS = [
  { name: 'India',     code: 'IN' },
  { name: 'USA',       code: 'US' },
  { name: 'UK',        code: 'GB' },
  { name: 'Germany',   code: 'DE' },
  { name: 'France',    code: 'FR' },
  { name: 'UAE',       code: 'AE' },
  { name: 'Singapore', code: 'SG' },
  { name: 'Australia', code: 'AU' },
  { name: 'Brazil',    code: 'BR' },
  { name: 'Japan',     code: 'JP' },
  { name: 'China',     code: 'CN' },
  { name: 'Canada',    code: 'CA' },
  { name: 'Mexico',    code: 'MX' },
  { name: 'South Africa', code: 'ZA' },
];

const TIMEZONE_OPTIONS = [
  'Asia/Kolkata', 'Asia/Dubai', 'Asia/Singapore', 'Asia/Tokyo', 'Asia/Shanghai',
  'Europe/London', 'Europe/Berlin', 'Europe/Paris',
  'America/New_York', 'America/Chicago', 'America/Los_Angeles', 'America/Sao_Paulo',
  'Australia/Sydney', 'Africa/Johannesburg',
];

const CURRENCY_OPTIONS = ['USD', 'EUR', 'GBP', 'INR', 'AED', 'SGD', 'AUD', 'JPY', 'CNY', 'BRL', 'ZAR', 'CAD'];

const LANGUAGE_OPTIONS = [
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Spanish' },
  { code: 'pt', label: 'Portuguese' },
  { code: 'de', label: 'German' },
  { code: 'fr', label: 'French' },
  { code: 'ar', label: 'Arabic' },
  { code: 'zh', label: 'Mandarin' },
  { code: 'hi', label: 'Hindi' },
  { code: 'ja', label: 'Japanese' },
  { code: 'it', label: 'Italian' },
];

const GlobalSettings: React.FC = () => {
  const [form, setForm] = useState<GlobalConfig>(() => readGlobalConfig());
  const [saved, setSaved] = useState<string | null>(null);

  useEffect(() => {
    setForm(readGlobalConfig());
  }, []);

  const set = <K extends keyof GlobalConfig>(k: K, v: GlobalConfig[K]) =>
    setForm((prev) => ({ ...prev, [k]: v }));

  const toggleListItem = (k: 'supportedLanguages' | 'supportedCountries', v: string) => {
    setForm((prev) => {
      const has = prev[k].includes(v);
      return { ...prev, [k]: has ? prev[k].filter((x) => x !== v) : [...prev[k], v] };
    });
  };

  const onSave = () => {
    const next = writeGlobalConfig(form);
    setForm(next);
    setSaved('Global settings saved — every role will pick up the new values immediately.');
    setTimeout(() => setSaved(null), 4000);
  };

  const onReset = () => {
    if (!confirm('Reset every global setting to the CertiSphere defaults?')) return;
    const next = writeGlobalConfig(DEFAULT_CONFIG);
    setForm(next);
    setSaved('Reset to defaults.');
    setTimeout(() => setSaved(null), 3000);
  };

  return (
    <div style={{ padding: 24, maxWidth: 1100, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
        <div style={{
          background: '#ecfeff', color: '#0e7490',
          width: 40, height: 40, borderRadius: 10,
          display: 'grid', placeItems: 'center',
        }}>
          <Globe size={22} />
        </div>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#0f172a' }}>Global Settings</h1>
          <p style={{ margin: 0, color: '#64748b', fontSize: 14 }}>
            Organisation-wide configuration that drives every role's header, the public site, and the audit data model.
          </p>
        </div>
      </div>

      {/* Toast */}
      {saved && (
        <div style={{ marginTop: 14, padding: '10px 14px', background: '#dcfce7', color: '#15803d', borderRadius: 8, fontSize: 13, fontWeight: 600 }}>
          {saved}
        </div>
      )}

      {/* Sections */}
      <Section title="Organisation identity" icon={<Building2 size={16} color="#7c3aed" />}>
        <Grid>
          <Field label="Organisation name" full>
            <input value={form.orgName} onChange={(e) => set('orgName', e.target.value)} style={inp} />
          </Field>
          <Field label="Short name (used in app header)">
            <input value={form.orgShortName} onChange={(e) => set('orgShortName', e.target.value)} style={inp} />
          </Field>
          <Field label="Accreditation body">
            <div style={{ position: 'relative' }}>
              <Award size={14} style={{ position: 'absolute', left: 10, top: 11, color: '#94a3b8' }} />
              <input value={form.accreditationBody} onChange={(e) => set('accreditationBody', e.target.value)} style={{ ...inp, paddingLeft: 30 }} />
            </div>
          </Field>
          <Field label="Tax / VAT ID (optional)">
            <input value={form.taxId} onChange={(e) => set('taxId', e.target.value)} style={inp} />
          </Field>
        </Grid>
      </Section>

      <Section title="Global defaults" icon={<Globe size={16} color="#0e7490" />}>
        <Grid>
          <Field label="Default country">
            <select
              value={form.defaultCountry}
              onChange={(e) => {
                const opt = COUNTRY_OPTIONS.find((c) => c.name === e.target.value);
                set('defaultCountry', e.target.value);
                if (opt) set('defaultCountryCode', opt.code);
              }}
              style={inp}
            >
              {COUNTRY_OPTIONS.map((c) => (
                <option key={c.code} value={c.name}>
                  {flagOf(c.code)} {c.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Default timezone">
            <div style={{ position: 'relative' }}>
              <Clock size={14} style={{ position: 'absolute', left: 10, top: 11, color: '#94a3b8' }} />
              <select value={form.defaultTimezone} onChange={(e) => set('defaultTimezone', e.target.value)} style={{ ...inp, paddingLeft: 30 }}>
                {TIMEZONE_OPTIONS.map((tz) => <option key={tz} value={tz}>{tz}</option>)}
              </select>
            </div>
          </Field>
          <Field label="Default currency">
            <div style={{ position: 'relative' }}>
              <DollarSign size={14} style={{ position: 'absolute', left: 10, top: 11, color: '#94a3b8' }} />
              <select value={form.defaultCurrency} onChange={(e) => set('defaultCurrency', e.target.value)} style={{ ...inp, paddingLeft: 30 }}>
                {CURRENCY_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </Field>
          <Field label="Default language">
            <div style={{ position: 'relative' }}>
              <Languages size={14} style={{ position: 'absolute', left: 10, top: 11, color: '#94a3b8' }} />
              <select value={form.defaultLanguage} onChange={(e) => set('defaultLanguage', e.target.value)} style={{ ...inp, paddingLeft: 30 }}>
                {LANGUAGE_OPTIONS.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
              </select>
            </div>
          </Field>
        </Grid>
      </Section>

      <Section title="Operating regions" icon={<Globe size={16} color="#0e7490" />}>
        <p style={{ margin: '0 0 8px 0', fontSize: 12, color: '#64748b' }}>
          Countries you currently certify in. Drives country pickers across the app.
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {COUNTRY_OPTIONS.map((c) => {
            const on = form.supportedCountries.includes(c.name);
            return (
              <button
                key={c.code}
                type="button"
                onClick={() => toggleListItem('supportedCountries', c.name)}
                style={chipStyle(on, '#0e7490', '#cffafe')}
              >
                {flagOf(c.code)} {c.name}
              </button>
            );
          })}
        </div>
      </Section>

      <Section title="Supported languages" icon={<Languages size={16} color="#7c3aed" />}>
        <p style={{ margin: '0 0 8px 0', fontSize: 12, color: '#64748b' }}>
          Pre-selected for forms where multiple languages are offered.
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {LANGUAGE_OPTIONS.map((l) => {
            const on = form.supportedLanguages.includes(l.code);
            return (
              <button
                key={l.code}
                type="button"
                onClick={() => toggleListItem('supportedLanguages', l.code)}
                style={chipStyle(on, '#4338ca', '#eef2ff')}
              >
                {l.label}
              </button>
            );
          })}
        </div>
      </Section>

      <Section title="Contact" icon={<Mail size={16} color="#15803d" />}>
        <Grid>
          <Field label="Public email">
            <div style={{ position: 'relative' }}>
              <Mail size={14} style={{ position: 'absolute', left: 10, top: 11, color: '#94a3b8' }} />
              <input value={form.contactEmail} onChange={(e) => set('contactEmail', e.target.value)} style={{ ...inp, paddingLeft: 30 }} />
            </div>
          </Field>
          <Field label="Public phone">
            <div style={{ position: 'relative' }}>
              <Phone size={14} style={{ position: 'absolute', left: 10, top: 11, color: '#94a3b8' }} />
              <input value={form.contactPhone} onChange={(e) => set('contactPhone', e.target.value)} style={{ ...inp, paddingLeft: 30 }} />
            </div>
          </Field>
          <Field label="Website" full>
            <input value={form.website} onChange={(e) => set('website', e.target.value)} style={inp} />
          </Field>
          <Field label="Legal footer" full>
            <textarea value={form.legalFooter} onChange={(e) => set('legalFooter', e.target.value)} rows={2} style={{ ...inp, fontFamily: 'inherit', resize: 'vertical' }} />
          </Field>
        </Grid>
      </Section>

      {/* Actions */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 18 }}>
        <button onClick={onReset} style={btnSecondary}>
          <RotateCcw size={14} /> Reset to defaults
        </button>
        <button onClick={onSave} style={btnPrimary}>
          <Save size={14} /> Save global settings
        </button>
      </div>
    </div>
  );
};

/* ---------- helpers ----------------------------------------------------- */

const Section: React.FC<{ title: string; icon: React.ReactNode; children: React.ReactNode }> = ({ title, icon, children }) => (
  <section style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 16, marginTop: 14, boxShadow: '0 1px 2px rgba(15,23,42,0.04)' }}>
    <h2 style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '0 0 12px 0', fontSize: 14, fontWeight: 700, color: '#0f172a', textTransform: 'uppercase', letterSpacing: 0.4 }}>
      {icon} {title}
    </h2>
    {children}
  </section>
);

const Grid: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}>{children}</div>
);

const Field: React.FC<{ label: string; full?: boolean; children: React.ReactNode }> = ({ label, full, children }) => (
  <label style={{ gridColumn: full ? 'span 2' : undefined, display: 'flex', flexDirection: 'column', gap: 4 }}>
    <span style={{ fontSize: 12, color: '#475569', fontWeight: 600 }}>{label}</span>
    {children}
  </label>
);

const inp: React.CSSProperties = {
  width: '100%', padding: '8px 10px', borderRadius: 6,
  border: '1px solid #cbd5e1', fontSize: 13, outline: 'none',
};

const chipStyle = (on: boolean, color: string, bg: string): React.CSSProperties => ({
  padding: '5px 10px', borderRadius: 14,
  border: '1px solid ' + (on ? color : '#cbd5e1'),
  background: on ? bg : '#fff',
  color: on ? color : '#475569',
  fontSize: 12, fontWeight: 600, cursor: 'pointer',
});

const btnPrimary: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  background: '#0e7490', color: '#fff', border: 'none',
  padding: '8px 14px', borderRadius: 6, fontSize: 13, fontWeight: 700, cursor: 'pointer',
};
const btnSecondary: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  background: '#fff', color: '#475569', border: '1px solid #cbd5e1',
  padding: '8px 14px', borderRadius: 6, fontSize: 13, fontWeight: 700, cursor: 'pointer',
};

export default GlobalSettings;
