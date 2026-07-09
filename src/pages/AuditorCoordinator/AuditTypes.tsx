import React, { useEffect, useMemo, useState } from 'react';
import {
  Plus, Trash2, Edit2, Award, RefreshCw, ShieldCheck, Repeat,
  Calendar, Users, FileSpreadsheet, Building2, Info,
} from 'lucide-react';
import '../../styles/AuditorCoordinator.css';

/* ===============================================================
   Audit Types — the four certification lifecycle types
================================================================ */

interface AuditTypeItem {
  id: number;
  name: string;
  description: string;
  /** Stage in the certification lifecycle */
  stage: 'Stage 1+2' | 'Year 1' | 'Year 2' | 'Year 3';
  /** Default duration in days */
  durationDays: number;
  /** How often this type recurs */
  frequency: string;
  /** Months from the previous audit */
  monthsFromPrevious: number;
  /** Colour for the icon / chip */
  color: string;
  /** Icon name (Lucide) */
  iconKey: 'award' | 'shield' | 'refresh' | 'repeat';
  /** When this audit type produces a certificate */
  producesCertificate: boolean;
}

const STORAGE_KEY = 'cms_audit_types';

const DEFAULT_TYPES: AuditTypeItem[] = [
  {
    id: 1,
    name: 'Initial Certification',
    description:
      'First certification audit for a new client — Stage 1 (documentation review / readiness) + Stage 2 (on-site implementation audit). On successful completion the client is issued their first ISO certificate with 3-year validity.',
    stage: 'Stage 1+2',
    durationDays: 3,
    frequency: 'One-time',
    monthsFromPrevious: 0,
    color: '#2563eb',
    iconKey: 'award',
    producesCertificate: true,
  },
  {
    id: 2,
    name: 'Surveillance 1',
    description:
      'First annual surveillance audit, conducted ~12 months after the initial certification decision. Verifies the management system is being maintained, samples critical processes, and confirms continued conformity.',
    stage: 'Year 1',
    durationDays: 2,
    frequency: 'Every 12 months',
    monthsFromPrevious: 12,
    color: '#0ea5e9',
    iconKey: 'shield',
    producesCertificate: false,
  },
  {
    id: 3,
    name: 'Surveillance 2',
    description:
      'Second annual surveillance audit, conducted ~24 months after initial certification. Same intent as Surveillance 1 but typically with rotated focus areas across the standard\'s clauses.',
    stage: 'Year 2',
    durationDays: 2,
    frequency: 'Every 12 months',
    monthsFromPrevious: 12,
    color: '#7c3aed',
    iconKey: 'shield',
    producesCertificate: false,
  },
  {
    id: 4,
    name: 'Recertification',
    description:
      'Full recertification audit at the end of the 3-year cycle. Comparable in scope to the initial audit; on success the certificate is renewed for another 3 years.',
    stage: 'Year 3',
    durationDays: 3,
    frequency: 'Every 36 months',
    monthsFromPrevious: 12,
    color: '#16a34a',
    iconKey: 'repeat',
    producesCertificate: true,
  },
];

const ICONS: Record<AuditTypeItem['iconKey'], React.ReactNode> = {
  award:   <Award size={22} />,
  shield:  <ShieldCheck size={22} />,
  refresh: <RefreshCw size={22} />,
  repeat:  <Repeat size={22} />,
};

const safeJSON = <T,>(key: string, fallback: T): T => {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
};

