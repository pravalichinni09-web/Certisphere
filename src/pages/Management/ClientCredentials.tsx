import React, { useEffect, useMemo, useState } from 'react';
import { KeyRound, Search, Eye, EyeOff, Copy, RefreshCw, Lock, ShieldCheck, Users, Download, CheckCircle2, Plus, Edit2, Trash2, X, Sparkles, Building2, Mail, Phone, MapPin, Save } from 'lucide-react';
import {
  ClientCredential,
  ClientRecord,
  readCredentials,
  ensureCredentialsForClients,
  resetCredential,
  toggleLockCredential,
  addClient,
  updateClientAndCredential,
  deleteClient,
  getClientById,
  getAllClients,
  isUsernameTaken,
} from '../AuditorCoordinator/utils/clientCredentials';
import { getAuditTypeNames } from '../../utils/auditTypes';
import EmptyState from '../../components/EmptyState';
import AIPanel from '../../components/AIPanel';
import { buildRiskRadar, riskRadarClaudePrompt, ClientRiskEntry } from '../../ai/managementInsights';
import { onCmsChange, claudeComplete, isClaudeConfigured } from '../../ai/liveData';
import '../../styles/Management/ClientCredentials.css';

const STANDARDS = [
  'ISO 9001:2015',
  'ISO 14001:2015',
  'ISO 45001:2018',
  'ISO 27001:2022',
  'ISO 22000:2018',
  'ISO 42001:2023',
];

interface FormState {
  organizationName: string;
  contactPerson: string;
  email: string;
  phone: string;
  address: string;
  standard: string;
  clientType: string;
  status: string;
  username: string;
  password: string;
}

const getDefaultClientType = (): string => {
  const types = getAuditTypeNames();
  return types.length > 0 ? types[0] : 'Initial Certification';
};

const blankForm = (): FormState => ({
  organizationName: '',
  contactPerson: '',
  email: '',
  phone: '',
  address: '',
  standard: 'ISO 9001:2015',
  clientType: getDefaultClientType(),
  status: 'Pending',
  username: '',
  password: '',
});

