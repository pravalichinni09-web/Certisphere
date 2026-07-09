/**
 * Auditor → Audit Report
 *
 * Draft + submit the audit report for an audit the auditor has just
 * completed. Reads findings from `cms_audit_findings_v1`, lets the
 * auditor compose the summary + conclusion, and writes the report to
 * `cms_audit_reports_v1[clientId]`. Submission advances the workflow
 * to "Review and Approval by Auditor".
 */
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, FileText, Send, Save } from 'lucide-react';
import { readWorkflows, WorkflowRecord } from '../../utils/auditWorkflow';
import { approveActionItems } from '../../services/workflowHandoff';
import {
  AuditReportRecord,
  AUDIT_REPORTS_UPDATED_EVENT,
  loadAuditReports,
  upsertAuditReport,
} from '../../services/auditReports';
import AIPanel from '../../components/AIPanel';
import { summarizeEvidence, EvidenceSummary } from '../../ai/auditorInsights';

interface Finding { id: string; severity: string; clause: string; description: string; evidence: string; createdAt: string; }
type Report = AuditReportRecord;

const FINDINGS_KEY = 'cms_audit_findings_v1';

const safeJSON = <T,>(k: string, fb: T): T => {
  try { const r = localStorage.getItem(k); return r ? JSON.parse(r) as T : fb; } catch { return fb; }
};
const writeReport = (clientId: number, report: Report) => {
  // Saves to shared `cms_audit_reports_v1` and dispatches 'cms-audit-reports-updated'.
  upsertAuditReport(clientId, report);
  window.dispatchEvent(new CustomEvent('cms-workflow-handoff'));
};
const readReport = (clientId: number): Report | null =>
  loadAuditReports()[String(clientId)] || null;