const AuditTypes: React.FC = () => {
  const [items, setItems] = useState<AuditTypeItem[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState<Omit<AuditTypeItem, 'id'>>({
    name: '',
    description: '',
    stage: 'Stage 1+2',
    durationDays: 2,
    frequency: '',
    monthsFromPrevious: 0,
    color: '#2563eb',
    iconKey: 'shield',
    producesCertificate: false,
  });
  const isEditing = editingId !== null;

  /* -------- Load / migrate -------- */
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Migrate legacy entries (only had {name, description}) by mapping to
          // the closest of the four canonical types or keeping them as custom rows.
          const migrated: AuditTypeItem[] = parsed.map((it: any, idx: number) => {
            const name = String(it.name || '').toLowerCase();
            const found = DEFAULT_TYPES.find(d => name.includes(d.name.toLowerCase()) ||
              (name.includes('initial') && d.name === 'Initial Certification') ||
              (name.includes('stage 2') && d.name === 'Initial Certification') ||
              (name.includes('recert') && d.name === 'Recertification') ||
              (name === 'surveillance audit' && d.name === 'Surveillance 1'));
            if (found) return { ...found, id: it.id ?? idx + 1 };
            return {
              id: it.id ?? idx + 1,
              name: it.name ?? 'Custom Audit Type',
              description: it.description ?? '',
              stage: it.stage ?? 'Stage 1+2',
              durationDays: it.durationDays ?? 2,
              frequency: it.frequency ?? '',
              monthsFromPrevious: it.monthsFromPrevious ?? 0,
              color: it.color ?? '#475569',
              iconKey: it.iconKey ?? 'shield',
              producesCertificate: it.producesCertificate ?? false,
            };
          });

          // Ensure all four canonical types are present
          const merged = [...migrated];
          for (const d of DEFAULT_TYPES) {
            if (!merged.find(m => m.name === d.name)) {
              merged.push({ ...d, id: Math.max(...merged.map(m => m.id), 0) + 1 });
            }
          }
          setItems(merged);
          localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
          return;
        }
      }
    } catch (e) {
      console.error('Failed to load audit types', e);
    }
    setItems(DEFAULT_TYPES);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_TYPES));
  }, []);

  const persist = (list: AuditTypeItem[]) => {
    setItems(list);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    } catch {
      /* ignore */
    }
  };

  /* -------- Live "related" counts from connected localStorage keys -------- */
  const related = useMemo(() => {
    const schedules = [...safeJSON<any[]>('cms_audit_schedules', []), ...safeJSON<any[]>('cms_audit_schedules_v3', [])];
    const clients   = safeJSON<any[]>('cms_client_registrations', []);
    const certs     = safeJSON<any[]>('cms_audit_certifications', []);
    const matchCount = (typeName: string, list: any[], field: string) => {
      const lc = typeName.toLowerCase();
      return list.filter((r: any) => {
        const v = String(r?.[field] || '').toLowerCase();
        if (lc === 'initial certification') {
          return v.includes('initial') || v.includes('stage 2') || v.includes('certification');
        }
        return v === lc;
      }).length;
    };
    const out: Record<string, { schedules: number; clients: number; certificates: number }> = {};
    DEFAULT_TYPES.forEach((d) => {
      out[d.name] = {
        schedules:    matchCount(d.name, schedules, 'auditType'),
        clients:      matchCount(d.name, clients,   'clientType'),
        certificates: matchCount(d.name, certs,     'auditType'),
      };
    });
    return out;
  }, [items]);

  /* -------- Form handlers -------- */
  const handleFormChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value, type } = e.target as any;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'number' ? Number(value) : type === 'checkbox' ? (e.target as HTMLInputElement).checked : value,
    }));
  };

  const resetForm = () =>
    setFormData({
      name: '',
      description: '',
      stage: 'Stage 1+2',
      durationDays: 2,
      frequency: '',
      monthsFromPrevious: 0,
      color: '#2563eb',
      iconKey: 'shield',
      producesCertificate: false,
    });

  const handleEdit = (it: AuditTypeItem) => {
    setEditingId(it.id);
    setFormData({ ...it });
    setShowForm(true);
  };

  const handleDelete = (id: number) => {
    if (!window.confirm('Delete this audit type?')) return;
    persist(items.filter((i) => i.id !== id));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isEditing && editingId !== null) {
      persist(items.map((i) => (i.id === editingId ? { ...i, ...formData, id: editingId } : i)));
    } else {
      const nextId = items.length > 0 ? Math.max(...items.map((i) => i.id)) + 1 : 1;
      persist([...items, { id: nextId, ...formData }]);
    }
    resetForm();
    setEditingId(null);
    setShowForm(false);
  };

  const handleCancel = () => {
    resetForm();
    setEditingId(null);
    setShowForm(false);
  };

  const toggleForm = () => {
    if (showForm) handleCancel();
    else {
      resetForm();
      setShowForm(true);
    }
  };

  /* -------- Render -------- */
  return (
    <div className="audit-scope-container">
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(255, 215, 0, 0.12)', border: '1px solid rgba(255, 215, 0, 0.45)', color: '#d97706', padding: '4px 10px', borderRadius: 999, fontSize: 11, fontWeight: 800, letterSpacing: 0.4, textTransform: 'uppercase', marginBottom: 10 }} title="Client working model handled by Audit Coordinator">
        <span aria-hidden="true">🏷️</span> Client Working Model · Coordinator
      </div>
      <div className="scope-header">
        <div>
          <h1>Audit Types</h1>
          <p>The four audit types in our certification lifecycle, each connected to schedules, clients, and issued certificates.</p>
        </div>
        <button className="add-btn" onClick={toggleForm}>
          <Plus size={20} /> {showForm ? 'Close Form' : 'Add Type'}
        </button>
      </div>

      {/* Lifecycle banner — visual flow Initial → S1 → S2 → Recert */}
      <div style={{
        background: 'linear-gradient(135deg, #eff6ff 0%, #ede9fe 100%)',
        border: '1px solid #c7d2fe',
        borderRadius: 12,
        padding: '14px 18px',
        marginBottom: 18,
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        flexWrap: 'wrap',
      }}>
        <Info size={18} color="#4338ca" />
        <div style={{ flex: 1, minWidth: 280 }}>
          <div style={{ fontWeight: 700, color: '#1e3a8a', fontSize: 14, marginBottom: 4 }}>
            Certification lifecycle (3 years)
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap', fontSize: 12, color: '#1e3a8a' }}>
            <Pill color="#2563eb">Initial Certification</Pill>
            <span style={{ color: '#64748b' }}>→ +12 mo →</span>
            <Pill color="#0ea5e9">Surveillance 1</Pill>
            <span style={{ color: '#64748b' }}>→ +12 mo →</span>
            <Pill color="#7c3aed">Surveillance 2</Pill>
            <span style={{ color: '#64748b' }}>→ +12 mo →</span>
            <Pill color="#16a34a">Recertification</Pill>
            <span style={{ color: '#64748b' }}>(cycle repeats)</span>
          </div>
        </div>
      </div>

      {/* Audit Type cards — rich, with related counts */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: 14,
        marginBottom: 18,
      }}>
        {items.filter(it => DEFAULT_TYPES.find(d => d.name === it.name)).map((it) => {
          const r = related[it.name] || { schedules: 0, clients: 0, certificates: 0 };
          return (
            <div
              key={it.id}
              style={{
                background: '#fff',
                borderRadius: 14,
                border: '1px solid #e2e8f0',
                borderTop: `4px solid ${it.color}`,
                padding: 16,
                boxShadow: '0 4px 14px rgba(15,23,42,0.05)',
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  width: 42, height: 42, borderRadius: 10,
                  background: it.color + '15',
                  color: it.color,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  {ICONS[it.iconKey]}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 15, color: '#0f172a' }}>{it.name}</div>
                  <div style={{ fontSize: 11, color: '#64748b', display: 'flex', gap: 8, marginTop: 2 }}>
                    <span>{it.stage}</span>
                    <span>·</span>
                    <span>{it.durationDays} days</span>
                    <span>·</span>
                    <span>{it.frequency}</span>
                  </div>
                </div>
                {it.producesCertificate && (
                  <span style={{
                    fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 10,
                    background: '#dcfce7', color: '#15803d',
                  }}>
                    Issues Cert
                  </span>
                )}
              </div>

              <p style={{ margin: 0, fontSize: 12, color: '#475569', lineHeight: 1.5 }}>
                {it.description}
              </p>

              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: 6,
                marginTop: 4,
              }}>
                <RelatedTile icon={<Calendar size={12} />}        label="Schedules"     value={r.schedules}    />
                <RelatedTile icon={<Building2 size={12} />}        label="Clients"        value={r.clients}      />
                <RelatedTile icon={<FileSpreadsheet size={12} />}  label="Certificates"   value={r.certificates} />
              </div>

              <div style={{ display: 'flex', gap: 6, marginTop: 6, justifyContent: 'flex-end' }}>
                <button className="link-btn" title="Edit" onClick={() => handleEdit(it)}>
                  <Edit2 size={14} />
                </button>
                <button className="link-btn danger" title="Delete" onClick={() => handleDelete(it.id)}>
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Custom types (anything outside the 4 canonical) */}
      {items.filter(it => !DEFAULT_TYPES.find(d => d.name === it.name)).length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <h3 style={{ fontSize: 14, color: '#0f172a', margin: '0 0 8px' }}>Custom audit types</h3>
          <div className="checklists-table-wrap">
            <div className="table-wrap">
              <table className="checklists-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Description</th>
                    <th>Stage</th>
                    <th>Duration</th>
                    <th>Frequency</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {items.filter(it => !DEFAULT_TYPES.find(d => d.name === it.name)).map((it) => (
                    <tr key={it.id}>
                      <td><strong>{it.name}</strong></td>
                      <td style={{ fontSize: 12 }}>{it.description}</td>
                      <td>{it.stage}</td>
                      <td>{it.durationDays}d</td>
                      <td>{it.frequency}</td>
                      <td>
                        <button className="link-btn" title="Edit" onClick={() => handleEdit(it)}><Edit2 size={14} /></button>
                        <button className="link-btn danger" title="Delete" onClick={() => handleDelete(it.id)}><Trash2 size={14} /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Connected to other areas — visible footer */}
      <div style={{
        background: '#fff',
        border: '1px solid #e2e8f0',
        borderRadius: 12,
        padding: 14,
        marginBottom: 18,
        fontSize: 12,
      }}>
        <div style={{ fontWeight: 700, color: '#0f172a', marginBottom: 8, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <Users size={14} color="#2563eb" /> Connected to other areas of CertMS
        </div>
        <div style={{ color: '#475569', lineHeight: 1.7 }}>
          <strong>Audit Schedules</strong> — each schedule picks one of these four types from the dropdown.<br />
          <strong>Client Registration</strong> — the <em>Audit Type</em> field on every client uses this list.<br />
          <strong>Audit Certifications</strong> — Initial Certification and Recertification produce a fresh certificate; Surveillance 1 / 2 do not.<br />
          <strong>Audit Workflow</strong> — every workflow row references its audit type; surveillance reminders fire 12 months after the previous audit.<br />
          <strong>Audit Analysis</strong> — findings are grouped per audit, and audits per client are bucketed by these four types.
        </div>
      </div>

      {/* Form — rich create / edit */}
      {showForm && (
        <div className="scope-form">
          <h3>{isEditing ? 'Edit Audit Type' : 'Create New Audit Type'}</h3>
          <form onSubmit={handleSubmit}>
            <div className="form-row">
              <div className="form-group">
                <label>Name</label>
                <input name="name" value={formData.name} onChange={handleFormChange} type="text" placeholder="e.g. Initial Certification" required />
              </div>
              <div className="form-group">
                <label>Stage</label>
                <select name="stage" value={formData.stage} onChange={handleFormChange}>
                  <option value="Stage 1+2">Stage 1+2</option>
                  <option value="Year 1">Year 1</option>
                  <option value="Year 2">Year 2</option>
                  <option value="Year 3">Year 3</option>
                </select>
              </div>
            </div>

            <div className="form-group">
              <label>Description</label>
              <textarea name="description" value={formData.description} onChange={handleFormChange} placeholder="Short description of this audit type" required />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Duration (days)</label>
                <input name="durationDays" type="number" min="1" value={formData.durationDays} onChange={handleFormChange} required />
              </div>
              <div className="form-group">
                <label>Frequency</label>
                <input name="frequency" value={formData.frequency} onChange={handleFormChange} placeholder="e.g. Every 12 months" required />
              </div>
              <div className="form-group">
                <label>Months from previous audit</label>
                <input name="monthsFromPrevious" type="number" min="0" value={formData.monthsFromPrevious} onChange={handleFormChange} />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Colour</label>
                <input name="color" type="color" value={formData.color} onChange={handleFormChange} style={{ height: 36 }} />
              </div>
              <div className="form-group">
                <label>Icon</label>
                <select name="iconKey" value={formData.iconKey} onChange={handleFormChange}>
                  <option value="award">Award</option>
                  <option value="shield">Shield</option>
                  <option value="refresh">Refresh</option>
                  <option value="repeat">Repeat</option>
                </select>
              </div>
              <div className="form-group">
                <label>Issues a certificate?</label>
                <select name="producesCertificate" value={formData.producesCertificate ? 'yes' : 'no'} onChange={(e) => setFormData(prev => ({ ...prev, producesCertificate: e.target.value === 'yes' }))}>
                  <option value="no">No</option>
                  <option value="yes">Yes</option>
                </select>
              </div>
            </div>

            <div className="form-actions">
              <button type="button" className="cancel-btn" onClick={handleCancel}>Cancel</button>
              <button type="submit" className="submit-btn">{isEditing ? 'Submit' : 'Add'}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

/* ---------- Helpers ---------- */
const Pill: React.FC<{ color: string; children: React.ReactNode }> = ({ color, children }) => (
  <span style={{
    fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 12,
    background: color, color: '#fff', whiteSpace: 'nowrap',
  }}>
    {children}
  </span>
);

const RelatedTile: React.FC<{ icon: React.ReactNode; label: string; value: number }> = ({ icon, label, value }) => (
  <div style={{
    background: '#f8fafc',
    border: '1px solid #e2e8f0',
    borderRadius: 8,
    padding: '6px 8px',
    textAlign: 'center',
  }}>
    <div style={{ fontSize: 16, fontWeight: 800, color: '#0f172a', lineHeight: 1.1 }}>{value}</div>
    <div style={{ fontSize: 10, color: '#64748b', display: 'inline-flex', alignItems: 'center', gap: 3, marginTop: 2 }}>
      {icon} {label}
    </div>
  </div>
);

export default AuditTypes;