const ClientCredentials: React.FC = () => {
  const auditTypeNames = useMemo(() => getAuditTypeNames(), []);
  const [creds, setCreds] = useState<ClientCredential[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Active' | 'Locked'>('All');
  const [revealed, setRevealed] = useState<Record<number, boolean>>({});
  const [revealAll, setRevealAll] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingClientId, setEditingClientId] = useState<number | null>(null);
  const [form, setForm] = useState<FormState>(blankForm());
  const [formError, setFormError] = useState<string | null>(null);

  const isEditing = editingClientId !== null;

  // ---- Risk Radar (AI) ----------------------------------------------------
  const [risks, setRisks] = useState<ClientRiskEntry[]>([]);
  const [aiRiskText, setAiRiskText] = useState<string | null>(null);
  const [aiRiskBusy, setAiRiskBusy] = useState(false);
  const [aiRiskErr, setAiRiskErr] = useState<string | null>(null);

  const runRiskRadar = () => {
    setRisks(buildRiskRadar());
    setAiRiskText(null);
    setAiRiskErr(null);
  };

  useEffect(() => {
    runRiskRadar();
    const off = onCmsChange(runRiskRadar);
    return off;
  }, []);

  const enhanceRiskRadar = async () => {
    if (risks.length === 0 || aiRiskBusy) return;
    setAiRiskBusy(true);
    setAiRiskErr(null);
    const res = await claudeComplete(riskRadarClaudePrompt(risks), { maxTokens: 400 });
    setAiRiskBusy(false);
    if (res.ok) setAiRiskText(res.text);
    else setAiRiskErr(res.error);
  };

  const refresh = () => setCreds(readCredentials());

  const loadAll = () => {
    try {
      const raw = localStorage.getItem('cms_client_registrations');
      if (raw) ensureCredentialsForClients(JSON.parse(raw));
    } catch { /* ignore */ }
    refresh();
  };

  useEffect(() => {
    loadAll();
    const onUpdate = () => refresh();
    window.addEventListener('client-credentials-updated', onUpdate);
    window.addEventListener('client-registrations-updated', onUpdate);
    return () => {
      window.removeEventListener('client-credentials-updated', onUpdate);
      window.removeEventListener('client-registrations-updated', onUpdate);
    };
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2200);
    return () => clearTimeout(t);
  }, [toast]);

  const showToast = (msg: string) => setToast(msg);

  // ---- Modal helpers ------------------------------------------------------
  const openCreate = () => {
    setEditingClientId(null);
    setForm(blankForm());
    setFormError(null);
    setModalOpen(true);
  };

  const openEdit = (clientId: number) => {
    const cred = readCredentials().find((c) => c.clientId === clientId);
    const client = getClientById(clientId);
    if (!cred) return;
    setEditingClientId(clientId);
    setForm({
      organizationName: client?.organizationName ?? cred.organizationName,
      contactPerson: client?.contactPerson ?? cred.contactPerson,
      email: client?.email ?? cred.email,
      phone: client?.phone ?? '',
      address: client?.address ?? '',
      standard: client?.standard ?? 'ISO 9001:2015',
      clientType: client?.clientType ?? 'Initial Audit',
      status: client?.status ?? 'Pending',
      username: cred.username,
      password: cred.password,
    });
    setFormError(null);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setFormError(null);
  };

  const handleFormChange = (field: keyof FormState, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.organizationName.trim()) {
      setFormError('Organization name is required.');
      return;
    }
    if (!form.contactPerson.trim()) {
      setFormError('Contact person is required.');
      return;
    }
    if (!form.email.trim()) {
      setFormError('Email is required.');
      return;
    }

    if (
      form.username.trim() &&
      isUsernameTaken(form.username.trim(), editingClientId ?? undefined)
    ) {
      setFormError('That username is already taken by another client.');
      return;
    }

    if (isEditing && editingClientId !== null) {
      updateClientAndCredential(
        editingClientId,
        {
          organizationName: form.organizationName,
          contactPerson: form.contactPerson,
          email: form.email,
          phone: form.phone,
          address: form.address,
          standard: form.standard,
          clientType: form.clientType,
          status: form.status,
        },
        {
          username: form.username,
          password: form.password,
        }
      );
      showToast('Client updated');
    } else {
      const { credential } = addClient(
        {
          organizationName: form.organizationName,
          contactPerson: form.contactPerson,
          email: form.email,
          phone: form.phone,
          address: form.address,
          standard: form.standard,
          clientType: form.clientType,
          status: form.status,
        },
        {
          username: form.username,
          password: form.password,
        }
      );
      // Reveal the new credential's password automatically so Management can
      // copy it right away.
      setRevealed((prev) => ({ ...prev, [credential.clientId]: true }));
      showToast(`Client created — username "${credential.username}"`);
    }

    refresh();
    closeModal();
  };

  const onDelete = (clientId: number, name: string) => {
    if (!window.confirm(`Delete "${name}"? Their login credentials will also be removed.`)) return;
    if (deleteClient(clientId)) {
      refresh();
      showToast('Client deleted');
    }
  };

  // ---- Existing actions ---------------------------------------------------
  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return creds.filter((c) => {
      if (statusFilter !== 'All' && c.status !== statusFilter) return false;
      if (!q) return true;
      return (
        c.organizationName.toLowerCase().includes(q) ||
        c.contactPerson.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q) ||
        c.username.toLowerCase().includes(q)
      );
    });
  }, [creds, search, statusFilter]);

  const stats = useMemo(() => {
    const active = creds.filter((c) => c.status === 'Active').length;
    const locked = creds.length - active;
    return { total: creds.length, active, locked };
  }, [creds]);

  const isRevealed = (id: number) => revealAll || revealed[id];

  const toggleReveal = (id: number) =>
    setRevealed((prev) => ({ ...prev, [id]: !prev[id] }));

  const copy = (text: string, label: string) => {
    try {
      navigator.clipboard.writeText(text);
      showToast(`${label} copied`);
    } catch {
      showToast('Could not copy');
    }
  };

  const onReset = (id: number) => {
    if (!window.confirm('Generate a new password for this client? They will need the new password to log in.')) return;
    const updated = resetCredential(id);
    if (updated) {
      refresh();
      setRevealed((prev) => ({ ...prev, [id]: true }));
      showToast('Password reset');
    }
  };

  const onLockToggle = (id: number) => {
    const updated = toggleLockCredential(id);
    if (updated) {
      refresh();
      showToast(updated.status === 'Active' ? 'Account unlocked' : 'Account locked');
    }
  };

  const exportCsv = () => {
    const all = readCredentials();
    const clients: Record<number, ClientRecord | undefined> = {};
    getAllClients().forEach((c) => { clients[c.id] = c; });
    const header = ['Client ID', 'Organization', 'Contact', 'Email', 'Phone', 'Standard', 'Type', 'Username', 'Password', 'Status', 'Created'];
    const rows = all.map((c) => {
      const ext = clients[c.clientId];
      return [
        c.clientId,
        c.organizationName,
        c.contactPerson,
        c.email,
        ext?.phone ?? '',
        ext?.standard ?? '',
        ext?.clientType ?? '',
        c.username,
        c.password,
        c.status,
        c.createdAt,
      ];
    });
    const csv = [header, ...rows]
      .map((row) =>
        row
          .map((cell) => {
            const v = String(cell ?? '');
            return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
          })
          .join(',')
      )
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `client-credentials-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('CSV downloaded');
  };

  // ---- Render -------------------------------------------------------------
  return (
    <div className="cred-page">
      {/* Hero */}
      <div className="cred-hero">
        <div className="cred-hero-text">
          <div className="cred-hero-badge">
            <ShieldCheck size={14} /> Management View
          </div>
          <h1>
            <KeyRound size={28} /> Client Credentials
          </h1>
          <p>
            Login credentials issued to every registered client. Each client uses
            these to sign in as the <strong>Auditee</strong> role. Add new clients
            and manage their accounts directly from this page.
          </p>
        </div>
        <div className="cred-hero-stats">
          <div className="cred-stat">
            <div className="cred-stat-icon" style={{ background: 'rgba(99,102,241,.1)', color: '#4f46e5' }}>
              <Users size={20} />
            </div>
            <div>
              <div className="cred-stat-value">{stats.total}</div>
              <div className="cred-stat-label">Total Clients</div>
            </div>
          </div>
          <div className="cred-stat">
            <div className="cred-stat-icon" style={{ background: 'rgba(16,185,129,.12)', color: '#047857' }}>
              <CheckCircle2 size={20} />
            </div>
            <div>
              <div className="cred-stat-value">{stats.active}</div>
              <div className="cred-stat-label">Active</div>
            </div>
          </div>
          <div className="cred-stat">
            <div className="cred-stat-icon" style={{ background: 'rgba(239,68,68,.10)', color: '#b91c1c' }}>
              <Lock size={20} />
            </div>
            <div>
              <div className="cred-stat-value">{stats.locked}</div>
              <div className="cred-stat-label">Locked</div>
            </div>
          </div>
        </div>
      </div>

      {/* Risk Radar — per-client risk scored live from cms_* stores */}
      <AIPanel
        title="Client Risk Radar"
        subtitle="0-100 risk score per client from expiries, open NCs, closure speed and stalled schedules"
        onRefresh={runRiskRadar}
      >
        {risks.length === 0 ? (
          <p className="ai-panel-note">No client records found in live data yet.</p>
        ) : (
          <>
            {aiRiskText && (
              <p style={{ margin: '0 0 6px', fontSize: 13, lineHeight: 1.6, color: '#334155' }}>{aiRiskText}</p>
            )}
            <ul className="ai-insight-list">
              {risks.slice(0, 8).map((r) => (
                <li key={r.client}>
                  <span className={`ai-chip ${r.level}`}>{r.score}</span>
                  <span><strong>{r.client}</strong> — {r.reason}</span>
                </li>
              ))}
            </ul>
            {risks.length > 8 && (
              <p className="ai-panel-note">Showing the top 8 of {risks.length} clients, ranked by risk score.</p>
            )}
            {isClaudeConfigured() && !aiRiskText && (
              <button type="button" className="ai-action-btn" onClick={enhanceRiskRadar} disabled={aiRiskBusy} style={{ marginTop: 10 }}>
                {aiRiskBusy ? 'Enhancing…' : 'Enhance with Claude'}
              </button>
            )}
            {aiRiskErr && <p className="ai-panel-note">Claude enhancement failed: {aiRiskErr} — heuristic ranking shown above.</p>}
          </>
        )}
      </AIPanel>

      {/* Toolbar */}
      <div className="cred-toolbar">
        <div className="cred-search">
          <Search size={16} />
          <input
            type="text"
            placeholder="Search by organization, contact, email, or username…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="cred-filter-pills">
          {(['All', 'Active', 'Locked'] as const).map((s) => (
            <button
              key={s}
              className={`cred-pill ${statusFilter === s ? 'active' : ''}`}
              onClick={() => setStatusFilter(s)}
            >
              {s}
            </button>
          ))}
        </div>

        <div className="cred-toolbar-actions">
          <button
            className="cred-btn cred-btn-ghost"
            onClick={() => setRevealAll((v) => !v)}
            title={revealAll ? 'Hide all passwords' : 'Reveal all passwords'}
          >
            {revealAll ? <EyeOff size={16} /> : <Eye size={16} />}
            {revealAll ? 'Hide All' : 'Reveal All'}
          </button>
          <button className="cred-btn cred-btn-ghost" onClick={exportCsv}>
            <Download size={16} /> Export CSV
          </button>
          <button className="cred-btn cred-btn-primary" onClick={openCreate}>
            <Plus size={16} /> Add New Client
          </button>
        </div>
      </div>

      {/* Card grid */}
      {visible.length === 0 ? (
        <div className="cred-grid-empty">
          <EmptyState
            variant="inline"
            title={creds.length === 0 ? 'No clients yet' : 'No matches'}
            description={creds.length === 0
              ? 'Click "Add New Client" above to register your first auditee and generate their login.'
              : `No clients match "${search}". Try a different keyword.`}
          />
        </div>
      ) : (
        <div className="cred-grid">
          {visible.map((c) => {
            const isActive = c.status === 'Active';
            return (
              <article
                key={c.clientId}
                className={'cred-card' + (isActive ? '' : ' is-locked')}
              >
                {/* Header band */}
                <header className="cred-card-head">
                  <div className="cred-card-avatar">
                    {(c.organizationName || '?').charAt(0).toUpperCase()}
                  </div>
                  <div className="cred-card-title">
                    <h3 title={c.organizationName}>{c.organizationName}</h3>
                    <div className="cred-card-sub">
                      <span>ID #{c.clientId}</span>
                    </div>
                  </div>
                  <label className={`cred-switch ${isActive ? 'is-active' : ''}`}>
                    <input
                      type="checkbox"
                      checked={isActive}
                      onChange={() => onLockToggle(c.clientId)}
                    />
                    <span className="cred-switch-track" aria-hidden="true" />
                    <span className="cred-switch-thumb" aria-hidden="true" />
                    <span className="cred-switch-label">{c.status}</span>
                  </label>
                </header>

                {/* Contact info */}
                <div className="cred-card-contact">
                  <div className="cred-card-line" title={c.contactPerson || ''}>
                    <Users size={14} />
                    <span>{c.contactPerson || '—'}</span>
                  </div>
                  <div className="cred-card-line" title={c.email || ''}>
                    <Mail size={14} />
                    <span className="cred-mono">{c.email || '—'}</span>
                  </div>
                </div>

                {/* Credentials block */}
                <div className="cred-card-creds">
                  <div className="cred-card-field">
                    <label>Username</label>
                    <div className="cred-card-input">
                      <span className="cred-mono">{c.username}</span>
                      <button
                        className="cred-icon-btn"
                        onClick={() => copy(c.username, 'Username')}
                        title="Copy username"
                      >
                        <Copy size={14} />
                      </button>
                    </div>
                  </div>
                  <div className="cred-card-field">
                    <label>Password</label>
                    <div className="cred-card-input">
                      <span className="cred-mono cred-pass">
                        {isRevealed(c.clientId) ? c.password : '••••••••••'}
                      </span>
                      <button
                        className="cred-icon-btn"
                        onClick={() => toggleReveal(c.clientId)}
                        title={isRevealed(c.clientId) ? 'Hide' : 'Reveal'}
                      >
                        {isRevealed(c.clientId) ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                      <button
                        className="cred-icon-btn"
                        onClick={() => copy(c.password, 'Password')}
                        title="Copy password"
                      >
                        <Copy size={14} />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Footer actions */}
                <footer className="cred-card-actions">
                  <button
                    className="cred-action-btn edit"
                    onClick={() => openEdit(c.clientId)}
                    title="Edit client details and credentials"
                  >
                    <Edit2 size={14} /> Edit
                  </button>
                  <button
                    className="cred-action-btn reset"
                    onClick={() => onReset(c.clientId)}
                    title="Generate a new password"
                  >
                    <RefreshCw size={14} /> Reset
                  </button>
                  <button
                    className="cred-action-btn delete"
                    onClick={() => onDelete(c.clientId, c.organizationName)}
                    title="Delete client"
                  >
                    <Trash2 size={14} /> Delete
                  </button>
                </footer>
              </article>
            );
          })}
        </div>
      )}

      <div className="cred-help">
        <ShieldCheck size={16} />
        <span>
          Clients log in from the main login page using either their <strong>username</strong> or
          <strong> email</strong> together with their password. They are signed in as the
          <strong> Auditee</strong> role and routed to their client portal.
        </span>
      </div>

      {/* Modal */}
      {modalOpen && (
        <div className="cred-modal-backdrop" onClick={closeModal}>
          <div
            className="cred-modal"
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="cred-modal-header">
              <div>
                <h2>
                  {isEditing ? <Edit2 size={20} /> : <Plus size={20} />}
                  {isEditing ? 'Edit Client' : 'Add New Client'}
                </h2>
                <p>
                  {isEditing
                    ? 'Update the client details and login credentials.'
                    : 'Create a new client. A username and password will be generated automatically — or set your own below.'}
                </p>
              </div>
              <button className="cred-modal-close" onClick={closeModal}>
                <X size={18} />
              </button>
            </div>

            <form className="cred-modal-form" onSubmit={handleSubmit}>
              <div className="cred-form-section">
                <div className="cred-section-title">
                  <Building2 size={14} /> Organization
                </div>
                <div className="cred-form-row">
                  <div className="cred-field">
                    <label>Organization Name <span className="req">*</span></label>
                    <input
                      type="text"
                      value={form.organizationName}
                      onChange={(e) => handleFormChange('organizationName', e.target.value)}
                      placeholder="e.g. Green Energy Solutions"
                    />
                  </div>
                  <div className="cred-field">
                    <label>Contact Person <span className="req">*</span></label>
                    <input
                      type="text"
                      value={form.contactPerson}
                      onChange={(e) => handleFormChange('contactPerson', e.target.value)}
                      placeholder="e.g. John Doe"
                    />
                  </div>
                </div>

                <div className="cred-form-row">
                  <div className="cred-field">
                    <label><Mail size={12} /> Email <span className="req">*</span></label>
                    <input
                      type="email"
                      value={form.email}
                      onChange={(e) => handleFormChange('email', e.target.value)}
                      placeholder="contact@company.com"
                    />
                  </div>
                  <div className="cred-field">
                    <label><Phone size={12} /> Phone</label>
                    <input
                      type="text"
                      value={form.phone}
                      onChange={(e) => handleFormChange('phone', e.target.value)}
                      placeholder="9876543210"
                    />
                  </div>
                </div>

                <div className="cred-field">
                  <label><MapPin size={12} /> Address</label>
                  <input
                    type="text"
                    value={form.address}
                    onChange={(e) => handleFormChange('address', e.target.value)}
                    placeholder="Street, City, Country"
                  />
                </div>
              </div>

              <div className="cred-form-section">
                <div className="cred-section-title">Audit Details</div>
                <div className="cred-form-row">
                  <div className="cred-field">
                    <label>Standard</label>
                    <select
                      value={form.standard}
                      onChange={(e) => handleFormChange('standard', e.target.value)}
                    >
                      {STANDARDS.map((s) => <option key={s}>{s}</option>)}
                    </select>
                  </div>
                  <div className="cred-field">
                    <label>Client Type</label>
                    <select
                      value={form.clientType}
                      onChange={(e) => handleFormChange('clientType', e.target.value)}
                    >
                      {auditTypeNames.map((t) => <option key={t}>{t}</option>)}
                    </select>
                  </div>
                  <div className="cred-field">
                    <label>Status</label>
                    <select
                      value={form.status}
                      onChange={(e) => handleFormChange('status', e.target.value)}
                    >
                      <option>Pending</option>
                      <option>Registered</option>
                      <option>Client Approved</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="cred-form-section">
                <div className="cred-section-title">
                  <KeyRound size={14} /> Login Credentials
                  <span className="cred-section-hint">
                    {isEditing
                      ? 'Leave fields unchanged to keep current values.'
                      : 'Optional — leave blank to auto-generate.'}
                  </span>
                </div>
                <div className="cred-form-row">
                  <div className="cred-field">
                    <label>Username</label>
                    <input
                      type="text"
                      value={form.username}
                      onChange={(e) => handleFormChange('username', e.target.value)}
                      placeholder={isEditing ? '' : 'Auto-generated from email/organization'}
                    />
                  </div>
                  <div className="cred-field">
                    <label>Password</label>
                    <div className="cred-pass-input">
                      <input
                        type="text"
                        value={form.password}
                        onChange={(e) => handleFormChange('password', e.target.value)}
                        placeholder={isEditing ? '' : 'Auto-generated strong password'}
                      />
                      <button
                        type="button"
                        className="cred-icon-btn"
                        title="Generate strong password"
                        onClick={() => {
                          // Simple inline strong password — same character recipe.
                          const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
                          const lower = 'abcdefghijkmnpqrstuvwxyz';
                          const digits = '23456789';
                          const symbols = '!@#$%&*';
                          const pick = (s: string) => s[Math.floor(Math.random() * s.length)];
                          const body = [
                            pick(upper),
                            pick(lower), pick(lower), pick(lower), pick(lower), pick(lower),
                            pick(digits), pick(digits),
                            pick(symbols), pick(symbols),
                          ];
                          const head = body[0];
                          const tail = body.slice(1);
                          for (let i = tail.length - 1; i > 0; i--) {
                            const j = Math.floor(Math.random() * (i + 1));
                            [tail[i], tail[j]] = [tail[j], tail[i]];
                          }
                          handleFormChange('password', head + tail.join(''));
                        }}
                      >
                        <Sparkles size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {formError && <div className="cred-form-error">{formError}</div>}

              <div className="cred-modal-footer">
                <button type="button" className="cred-btn cred-btn-ghost" onClick={closeModal}>
                  Cancel
                </button>
                <button type="submit" className="cred-btn cred-btn-primary">
                  <Save size={16} />
                  {isEditing ? 'Submit' : 'Add'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ClientCredentials;
