import React, { useState, useEffect, useMemo } from 'react';
import { Plus, Trash2, Edit2, History, X, GitCompare, ArrowDownUp } from 'lucide-react';
import StandardPicker from '../../components/StandardPicker';
import TextDiffView from '../../components/TextDiffView';
import { addVersion, listVersions, Version } from '../../utils/versionHistory';
import '../../styles/AuditorCoordinator.css';
import '../../styles/TextDiffView.css';

interface AuditScopeItem {
  id: number;
  scopeName: string;
  description: string;
  standard: string;
  currentVersion?: number;
}

interface ScopeSnapshot {
  scopeName: string;
  description: string;
  standard: string;
}

const STORAGE_KEY = 'cms_audit_scopes';
const VERSION_TRACK = (id: number) => `audit_scope:${id}`;

const defaultScopes: AuditScopeItem[] = [
  { id: 1, scopeName: 'Quality Management', description: 'Quality Management System compliance requirements', standard: 'ISO 9001:2015' },
  { id: 2, scopeName: 'Environmental Management', description: 'Environmental Management System standards', standard: 'ISO 14001:2015' },
  { id: 3, scopeName: 'Occupational Health & Safety', description: 'Occupational health and safety management', standard: 'ISO 45001:2018' },
  { id: 4, scopeName: 'Information Security', description: 'Information Security Management System', standard: 'ISO 27001:2022' },
  { id: 5, scopeName: 'AI Management', description: 'Artificial Intelligence Management System', standard: 'ISO 42001:2023' },
];

const snapshot = (item: ScopeSnapshot): string =>
  [
    `Scope: ${item.scopeName}`,
    `Standard: ${item.standard}`,
    '',
    'Description:',
    item.description || '(empty)',
  ].join('\n');