const AuditReport: React.FC = () => {
  const navigate = useNavigate();
  const [workflows, setWorkflows] = useState<WorkflowRecord[]>(() => readWorkflows());
  const [selected, setSelected] = useState<number | null>(null);
  const [form, setForm] = useState<Report>({
    summary: '', scope: '', conclusion: '',
    recommendation: 'Recommend certification',
    draftedAt: '', draftedBy: 'Auditor',
  });

  // --- AI Evidence Summarizer (feature 14) ---
  const [evidenceText, setEvidenceText] = useState('');
  const [evSummary, setEvSummary] = useState<EvidenceSummary | null>(null);

  useEffect(() => {
    const refresh = () => setWorkflows(readWorkflows());
    window.addEventListener('cms-workflow-handoff', refresh);
    window.addEventListener('audit-workflow-updated', refresh);
    return () => {
      window.removeEventListener('cms-workflow-handoff', refresh);
      window.removeEventListener('audit-workflow-updated', refresh);
    };
  }, []);

  useEffect(() => {
    if (selected != null) {
      const r = readReport(selected);
      if (r) setForm(r);
      else setForm({ summary: '', scope: '', conclusion: '', recommendation: 'Recommend certification', draftedAt: '', draftedBy: 'Auditor' });
    }
  }, [selected]);

  // Live-refresh the open report when another role updates the shared key.
  useEffect(() => {
    const refresh = () => {
      if (selected != null) {
        const r = readReport(selected);
        if (r) setForm(r);
      }
    };
    window.addEventListener(AUDIT_REPORTS_UPDATED_EVENT, refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener(AUDIT_REPORTS_UPDATED_EVENT, refresh);
      window.removeEventListener('storage', refresh);
    };
  }, [selected]);

  const clients = safeJSON<any[]>('cms_client_registrations', []);
  const labelFor = (id: number) => {
    const c = clients.find((x) => Number(x.id) === Number(id));
    return c ? (c.organizationName || c.name || `Client #${id}`) : `Client #${id}`;
  };

  const eligible = useMemo(() => workflows.filter((w) =>
    w.currentStage === 'Audit Completed' ||
    w.currentStage === 'Audit findings' ||
    w.currentStage === 'Action items released to Auditor' ||
    w.currentStage === 'Review and Approval by Auditor'
  ), [workflows]);

  const findings = selected != null ? (safeJSON<Record<string, Finding[]>>(FINDINGS_KEY, {})[String(selected)] || []) : [];
  const sev = (s: string) => findings.filter((f) => f.severity === s).length;

  const saveDraft = () => {
    if (selected == null) return;
    writeReport(selected, {
      ...form,
      draftedAt: new Date().toISOString(),
      status: form.status ?? (form.submittedAt ? 'Submitted' : 'Draft'),
      source: form.source ?? 'Auditor',
      clientName: labelFor(selected),
    });
    alert('Draft saved.');
  };
  const submit = () => {
    if (selected == null) return;
    if (!form.summary.trim() || !form.conclusion.trim()) { alert('Summary and conclusion are required.'); return; }
    const report: Report = {
      ...form,
      draftedAt: new Date().toISOString(),
      submittedAt: new Date().toISOString(),
      status: 'Submitted',
      source: 'Auditor',
      clientName: labelFor(selected),
    };
    writeReport(selected, report);
    approveActionItems(selected, 'Auditor', `Audit report submitted (${form.recommendation}).`);
    alert('Report submitted to Lead Auditor for review.');
  };

  return (
    <div style={{ padding: '20px', maxWidth: 1200, margin: '0 auto' }}>
      <button onClick={() => navigate('/auditor/dashboard')} style={btnGhost}>
        <ArrowLeft size={14} /> Back
      </button>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 12 }}>
        <div style={{ background: '#fef3c7', color: '#a16207', width: 40, height: 40, borderRadius: 10, display: 'grid', placeItems: 'center' }}><FileText size={22} /></div>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#0f172a' }}>Audit Report</h1>
          <p style={{ margin: 0, color: '#64748b', fontSize: 14 }}>Compose the report from findings and submit to the Lead Auditor.</p>
        </div>
      </div>

      {/* AI Evidence Summarizer */}
      <AIPanel
        title="Evidence Summarizer"
        subtitle="Paste evidence text to extract dates, quantities and document names"
        defaultCollapsed
      >
        <textarea
          value={evidenceText}
          onChange={(e) => setEvidenceText(e.target.value)}
          rows={4}
          placeholder="Paste evidence text (interview notes, record extracts, email trails)…"
          style={{ ...inp, resize: 'vertical' }}
        />
        <button
          className="ai-action-btn"
          disabled={!evidenceText.trim()}
          onClick={() => setEvSummary(summarizeEvidence(evidenceText))}
        >
          Summarise evidence
        </button>
        {evSummary && (
          <div style={{ marginTop: 10, fontSize: 12.5 }}>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
              {evSummary.dates.map((d) => <span key={'d' + d} className="ai-chip info">{d}</span>)}
              {evSummary.quantities.map((q) => <span key={'q' + q} className="ai-chip med">{q}</span>)}
              {evSummary.documents.map((doc) => <span key={'f' + doc} className="ai-chip ok">{doc}</span>)}
            </div>
            <p style={{ margin: 0 }}><strong>Condensed evidence note:</strong> {evSummary.summary}</p>
            {selected != null && (
              <button
                className="ai-action-btn"
                onClick={() => setForm((f) => ({ ...f, summary: (f.summary ? f.summary + '\n\n' : '') + 'Evidence note: ' + evSummary.summary }))}
              >
                Append to executive summary
              </button>
            )}
          </div>
        )}
        <p className="ai-panel-note">Extraction is heuristic — verify names and figures before submitting the report.</p>
      </AIPanel>

      <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 12, marginTop: 16 }}>
        <aside style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 10, maxHeight: '70vh', overflow: 'auto' }}>
          {eligible.length === 0 ? (
            <p style={{ color: '#64748b', fontSize: 13, textAlign: 'center', padding: 12 }}>No audits eligible for a report yet.</p>
          ) : eligible.map((w) => {
            const active = selected === w.clientId;
            return (
              <button key={w.clientId} onClick={() => setSelected(w.clientId)} style={{
                width: '100%', textAlign: 'left',
                background: active ? '#fef3c7' : '#fff',
                border: '1px solid ' + (active ? '#a16207' : '#e2e8f0'),
                color: '#0f172a', borderRadius: 8, padding: 10, marginBottom: 6, cursor: 'pointer',
              }}>
                <div style={{ fontSize: 13, fontWeight: 700 }}>{labelFor(w.clientId)}</div>
                <div style={{ fontSize: 11, color: '#64748b' }}>{w.currentStage}</div>
              </button>
            );
          })}
        </aside>

        <main style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 16 }}>
          {selected == null ? (
            <p style={{ color: '#64748b', fontSize: 13, textAlign: 'center', padding: 40 }}>Pick an audit on the left.</p>
          ) : (
            <>
              <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>{labelFor(selected)}</h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, margin: '10px 0' }}>
                <Stat label="Findings" value={findings.length} bg="#f1f5f9" fg="#0f172a" />
                <Stat label="Major NCs" value={sev('Major NC')} bg="#fee2e2" fg="#b91c1c" />
                <Stat label="Minor NCs" value={sev('Minor NC')} bg="#fed7aa" fg="#9a3412" />
                <Stat label="Observations" value={sev('Observation')} bg="#fef3c7" fg="#a16207" />
              </div>
              <Field label="Scope audited" full>
                <textarea value={form.scope} onChange={(e) => setForm({ ...form, scope: e.target.value })} rows={2} style={inp} />
              </Field>
              <Field label="Executive summary" full>
                <textarea value={form.summary} onChange={(e) => setForm({ ...form, summary: e.target.value })} rows={4} style={inp} placeholder="Audit scope, sites visited, key strengths, areas of concern…" />
              </Field>
              <Field label="Conclusion" full>
                <textarea value={form.conclusion} onChange={(e) => setForm({ ...form, conclusion: e.target.value })} rows={3} style={inp} placeholder="Did the auditee meet the standard? Any conditions?" />
              </Field>
              <Field label="Recommendation" full>
                <select value={form.recommendation} onChange={(e) => setForm({ ...form, recommendation: e.target.value as Report['recommendation'] })} style={inp}>
                  <option>Recommend certification</option>
                  <option>Recommend with conditions</option>
                  <option>Not recommended</option>
                </select>
              </Field>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6, marginTop: 12 }}>
                <button onClick={saveDraft} style={btnGhost}><Save size={13} /> Save draft</button>
                <button onClick={submit} style={btnPrimary}><Send size={13} /> Submit to Lead Auditor</button>
              </div>
              {form.submittedAt && (
                <p style={{ marginTop: 8, fontSize: 12, color: '#15803d' }}>
                  ✔ Report submitted on {new Date(form.submittedAt).toLocaleString()}.
                </p>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
};

const Stat: React.FC<{ label: string; value: number; bg: string; fg: string }> = ({ label, value, bg, fg }) => (
  <div style={{ background: bg, padding: 10, borderRadius: 8 }}>
    <div style={{ fontSize: 11, color: fg, fontWeight: 700, textTransform: 'uppercase' }}>{label}</div>
    <div style={{ fontSize: 18, fontWeight: 800, color: fg }}>{value}</div>
  </div>
);
const Field: React.FC<{ label: string; full?: boolean; children: React.ReactNode }> = ({ label, full, children }) => (
  <label style={{ gridColumn: full ? 'span 2' : undefined, display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 8 }}>
    <span style={{ fontSize: 12, color: '#475569', fontWeight: 600 }}>{label}</span>
    {children}
  </label>
);
const inp: React.CSSProperties = { width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 13, outline: 'none', fontFamily: 'inherit' };
const btnGhost: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 6, background: '#fff', border: '1px solid #cbd5e1', color: '#475569', padding: '6px 12px', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer' };
const btnPrimary: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 4, background: '#0e7490', color: '#fff', border: 'none', padding: '7px 12px', borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: 'pointer' };

export default AuditReport;
