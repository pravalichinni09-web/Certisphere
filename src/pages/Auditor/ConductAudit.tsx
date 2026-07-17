/**
 * Auditor → Conduct Audit
 *
 * Run the on-site audit against the assigned checklist. The auditor:
 *   - Sees every workflow row currently at "Audit In Progress" (or just
 *     after they confirmed the schedule),
 *   - Logs findings + observations against the checklist,
 *   - Marks the audit complete when done.
 *
 * Findings are stored per-workflow under `cms_audit_findings_v1[clientId]`.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { predictSeverity } from '../../ai/models';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ClipboardCheck, PlayCircle, CheckCircle2, AlertOctagon, Plus, Trash2, Mic, MicOff } from 'lucide-react';
import { readWorkflows, WorkflowRecord } from '../../utils/auditWorkflow';
import { startAudit, completeAudit, releaseFindings } from '../../services/workflowHandoff';
import AIPanel from '../../components/AIPanel';
import { onCmsChange } from '../../ai/liveData';
import { loadChecklistDefs, explainQuestion, structureFinding, ChecklistDef } from '../../ai/auditorInsights';

type Severity = 'Major NC' | 'Minor NC' | 'Observation' | 'Opportunity';

interface Finding {
  id: string;
  severity: Severity;
  clause: string;
  description: string;
  evidence: string;
  createdAt: string;
}

const FINDINGS_KEY = 'cms_audit_findings_v1';

const SEVERITY_COLORS: Record<Severity, { bg: string; fg: string }> = {
  'Major NC':    { bg: '#fee2e2', fg: '#b91c1c' },
  'Minor NC':    { bg: '#fed7aa', fg: '#9a3412' },
  'Observation': { bg: '#fef3c7', fg: '#a16207' },
  'Opportunity': { bg: '#dbeafe', fg: '#1e40af' },
};

const safeJSON = <T,>(k: string, fb: T): T => {
  try { const r = localStorage.getItem(k); return r ? JSON.parse(r) as T : fb; } catch { return fb; }
};

const readFindings = (clientId: number): Finding[] => {
  const all = safeJSON<Record<string, Finding[]>>(FINDINGS_KEY, {});
  return all[String(clientId)] || [];
};
const writeFindings = (clientId: number, findings: Finding[]) => {
  const all = safeJSON<Record<string, Finding[]>>(FINDINGS_KEY, {});
  all[String(clientId)] = findings;
  localStorage.setItem(FINDINGS_KEY, JSON.stringify(all));
  window.dispatchEvent(new CustomEvent('cms-workflow-handoff'));
};

const ConductAudit: React.FC = () => {
  const navigate = useNavigate();
  const [workflows, setWorkflows] = useState<WorkflowRecord[]>(() => readWorkflows());
  const [selected, setSelected] = useState<number | null>(null);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [newF, setNewF] = useState<Omit<Finding, 'id' | 'createdAt'>>({ severity: 'Minor NC', clause: '', description: '', evidence: '' });

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
    if (selected != null) setFindings(readFindings(selected));
  }, [selected]);

  // --- AI Checklist Copilot (feature 12) ---
  const [checklists, setChecklists] = useState<ChecklistDef[]>(() => loadChecklistDefs());
  const [ckId, setCkId] = useState('');
  const [aiOpen, setAiOpen] = useState<Record<string, boolean>>({});
  const [qNotes, setQNotes] = useState<Record<string, string>>({});
  const [draftMsg, setDraftMsg] = useState('');
  useEffect(() => onCmsChange(() => setChecklists(loadChecklistDefs())), []);
  const activeChecklist = checklists.find((c) => String(c.id) === ckId) || checklists[0] || null;

  const draftFromNote = (qId: string, qText: string) => {
    const note = (qNotes[qId] || '').trim();
    if (!note) return;
    const sf = structureFinding(note, qText);
    setNewF({ severity: sf.nature, clause: sf.clause, description: sf.text, evidence: sf.evidence });
    setDraftMsg(`Draft loaded into the "Log a new finding" form below (suggested clause ${sf.clause}) — review and add it.`);
  };

  // --- Voice-to-Finding (feature 13) ---
  const recRef = useRef<any>(null);
  const transcriptRef = useRef('');
  const [listening, setListening] = useState(false);
  const voiceSupported = typeof window !== 'undefined' &&
    Boolean((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);

  const finalizeVoice = () => {
    const t = transcriptRef.current.trim();
    if (!t) return;
    const sf = structureFinding(t);
    setNewF((prev) => ({
      severity: sf.nature,
      clause: prev.clause.trim() || sf.clause,
      description: sf.text,
      evidence: prev.evidence.trim() || sf.evidence,
    }));
    setDraftMsg(`Dictation structured into a finding (suggested clause ${sf.clause}).`);
  };

  const startVoice = () => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;
    const rec = new SR();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = 'en-US';
    transcriptRef.current = '';
    rec.onresult = (e: any) => {
      let text = '';
      for (let i = 0; i < e.results.length; i++) text += e.results[i][0].transcript;
      transcriptRef.current = text;
      setNewF((prev) => ({ ...prev, description: text }));
    };
    rec.onend = () => { setListening(false); finalizeVoice(); };
    rec.onerror = () => setListening(false);
    recRef.current = rec;
    setListening(true);
    rec.start();
  };
  const stopVoice = () => { try { recRef.current?.stop(); } catch { /* ignore */ } };
  useEffect(() => () => { try { recRef.current?.stop(); } catch { /* ignore */ } }, []);

  const clients = safeJSON<any[]>('cms_client_registrations', []);
  const labelFor = (id: number) => {
    const c = clients.find((x) => Number(x.id) === Number(id));
    return c ? (c.organizationName || c.name || `Client #${id}`) : `Client #${id}`;
  };

  const myAudits = useMemo(() => {
    return workflows.filter((w) =>
      w.currentStage === 'Schedule Approved by Auditor' ||
      w.currentStage === 'Audit In Progress' ||
      w.currentStage === 'Audit Completed'
    );
  }, [workflows]);

  const sel = selected != null ? workflows.find((w) => w.clientId === selected) : null;

  const begin = () => { if (sel) startAudit(sel.clientId, 'Auditor'); };
  const complete = () => {
    if (!sel) return;
    completeAudit(sel.clientId, 'Auditor', 'Closing meeting concluded.');
    releaseFindings(sel.clientId, 'Auditor', `${findings.length} finding(s) released to auditee.`);
  };

  const addFinding = () => {
    if (!sel) return;
    if (!newF.clause.trim() || !newF.description.trim()) {
      alert('Clause and description are required.');
      return;
    }
    const f: Finding = { ...newF, id: 'f-' + Date.now(), createdAt: new Date().toISOString() };
    const next = [...findings, f];
    setFindings(next); writeFindings(sel.clientId, next);
    setNewF({ severity: 'Minor NC', clause: '', description: '', evidence: '' });
  };
  const removeFinding = (id: string) => {
    if (!sel) return;
    const next = findings.filter((x) => x.id !== id);
    setFindings(next); writeFindings(sel.clientId, next);
  };

  return (
    <div style={{ padding: '20px', maxWidth: 1200, margin: '0 auto' }}>
      <button onClick={() => navigate('/auditor/dashboard')} style={btnGhost}>
        <ArrowLeft size={14} /> Back
      </button>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 12 }}>
        <div style={{ background: '#eef2ff', color: '#4338ca', width: 40, height: 40, borderRadius: 10, display: 'grid', placeItems: 'center' }}><ClipboardCheck size={22} /></div>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#0f172a' }}>Conduct Audit</h1>
          <p style={{ margin: 0, color: '#64748b', fontSize: 14 }}>Pick a confirmed audit, log findings, then close out.</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 12, marginTop: 16 }}>
        {/* Picker */}
        <aside style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 10, maxHeight: '70vh', overflow: 'auto' }}>
          {myAudits.length === 0 ? (
            <p style={{ color: '#64748b', fontSize: 13, textAlign: 'center', padding: 12 }}>No assigned audits at this stage.</p>
          ) : myAudits.map((w) => {
            const active = selected === w.clientId;
            return (
              <button key={w.clientId} onClick={() => setSelected(w.clientId)} style={{
                width: '100%', textAlign: 'left',
                background: active ? '#eef2ff' : '#fff',
                border: '1px solid ' + (active ? '#4338ca' : '#e2e8f0'),
                color: '#0f172a', borderRadius: 8, padding: 10, marginBottom: 6, cursor: 'pointer',
              }}>
                <div style={{ fontSize: 13, fontWeight: 700 }}>{labelFor(w.clientId)}</div>
                <div style={{ fontSize: 11, color: '#64748b' }}>{w.currentStage}</div>
              </button>
            );
          })}
        </aside>

        {/* Workspace */}
        <main style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 16 }}>
          {!sel ? (
            <p style={{ color: '#64748b', fontSize: 13, textAlign: 'center', padding: 40 }}>Select an audit from the left to begin.</p>
          ) : (
            <>
              <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginBottom: 12 }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>{labelFor(sel.clientId)}</h2>
                  <div style={{ fontSize: 12, color: '#64748b' }}>Stage: {sel.currentStage}</div>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  {sel.currentStage === 'Schedule Approved by Auditor' && (
                    <button onClick={begin} style={btnPrimary}><PlayCircle size={13} /> Start audit</button>
                  )}
                  {sel.currentStage === 'Audit In Progress' && (
                    <button onClick={complete} style={btnGreen}><CheckCircle2 size={13} /> Close out + release findings</button>
                  )}
                </div>
              </header>

              {/* AI Checklist Copilot */}
              <AIPanel
                title="Checklist Copilot"
                subtitle="Question guidance, evidence to request, and one-click finding drafts"
                defaultCollapsed
                onRefresh={() => setChecklists(loadChecklistDefs())}
              >
                {!activeChecklist ? (
                  <p className="ai-panel-note">No audit checklists found — ask the Coordinator to publish one.</p>
                ) : (
                  <>
                    <select
                      value={String(activeChecklist.id)}
                      onChange={(e) => setCkId(e.target.value)}
                      style={{ ...inp, maxWidth: 340, marginBottom: 8 }}
                    >
                      {checklists.map((c) => (
                        <option key={String(c.id)} value={String(c.id)}>{c.name} ({c.standard})</option>
                      ))}
                    </select>
                    <ul className="ai-insight-list">
                      {activeChecklist.questions.map((q) => {
                        const open = !!aiOpen[q.id];
                        const help = open ? explainQuestion(q.text) : null;
                        return (
                          <li key={q.id}>
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                              <span style={{ flex: 1, fontSize: 12.5, fontWeight: 600 }}>{q.text}</span>
                              <button
                                className="ai-action-btn"
                                style={{ marginTop: 0, padding: '3px 10px' }}
                                onClick={() => setAiOpen((p) => ({ ...p, [q.id]: !p[q.id] }))}
                              >
                                AI
                              </button>
                            </div>
                            {open && help && (
                              <div style={{ marginTop: 6, fontSize: 12 }}>
                                <p style={{ margin: '0 0 4px' }}><strong>What it means:</strong> {help.meaning}</p>
                                <p style={{ margin: '0 0 6px' }}><strong>Evidence to request:</strong> {help.evidence.join('; ')}</p>
                                <textarea
                                  rows={2}
                                  placeholder="Short note from your interview / observation…"
                                  value={qNotes[q.id] || ''}
                                  onChange={(e) => setQNotes((p) => ({ ...p, [q.id]: e.target.value }))}
                                  style={{ ...inp, resize: 'vertical' }}
                                />
                                <button
                                  className="ai-action-btn"
                                  style={{ marginTop: 6 }}
                                  disabled={!(qNotes[q.id] || '').trim()}
                                  onClick={() => draftFromNote(q.id, q.text)}
                                >
                                  Draft finding
                                </button>
                              </div>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                    {draftMsg && <p className="ai-panel-note">{draftMsg}</p>}
                  </>
                )}
              </AIPanel>

              {/* Findings list */}
              <h3 style={{ margin: '14px 0 6px 0', fontSize: 13, color: '#475569', textTransform: 'uppercase', letterSpacing: 0.4 }}>
                Findings ({findings.length})
              </h3>
              {findings.length === 0 ? (
                <p style={{ color: '#94a3b8', fontSize: 12, padding: '8px 0' }}>No findings logged yet.</p>
              ) : (
                <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {findings.map((f) => {
                    const c = SEVERITY_COLORS[f.severity];
                    return (
                      <li key={f.id} style={{ padding: 10, border: '1px solid #e2e8f0', borderRadius: 8, background: '#fafafa' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ background: c.bg, color: c.fg, padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 700 }}>{f.severity}</span>
                          <strong style={{ fontSize: 13 }}>{f.clause}</strong>
                          <button onClick={() => removeFinding(f.id)} title="Remove" style={{ marginLeft: 'auto', background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}><Trash2 size={14} /></button>
                        </div>
                        <p style={{ margin: '6px 0 0', fontSize: 12, color: '#475569' }}><strong>Finding:</strong> {f.description}</p>
                        {f.evidence && <p style={{ margin: '4px 0 0', fontSize: 12, color: '#64748b' }}><strong>Evidence:</strong> {f.evidence}</p>}
                      </li>
                    );
                  })}
                </ul>
              )}

              {/* Add finding */}
              {sel.currentStage === 'Audit In Progress' && (
                <div style={{ marginTop: 14, padding: 12, background: '#f8fafc', borderRadius: 8, border: '1px dashed #cbd5e1' }}>
                  <h4 style={{ margin: '0 0 8px 0', fontSize: 12, color: '#475569', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <AlertOctagon size={13} /> Log a new finding
                    {voiceSupported ? (
                      <button
                        onClick={listening ? stopVoice : startVoice}
                        title={listening ? 'Stop dictation and structure the finding' : 'Dictate the finding'}
                        style={{
                          marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 4,
                          background: listening ? '#fee2e2' : '#fff', color: listening ? '#b91c1c' : '#4338ca',
                          border: '1px solid ' + (listening ? '#fca5a5' : '#c7d2fe'),
                          padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer',
                        }}
                      >
                        {listening ? <><MicOff size={12} /> Stop &amp; structure</> : <><Mic size={12} /> Voice-to-finding</>}
                      </button>
                    ) : (
                      <span style={{ marginLeft: 'auto', fontSize: 10, color: '#94a3b8' }}>Voice dictation not supported in this browser</span>
                    )}
                  </h4>
                  <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr', gap: 8 }}>
                    <select value={newF.severity} onChange={(e) => setNewF({ ...newF, severity: e.target.value as Severity })} style={inp}>
                      {(['Major NC', 'Minor NC', 'Observation', 'Opportunity'] as Severity[]).map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                    <input placeholder="Clause / checklist item (e.g. 8.5.1)" value={newF.clause} onChange={(e) => setNewF({ ...newF, clause: e.target.value })} style={inp} />
                  </div>
                  <textarea placeholder="Describe the finding" value={newF.description} onChange={(e) => setNewF({ ...newF, description: e.target.value })} rows={2} style={{ ...inp, marginTop: 6, resize: 'vertical' }} />
                  {newF.description.trim().length > 12 && (() => {
                    const pred = predictSeverity(newF.description);
                    const mapped = pred.label === 'OFI' ? 'Opportunity' : pred.label;
                    const differs = mapped !== newF.severity;
                    return (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6, padding: '6px 10px', borderRadius: 8, background: 'rgba(212,175,55,0.08)', border: '1px solid rgba(212,175,55,0.3)', fontSize: 12 }}>
                        <span style={{ fontWeight: 700, color: '#b8860b' }}>ML model:</span>
                        <span>{pred.label} ({Math.round(pred.confidence * 100)}%)</span>
                        {differs && (
                          <button type="button" onClick={() => setNewF({ ...newF, severity: (mapped as Severity) })}
                            style={{ marginLeft: 'auto', padding: '3px 10px', borderRadius: 6, border: '1px solid #d4af37', background: 'transparent', color: '#b8860b', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                            Apply
                          </button>
                        )}
                      </div>
                    );
                  })()}
                  <input placeholder="Evidence reference (record / interview / observation)" value={newF.evidence} onChange={(e) => setNewF({ ...newF, evidence: e.target.value })} style={{ ...inp, marginTop: 6 }} />
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
                    <button onClick={addFinding} style={btnPrimary}><Plus size={13} /> Add finding</button>
                  </div>
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
};

const btnGhost: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 6, background: '#fff', border: '1px solid #cbd5e1', color: '#475569', padding: '6px 12px', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer' };
const btnPrimary: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 4, background: '#4338ca', color: '#fff', border: 'none', padding: '7px 12px', borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: 'pointer' };
const btnGreen: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 4, background: '#15803d', color: '#fff', border: 'none', padding: '7px 12px', borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: 'pointer' };
const inp: React.CSSProperties = { width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 13, outline: 'none', fontFamily: 'inherit' };

export default ConductAudit;