const AuditScope: React.FC = () => {
  const [scopes, setScopes] = useState<AuditScopeItem[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [historyForId, setHistoryForId] = useState<number | null>(null);
  const [historyList, setHistoryList] = useState<Version<ScopeSnapshot>[]>([]);
  const [diffLeft, setDiffLeft] = useState<number | null>(null);
  const [diffRight, setDiffRight] = useState<number | null>(null);
  const [revisionNote, setRevisionNote] = useState('');

  const [formData, setFormData] = useState<ScopeSnapshot>({
    scopeName: '',
    description: '',
    standard: '',
  });

  const isEditing = editingId !== null;

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        const migrated: AuditScopeItem[] = parsed.map((s: any, i: number) => ({
          id: s.id ?? i + 1,
          scopeName: s.scopeName ?? s.specialization ?? s.name ?? '',
          description: s.description ?? '',
          standard: s.standard ?? s.name ?? '',
          currentVersion: s.currentVersion,
        }));
        setScopes(migrated);
        return;
      }
    } catch (e) {
      console.error('Failed to load scopes', e);
    }
    setScopes(defaultScopes);
  }, []);

  // Seed initial v1 snapshots for default scopes if missing
  useEffect(() => {
    scopes.forEach(sc => {
      const existing = listVersions<ScopeSnapshot>(VERSION_TRACK(sc.id));
      if (existing.length === 0) {
        addVersion<ScopeSnapshot>(VERSION_TRACK(sc.id), {
          scopeName: sc.scopeName,
          description: sc.description,
          standard: sc.standard,
        }, { note: 'Initial version' });
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scopes.length]);

  const persist = (items: AuditScopeItem[]) => {
    setScopes(items);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(items)); } catch {}
  };

  const resetForm = () => {
    setFormData({ scopeName: '', description: '', standard: '' });
    setRevisionNote('');
    setEditingId(null);
  };

  const handleEdit = (item: AuditScopeItem) => {
    setEditingId(item.id);
    setFormData({ scopeName: item.scopeName, description: item.description, standard: item.standard });
    setShowForm(true);
  };

  const handleDelete = (id: number) => {
    if (!window.confirm('Delete this scope and its revision history?')) return;
    persist(scopes.filter((s) => s.id !== id));
    try { localStorage.removeItem('cms_versions:' + VERSION_TRACK(id)); } catch {}
  };

  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleStandardChange = (value: string) => {
    setFormData((prev) => ({ ...prev, standard: value }));
  };

  const hasChanged = (id: number, snap: ScopeSnapshot): boolean => {
    const cur = scopes.find(s => s.id === id);
    if (!cur) return true;
    return cur.scopeName !== snap.scopeName || cur.description !== snap.description || cur.standard !== snap.standard;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.standard) {
      alert('Please select a standard.');
      return;
    }

    if (isEditing && editingId !== null) {
      const changed = hasChanged(editingId, formData);
      const updated = scopes.map((s) => s.id === editingId ? { ...s, ...formData } : s);
      // Push a new version when fields actually changed
      if (changed) {
        const v = addVersion<ScopeSnapshot>(VERSION_TRACK(editingId), { ...formData }, { note: revisionNote || 'Revision' });
        const stamped = updated.map(s => s.id === editingId ? { ...s, currentVersion: v.version } : s);
        persist(stamped);
      } else {
        persist(updated);
      }
    } else {
      const nextId = scopes.length > 0 ? Math.max(...scopes.map((s) => s.id)) + 1 : 1;
      const newItem: AuditScopeItem = { id: nextId, ...formData, currentVersion: 1 };
      persist([...scopes, newItem]);
      addVersion<ScopeSnapshot>(VERSION_TRACK(nextId), { ...formData }, { note: revisionNote || 'Initial version' });
    }
    resetForm();
    setShowForm(false);
  };

  const handleCancel = () => { resetForm(); setShowForm(false); };

  const toggleForm = () => {
    if (showForm) handleCancel();
    else { resetForm(); setShowForm(true); }
  };

  const openHistory = (id: number) => {
    const versions = listVersions<ScopeSnapshot>(VERSION_TRACK(id));
    setHistoryList(versions);
    setHistoryForId(id);
    if (versions.length >= 2) {
      setDiffLeft(versions[versions.length - 2].version);
      setDiffRight(versions[versions.length - 1].version);
    } else if (versions.length === 1) {
      setDiffLeft(versions[0].version);
      setDiffRight(versions[0].version);
    }
  };

  const closeHistory = () => {
    setHistoryForId(null);
    setHistoryList([]);
    setDiffLeft(null);
    setDiffRight(null);
  };

  const swapDiff = () => {
    setDiffLeft(diffRight);
    setDiffRight(diffLeft);
  };

  const diffPair = useMemo(() => {
    if (!historyList.length || diffLeft === null || diffRight === null) return null;
    const left = historyList.find(v => v.version === diffLeft);
    const right = historyList.find(v => v.version === diffRight);
    if (!left || !right) return null;
    return {
      leftLabel: `Rev ${left.version}`,
      rightLabel: `Rev ${right.version}`,
      leftText: snapshot(left.data),
      rightText: snapshot(right.data),
    };
  }, [historyList, diffLeft, diffRight]);

  return (
    <div className="audit-scope-container">
      <div className="scope-header">
        <div>
          <h1>Audit Scope</h1>
          <p>Define audit scopes — every revision is versioned with a redline diff</p>
        </div>
        <button className="add-btn" onClick={toggleForm}>
          <Plus size={20} /> {showForm ? 'Close Form' : 'Add Scope'}
        </button>
      </div>

      {showForm && (
        <div className="scope-form">
          <h3>{isEditing ? `Edit Audit Scope${editingId !== null ? ` — v${(scopes.find(s => s.id === editingId)?.currentVersion || 1) + 1} pending` : ''}` : 'Create New Audit Scope'}</h3>
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>Scope Name</label>
              <input name="scopeName" value={formData.scopeName} onChange={handleFormChange} type="text" placeholder="Enter scope name (e.g. Quality Management)" required />
            </div>
            <div className="form-group">
              <label>Description</label>
              <textarea name="description" value={formData.description} onChange={handleFormChange} placeholder="Enter description" required rows={5} />
            </div>
            <div className="form-group">
              <label>Standard</label>
              <StandardPicker value={formData.standard} onChange={handleStandardChange} required placeholder="Select a standard" />
            </div>
            {isEditing && (
              <div className="form-group">
                <label>Revision Note <span style={{ color: '#94a3b8', fontWeight: 400 }}>(optional)</span></label>
                <input
                  name="revisionNote"
                  value={revisionNote}
                  onChange={(e) => setRevisionNote(e.target.value)}
                  type="text"
                  placeholder="What changed and why?"
                />
              </div>
            )}
            <div className="form-actions">
              <button type="button" className="cancel-btn" onClick={handleCancel}>Cancel</button>
              <button type="submit" className="submit-btn">{isEditing ? 'Submit' : 'Add'}</button>
            </div>
          </form>
        </div>
      )}

      <div className="checklists-table-wrap">
        <div className="table-wrap">
          <table className="checklists-table">
            <thead>
              <tr>
                <th>Scope Name</th>
                <th>Standard</th>
                <th>Description</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {scopes.map((s) => {
                return (
                  <tr key={s.id}>
                    <td><strong>{s.scopeName}</strong></td>
                    <td><span className="iso-standard">{s.standard}</span></td>
                    <td style={{ maxWidth: 320, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={s.description}>{s.description}</td>
                    <td>
                      <button className="link-btn" title="Edit / new revision" onClick={() => handleEdit(s)}><Edit2 size={16} /></button>
                      <button className="link-btn" title="View revision history" onClick={() => openHistory(s.id)}><History size={16} /></button>
                      <button className="link-btn danger" title="Delete" onClick={() => handleDelete(s.id)}><Trash2 size={16} /></button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* History + Diff Modal */}
      {historyForId !== null && (
        <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) closeHistory(); }}>
          <div className="modal-content" style={{ width: 'min(900px, 95vw)', maxHeight: '90vh', overflow: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                <History size={18} /> Revision History — {scopes.find(s => s.id === historyForId)?.scopeName}
              </h3>
              <button onClick={closeHistory} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                <X size={20} color="#64748b" />
              </button>
            </div>

            <div style={{ display: 'flex', gap: 16 }}>
              <aside style={{ minWidth: 200, borderRight: '1px solid #e2e8f0', paddingRight: 14 }}>
                <h4 style={{ marginTop: 0, marginBottom: 8, fontSize: 13, color: '#64748b' }}>Revisions</h4>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {historyList.length === 0 && <li style={{ color: '#94a3b8', fontSize: 12 }}>No history yet</li>}
                  {historyList.slice().reverse().map(v => (
                    <li key={v.version}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: '6px 8px', borderRadius: 6, background: (v.version === diffRight ? '#dcfce7' : (v.version === diffLeft ? '#fee2e2' : 'transparent')) }}>
                        <strong style={{ fontSize: 13 }}>Rev {v.version}</strong>
                        <span style={{ fontSize: 11, color: '#64748b' }}>
                          {new Date(v.savedAt).toLocaleString()}
                        </span>
                        {v.note && <span style={{ fontSize: 11, color: '#475569', fontStyle: 'italic' }}>{v.note}</span>}
                        <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
                          <button
                            onClick={() => setDiffLeft(v.version)}
                            style={{ flex: 1, fontSize: 10, padding: '2px 4px', background: diffLeft === v.version ? '#fecaca' : '#f1f5f9', color: '#0f172a', border: 'none', borderRadius: 3, cursor: 'pointer' }}
                          >
                            Old
                          </button>
                          <button
                            onClick={() => setDiffRight(v.version)}
                            style={{ flex: 1, fontSize: 10, padding: '2px 4px', background: diffRight === v.version ? '#bbf7d0' : '#f1f5f9', color: '#0f172a', border: 'none', borderRadius: 3, cursor: 'pointer' }}
                          >
                            New
                          </button>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </aside>

              <main style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <div style={{ fontSize: 13, color: '#64748b', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <GitCompare size={14} /> Comparing versions
                  </div>
                  {diffLeft !== null && diffRight !== null && diffLeft !== diffRight && (
                    <button onClick={swapDiff} style={{ background: 'transparent', border: '1px solid #e2e8f0', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12 }}>
                      <ArrowDownUp size={12} /> Swap
                    </button>
                  )}
                </div>

                {diffPair ? (
                  <TextDiffView
                    oldText={diffPair.leftText}
                    newText={diffPair.rightText}
                    oldLabel={diffPair.leftLabel}
                    newLabel={diffPair.rightLabel}
                  />
                ) : (
                  <div style={{ color: '#94a3b8', textAlign: 'center', padding: 24 }}>
                    Select two versions to see the redline diff.
                  </div>
                )}
              </main>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .modal-overlay { position: fixed; inset: 0; background: rgba(15, 23, 42, 0.6); display: flex; align-items: center; justify-content: center; z-index: 1000; }
        .modal-content { background: #fff; padding: 22px; border-radius: 12px; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1); }
      `}</style>
    </div>
  );
};

export default AuditScope;
