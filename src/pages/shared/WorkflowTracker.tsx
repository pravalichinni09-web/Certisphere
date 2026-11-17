/**
 * Workflow Tracker — watch every client move through the 14 stages, by hand.
 * ----------------------------------------------------------------------
 * One row per client: current step, who must act next and on which screen,
 * days at this step (late ones in red), coordinator, audit team, audit date.
 * Click a client to see its full history (every step, who did it, when).
 * Read-only: nothing here changes data. Updates live when anyone acts.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Workflow, Search, ChevronDown, ChevronRight, AlertTriangle, CheckCircle2, Download } from 'lucide-react';
import { workflowClients, certificateDataFor, type WfClient } from '../../ai/workflowAI';
import { viewCertificatePdf, downloadCertificatePdf } from '../../lib/certificatePdf';
import { FLOW } from '../../ai/certisphereGuide';
import ClientApplicationBox from '../../components/ClientApplicationBox';

const fmt = (iso?: string) => { if (!iso) return '—'; const d = new Date(iso); return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' }); };
const fmtTime = (iso?: string) => { if (!iso) return ''; const d = new Date(iso); return Number.isNaN(d.getTime()) ? '' : d.toLocaleString(undefined, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }); };

const WorkflowTracker: React.FC<{ title?: string }> = ({ title = 'Workflow Tracker' }) => {
  const navigate = useNavigate();
  const [tick, setTick] = useState(0);
  const [q, setQ] = useState('');
  const [stage, setStage] = useState<string>('All');
  const [open, setOpen] = useState<number | null>(null);

  useEffect(() => {
    const r = () => setTick((t) => t + 1);
    const ev = ['storage', 'cms-workflow-handoff', 'audit-workflow-updated'];
    ev.forEach((e) => window.addEventListener(e, r));
    return () => ev.forEach((e) => window.removeEventListener(e, r));
  }, []);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const all = useMemo(() => workflowClients().sort((a, b) => a.stageNo - b.stageNo || a.name.localeCompare(b.name)), [tick]);
  const rows = all.filter((c) => (stage === 'All' || c.wf.currentStage === stage) && (!q || c.name.toLowerCase().includes(q.toLowerCase())));
  const late = all.filter((c) => c.overdue).length;
  const done = all.filter((c) => c.wf.currentStage === 'Certification released').length;

  const card: React.CSSProperties = { background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, color: '#0f172a' };
  const th: React.CSSProperties = { textAlign: 'left', padding: '10px 12px', fontSize: 12, fontWeight: 700, color: '#475569', background: '#f8fafc', whiteSpace: 'nowrap' };
  const td: React.CSSProperties = { padding: '10px 12px', fontSize: 13, verticalAlign: 'top', borderTop: '1px solid #f1f5f9' };

  const next = (c: WfClient) => FLOW[c.stageNo - 1]?.who || [];

  return (
    <div style={{ padding: 24, maxWidth: 1300, margin: '0 auto', display: 'grid', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 44, height: 44, borderRadius: 12, background: '#eef2ff', display: 'grid', placeItems: 'center' }}><Workflow size={22} color="#4338ca" /></div>
        <div>
          <h1 style={{ margin: 0, fontSize: 24 }}>{title}</h1>
          <p style={{ margin: '2px 0 0', color: '#64748b', fontSize: 13 }}>Every client, its current step of 14, who must act next, and how long it has been waiting.</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10 }}>
        {[['Clients', all.length, '#1d4ed8'], ['In progress', all.length - done, '#7c3aed'], ['Certified', done, '#047857'], ['Late', late, late ? '#b91c1c' : '#475569']].map(([l, v, c]) => (
          <div key={String(l)} style={{ ...card, padding: '12px 14px' }}>
            <div style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>{l}</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: String(c) }}>{v}</div>
          </div>
        ))}
      </div>

      {/* stage chips */}
      <div style={{ ...card, padding: 12, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        <button type="button" onClick={() => setStage('All')} style={chip(stage === 'All')}>All stages · {all.length}</button>
        {FLOW.map((f, i) => {
          const n = all.filter((c) => c.wf.currentStage === f.stage).length;
          return <button key={f.stage} type="button" onClick={() => setStage(f.stage)} style={chip(stage === f.stage, n === 0)}>{i + 1}. {f.stage} · {n}</button>;
        })}
      </div>

      <div style={{ ...card, overflowX: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', borderBottom: '1px solid #e2e8f0' }}>
          <Search size={15} color="#64748b" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search client…" style={{ border: 'none', outline: 'none', fontSize: 13, flex: 1, background: 'transparent', color: '#0f172a' }} />
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 980 }}>
          <thead><tr>{['Client', 'Step', 'Waiting on (screen)', 'At this step', 'Coordinator', 'Audit team', 'Audit date'].map((h) => <th key={h} style={th}>{h}</th>)}</tr></thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={7} style={{ ...td, color: '#64748b', textAlign: 'center', padding: 20 }}>No clients{stage !== 'All' ? ` at "${stage}"` : ''}.</td></tr>}
            {rows.map((c) => (
              <React.Fragment key={c.id}>
                <tr style={{ cursor: 'pointer', background: open === c.id ? '#f8fafc' : undefined }} onClick={() => setOpen(open === c.id ? null : c.id)} data-testid={`tracker-row-${c.id}`}>
                  <td style={td}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700 }}>{open === c.id ? <ChevronDown size={14} /> : <ChevronRight size={14} />}{c.name}</div>
                    <div style={{ fontSize: 12, color: '#64748b', paddingLeft: 20 }}>{c.standard || '—'}{c.flags.certificateNumber ? ` · ${c.flags.certificateNumber}` : ''}</div>
                  </td>
                  <td style={td}>
                    <div style={{ fontWeight: 700 }}>{c.stageNo}/14</div>
                    <div style={{ fontSize: 12, color: '#475569' }}>{c.wf.currentStage}</div>
                    <div style={{ height: 5, width: 110, background: '#e2e8f0', borderRadius: 3, marginTop: 4 }}><div style={{ height: 5, width: `${(c.stageNo / 14) * 100}%`, background: c.stageNo === 14 ? '#16a34a' : '#2563eb', borderRadius: 3 }} /></div>
                  </td>
                  <td style={td}>
                    {c.wf.currentStage === 'Certification released' && c.flags.deliveredAt
                      ? <span style={{ color: '#047857', fontWeight: 600 }}><CheckCircle2 size={13} style={{ verticalAlign: '-2px' }} /> Completed</span>
                      : next(c).map((w) => (
                        <div key={w.role + w.page} style={{ marginBottom: 3 }}>
                          <strong>{w.role}</strong> — {w.task}{' '}
                          {/^\//.test(w.path) && <button type="button" onClick={(e) => { e.stopPropagation(); navigate(w.path); }} style={{ border: 'none', background: 'transparent', color: '#1d4ed8', cursor: 'pointer', padding: 0, fontSize: 12, textDecoration: 'underline' }}>{w.page}</button>}
                        </div>
                      ))}
                  </td>
                  <td style={td}>
                    <span style={{ fontWeight: 700, color: c.overdue ? '#b91c1c' : '#0f172a' }}>{c.ageDays} day{c.ageDays === 1 ? '' : 's'}</span>
                    {c.overdue && <div style={{ fontSize: 11.5, color: '#b91c1c' }}><AlertTriangle size={11} style={{ verticalAlign: '-1px' }} /> late (target {c.sla})</div>}
                  </td>
                  <td style={td}>{c.wf.assignedCoordinator || '—'}</td>
                  <td style={td}>{[c.wf.schedule?.leadAuditor && `${c.wf.schedule.leadAuditor} (Lead)`, c.wf.schedule?.auditor].filter(Boolean).join(', ') || '—'}</td>
                  <td style={td}>{c.wf.schedule?.proposedDate ? <>{fmt(c.wf.schedule.proposedDate)}<div style={{ fontSize: 11.5, color: '#64748b' }}>{c.wf.schedule.decision || 'Pending'}</div></> : '—'}</td>
                </tr>
                {open === c.id && (
                  <tr><td colSpan={7} style={{ ...td, background: '#f8fafc' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
                      <div>
                        <strong style={{ fontSize: 13 }}>History</strong>
                        <ol style={{ margin: '6px 0 0', paddingLeft: 18, display: 'grid', gap: 4 }}>
                          {(c.wf.history || []).map((h, i) => (
                            <li key={i} style={{ fontSize: 12.5 }}><strong>{h.stage}</strong> — {h.by || 'System'} · {fmtTime(h.at)}{h.note ? <div style={{ color: '#64748b' }}>{h.note}</div> : null}</li>
                          ))}
                        </ol>
                      </div>
                      <div style={{ display: 'grid', gap: 8, alignContent: 'start', fontSize: 12.5 }}>
                        <ClientApplicationBox clientId={c.id} />
                        <div><strong>Requirements:</strong> {c.wf.requirements ? `${c.wf.requirements.scope || '—'} · ${(c.wf.requirements.standards || []).join(', ')}` : 'not reviewed yet'}</div>
                        <div><strong>Findings:</strong> {c.findings.length ? c.findings.map((f) => `${f.severity || 'Finding'}${f.clause ? ' ' + f.clause : ''}${f.correctiveAction ? ' ✓' : ''}`).join(' · ') : 'none recorded'}</div>
                        <div><strong>Certificate:</strong> {c.flags.certificateNumber ? `${c.flags.certificateNumber} (generated ${fmt(c.flags.certificateGeneratedAt)})` : 'not generated'}{c.flags.deliveredAt ? ` · delivered ${fmt(c.flags.deliveredAt)}` : ''}
                          {c.flags.certificateNumber && (() => { const cd = certificateDataFor(c.id); return cd ? (<>
                            <button type="button" onClick={(e) => { e.stopPropagation(); void viewCertificatePdf(cd); }} style={{ marginLeft: 8, fontSize: 12, fontWeight: 700, padding: '2px 8px', borderRadius: 7, border: '1px solid #16a34a', background: '#f0fdf4', color: '#166534', cursor: 'pointer' }}>View certificate</button>
                            <button type="button" title="Download certificate (PDF)" aria-label="Download certificate" data-testid={`tracker-download-${c.id}`} onClick={(e) => { e.stopPropagation(); void downloadCertificatePdf(cd); }} style={{ marginLeft: 6, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', verticalAlign: 'middle', width: 26, height: 22, borderRadius: 7, border: '1px solid #16a34a', background: '#f0fdf4', color: '#166534', cursor: 'pointer', padding: 0 }}><Download size={14} /></button></>) : null; })()}
                        </div>
                        <div><strong>Remaining steps:</strong> {14 - c.stageNo}</div>
                      </div>
                    </div>
                  </td></tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const chip = (active: boolean, empty = false): React.CSSProperties => ({
  padding: '5px 10px', borderRadius: 999, fontSize: 12, fontWeight: 600, cursor: 'pointer',
  border: `1px solid ${active ? '#2563eb' : '#e2e8f0'}`, background: active ? '#2563eb' : '#fff',
  color: active ? '#fff' : empty ? '#94a3b8' : '#334155',
});

export default WorkflowTracker;
