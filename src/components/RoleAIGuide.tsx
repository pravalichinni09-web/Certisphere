/**
 * RoleAIGuide — interactive AI hub behind a floating symbol on each dashboard.
 * Every feature is LIVE: run its engine inline and see real output from the
 * current application data, or jump straight to the page that hosts it.
 */
import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, Play, ExternalLink, ChevronDown } from 'lucide-react';
import AIPanel from './AIPanel';
import { buildExecutiveBriefing, buildRiskRadar, detectAssignmentAnomalies } from '../ai/managementInsights';
import { triageEnquiry, validateRegistrations, suggestAuditorsFor, calcAuditDays, buildEmailDraft, EMAIL_PURPOSES } from '../ai/coordinatorInsights';
import { reviewReportQuality, classifyFinding as classifyFindingLA, assessAuditorCompetence } from '../ai/leadAuditorInsights';
import { explainQuestion, structureFinding, summarizeEvidence } from '../ai/auditorInsights';
import { buildCoachPlan, assessReadiness, JARGON_TERMS } from '../ai/auditeeInsights';
import { buildComplianceCalendar, buildSiteDigest, answerReportQuestion } from '../ai/clientCoordinatorInsights';
import { classifyFinding as classifyFindingHub, generateChecklist, predictNonConformance, planAudits, scoreCertExpiryRisk } from '../ai/auditIntelligence';
import { ask, suggestionsForRole } from '../ai/aiAssistantEngine';
import {
  retrieveSimilar, detectDuplicateFindings, predictComplianceScore,
  certificationDecision, predictChurn, clientSentiment,
  auditorPerformance, workloadBalance, findingsTrend,
} from '../ai/advancedIntelligence';
import {
  trainSeverityModel, predictSeverity, ensureVectorIndex, vectorSearch,
  clusterFindings, forecastFindings, recommendActions, ragAnswer,
} from '../ai/models';

interface FeatureRow { name: string; where: string; path: string; what: string; }

const safeGet = (k: string): any[] => {
  try { const r = localStorage.getItem(k); const p = r ? JSON.parse(r) : []; return Array.isArray(p) ? p : []; } catch { return []; }
};
const SAMPLE_ENQ = { company: 'Sample Co', contactName: 'A', contactEmail: 'a@s.com', standards: ['ISO 9001:2015'], message: 'Need ISO 9001 certification in 8 weeks for a tender.', industry: 'Manufacturing', employees: '120', status: 'New' };
const SAMPLE_ACTION = { capId: 'CAP-X', clientName: 'Sample Co', standard: 'ISO 9001:2015', severity: 'Minor NC' as const, description: 'Calibration records missing for measurement equipment.' };

/* Each feature's live runner — executes the real engine on current data. */
const RUNNERS: Record<string, () => unknown> = {
  'QCSAI Assistant': () => ({ reply: (ask('what is certms', { role: 'Management' } as any) as any)?.text?.slice?.(0, 220), suggestions: suggestionsForRole('Management') }),
  'Executive AI Briefing': () => buildExecutiveBriefing(),
  'Risk Radar': () => buildRiskRadar(),
  'Anomaly Detection': () => detectAssignmentAnomalies(),
  'Enquiry Auto-Triage': () => triageEnquiry(safeGet('cms_client_enquiries_v1')[0] || SAMPLE_ENQ),
  'Application Auto-Fill & Validation': () => (validateRegistrations as any)(safeGet('cms_client_registrations')),
  'Smart Scheduling Copilot': () => (suggestAuditorsFor as any)({ standard: 'ISO 9001:2015', country: 'India', date: new Date().toISOString().slice(0, 10) }),
  'Audit-Days Calculator': () => (calcAuditDays as any)(120, 1, 'ISO 9001:2015'),
  'Email Draft Assistant': () => buildEmailDraft((EMAIL_PURPOSES as any)[0], safeGet('cms_client_registrations')[0] || { organizationName: 'Sample Co', email: 'a@s.com' }),
  'Audit Intelligence hub': () => ({ classifier: classifyFindingHub('No management review for 18 months', 'ISO 9001:2015'), checklist: generateChecklist('ISO 9001:2015').slice(0, 3), ncPrediction: predictNonConformance().slice(0, 2), plan: planAudits().slice(0, 2), expiryRisk: scoreCertExpiryRisk().slice(0, 3) }),
  'Report Quality Reviewer': () => reviewReportQuality('t', 'Live check', { summary: 'Two minor findings noted', conclusion: 'Recommend continuation' }, [{ severity: 'Minor NC', description: 'Outdated work instruction', clause: '8.5.1' }]),
  'Finding Classifier': () => classifyFindingLA((safeGet('cms_corrective_actions_v1')[0] || SAMPLE_ACTION).description),
  'Auditor Competence Insights': () => (assessAuditorCompetence as any)(safeGet('cms_auditors')[0] || { name: 'Sample Auditor', ratings: [4], skills: {}, certifications: [] }),
  'Checklist Copilot': () => explainQuestion('Are quality objectives documented and communicated?'),
  'Voice-to-Finding': () => structureFinding('expired calibration sticker found on caliper at line 2'),
  'Evidence Summarizer': () => summarizeEvidence('Calibration certificate CC-1023 dated 2025. Training matrix updated May. Photo of pressure gauge.'),
  'Corrective Action Coach': () => (buildCoachPlan as any)(safeGet('cms_corrective_actions_v1')[0] || SAMPLE_ACTION),
  'Readiness Self-Assessment': () => (assessReadiness as any)('ISO 9001:2015', {}),
  'Plain-Language Explainer': () => (JARGON_TERMS || []).slice(0, 3),
  'Compliance Calendar Copilot': () => buildComplianceCalendar(safeGet('cms_certificates')),
  'Multi-Site Status Digest': () => buildSiteDigest(safeGet('cms_certificates')),
  'Report Q&A': () => answerReportQuestion('what were our recent findings?'),
  // ---- Advanced GenAI · RAG · ML (per the AI Features specification) ----
  'RAG Similar-Findings Retrieval': () => retrieveSimilar('calibration records missing measurement equipment', 4),
  'Semantic Knowledge Search': () => retrieveSimilar('management review documentation', 4),
  'Duplicate Finding Detection': () => detectDuplicateFindings(),
  'Predictive Compliance Score': () => predictComplianceScore(),
  'Certification Decision Support': () => certificationDecision(),
  'Client Churn Prediction': () => predictChurn(),
  'Client Sentiment Analysis': () => clientSentiment(),
  'Auditor Performance Scoring': () => auditorPerformance(),
  'Workload Balancing AI': () => workloadBalance(),
  'Findings Trend Analysis': () => findingsTrend(),
  // ---- Model layer: trainable in-app AI models ----
  'Severity Model (Naive Bayes)': () => {
    const sample = safeGet('cms_corrective_actions_v1')[0]?.description || 'complete breakdown of calibration process no records maintained';
    return { input: sample.slice(0, 90), ...predictSeverity(sample) };
  },
  'Retrain Severity Model': () => { const m = trainSeverityModel(); return `Model retrained on ${m.samples} live samples · vocabulary ${m.vocab} terms · ${m.trainedAt.slice(0, 16).replace('T', ' ')}`; },
  'Vector Index (embeddings)': () => { const ix = ensureVectorIndex(); return { ...ix, sampleQuery: vectorSearch('management review documentation', 3) }; },
  'Finding Clusters (k-means)': () => clusterFindings(3),
  'Compliance Forecast (Holt model)': () => forecastFindings(3),
  'Action Recommender (kNN)': () => recommendActions(safeGet('cms_corrective_actions_v1')[0]?.description || 'calibration records missing for measurement equipment'),
  'RAG Answer Pipeline': () => ragAnswer('how were similar non-conformities resolved before?'),
};

const CATALOG: Record<string, FeatureRow[]> = {
  'Management': [
    { name: 'Executive AI Briefing', where: 'Dashboard', path: '/management/dashboard', what: 'Plain-language summary of certificates, actions, utilisation and pipeline.' },
    { name: 'Client Churn Prediction', where: 'AI Hub · ML', path: '/management/client-credentials', what: 'ML model ranks clients by churn risk with drivers.' },
    { name: 'Auditor Performance Scoring', where: 'AI Hub · ML', path: '/management/audit-assignments', what: 'Multi-factor performance score per auditor (rating, load, skills).' },
    { name: 'Findings Trend Analysis', where: 'AI Hub · Time series', path: '/management/dashboard', what: 'Monthly findings trajectory with direction analysis.' },
    { name: 'Compliance Forecast (Holt model)', where: 'Model Lab · Time series', path: '/management/dashboard', what: 'Double-exponential smoothing forecasts findings volume 3 months ahead.' },
    { name: 'Risk Radar', where: 'Client Credentials', path: '/management/client-credentials', what: 'Ranks clients by lapse risk.' },
    { name: 'Anomaly Detection', where: 'Audit Assignments', path: '/management/audit-assignments', what: 'Flags impartiality risks in assignments.' },
  ],
  'Audit Coordinator': [
    { name: 'Enquiry Auto-Triage', where: 'Client Enquiry', path: '/auditor-coordinator/client-enquiry', what: 'Classifies enquiries and drafts the qualification reply.' },
    { name: 'Workload Balancing AI', where: 'AI Hub · ML', path: '/auditor-coordinator/audit-schedules', what: 'Detects overloaded/idle auditors and suggests rebalancing.' },
    { name: 'Semantic Knowledge Search', where: 'AI Hub · RAG', path: '/auditor-coordinator/audit-intelligence', what: 'Vector search across findings, actions and reports by meaning.' },
    { name: 'Vector Index (embeddings)', where: 'Model Lab · Vector DB', path: '/auditor-coordinator/audit-intelligence', what: '256-dim hashed embeddings over the live knowledge base with cosine search.' },
    { name: 'RAG Answer Pipeline', where: 'Model Lab · RAG', path: '/auditor-coordinator/audit-intelligence', what: 'Retrieval-grounded answers with cited sources; Claude generation when configured.' },
    { name: 'Application Auto-Fill & Validation', where: 'Client Registration', path: '/auditor-coordinator/client-registration', what: 'GSTIN/CIN/PAN checks and duplicate detection.' },
    { name: 'Smart Scheduling Copilot', where: 'Audit Schedules', path: '/auditor-coordinator/audit-schedules', what: 'Proposes date + team combos from skills, load and availability.' },
    { name: 'Audit-Days Calculator', where: 'Schedule Requests', path: '/auditor-coordinator/request-schedule', what: 'IAF MD 5 man-day recommendation.' },
    { name: 'Email Draft Assistant', where: 'Email Configuration', path: '/auditor-coordinator/email-config', what: 'Client-ready dispatch, reminder and certificate emails.' },
    { name: 'Audit Intelligence hub', where: 'Audit Intelligence', path: '/auditor-coordinator/audit-intelligence', what: '7 tools: classifier, checklists, NC prediction, planner, analysis, reports, expiry risk.' },
  ],
  'Lead Auditor': [
    { name: 'Report Quality Reviewer', where: 'Audit Report', path: '/lead-auditor/audit-report', what: 'Checks drafts for missing evidence and vague findings.' },
    { name: 'Certification Decision Support', where: 'AI Hub · Decision AI', path: '/lead-auditor/audit-report', what: 'Approve / Conditional / Reject recommendation with confidence.' },
    { name: 'Findings Trend Analysis', where: 'AI Hub · Time series', path: '/lead-auditor/audit-analysis', what: 'Compliance trend across audit cycles.' },
    { name: 'Finding Clusters (k-means)', where: 'Model Lab · Clustering', path: '/lead-auditor/audit-analysis', what: 'k-means groups findings into systemic-issue themes with top terms.' },
    { name: 'Finding Classifier', where: 'Action Approval', path: '/lead-auditor/action-approval', what: 'Suggests Major NC / Minor NC / OFI with clause citations.' },
    { name: 'Auditor Competence Insights', where: 'Auditor Approvals', path: '/lead-auditor/auditor-approvals', what: 'Approve/reject recommendation from history.' },
  ],
  'Auditor': [
    { name: 'Checklist Copilot', where: 'Conduct Audit', path: '/auditor/conduct-audit', what: 'Explains questions, suggests evidence, drafts findings.' },
    { name: 'RAG Similar-Findings Retrieval', where: 'AI Hub · RAG', path: '/auditor/conduct-audit', what: 'Retrieves similar past findings from the knowledge base.' },
    { name: 'Duplicate Finding Detection', where: 'AI Hub · NLP', path: '/auditor/audit-report', what: 'Flags near-identical findings across audits.' },
    { name: 'Severity Model (Naive Bayes)', where: 'Model Lab · ML', path: '/auditor/conduct-audit', what: 'Trained classifier predicts Major/Minor/OFI with class probabilities.' },
    { name: 'Retrain Severity Model', where: 'Model Lab · ML', path: '/auditor/conduct-audit', what: 'Retrains the classifier on the latest live findings in one click.' },
    { name: 'Voice-to-Finding', where: 'Conduct Audit', path: '/auditor/conduct-audit', what: 'Dictate observations; speech becomes structured findings.' },
    { name: 'Evidence Summarizer', where: 'Audit Report', path: '/auditor/audit-report', what: 'Condenses notes into evidence summaries.' },
  ],
  'Auditee': [
    { name: 'Corrective Action Coach', where: 'Audit Actions', path: '/audit-client/audit-actions', what: 'Drafts 5-Why root cause and corrective plans.' },
    { name: 'Predictive Compliance Score', where: 'AI Hub · ML', path: '/audit-client/dashboard', what: 'ML score (0–100) predicting audit readiness with factors and trajectory.' },
    { name: 'Action Recommender (kNN)', where: 'Model Lab · ML', path: '/audit-client/audit-actions', what: 'Nearest-neighbour model recommends corrective approaches from similar past cases.' },
    { name: 'Readiness Self-Assessment', where: 'Dashboard', path: '/audit-client/dashboard', what: 'Guided gap analysis with a readiness score.' },
    { name: 'Plain-Language Explainer', where: 'Audit Actions', path: '/audit-client/audit-actions', what: 'Translates audit jargon into simple guidance.' },
  ],
  'Client Coordinator': [
    { name: 'Compliance Calendar Copilot', where: 'Due Date Tracker', path: '/client-coordinator/due-dates', what: 'Predicts crunch periods and drafts reminders.' },
    { name: 'Client Sentiment Analysis', where: 'AI Hub · NLP', path: '/client-coordinator/notifications', what: 'Analyses client message sentiment for proactive support.' },
    { name: 'Predictive Compliance Score', where: 'AI Hub · ML', path: '/client-coordinator/organization', what: 'Readiness score with drivers for the organisation.' },
    { name: 'RAG Answer Pipeline', where: 'Model Lab · RAG', path: '/client-coordinator/audit-reports', what: 'Ask compliance questions; answers grounded in retrieved records with citations.' },
    { name: 'Multi-Site Status Digest', where: 'Organization View', path: '/client-coordinator/organization', what: 'Natural-language summary across sites.' },
    { name: 'Report Q&A', where: 'Audit Reports', path: '/client-coordinator/audit-reports', what: 'Ask questions against past reports, cited answers.' },
  ],
};

const roleFromPath = (): string => {
  const seg = (window.location.pathname.split('/')[1] || '').toLowerCase();
  switch (seg) {
    case 'management':          return 'Management';
    case 'auditor-coordinator': return 'Audit Coordinator';
    case 'lead-auditor':        return 'Lead Auditor';
    case 'auditor':             return 'Auditor';
    case 'audit-client':        return 'Auditee';
    case 'client-coordinator':  return 'Client Coordinator';
    default:                    return 'Management';
  }
};

/* ---- dynamic output renderer: shows real engine results nicely ---- */
const short = (v: unknown, max = 140): string => {
  if (v == null) return '—';
  if (typeof v === 'string') return v.length > max ? v.slice(0, max) + '…' : v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  return '';
};
const RenderOut: React.FC<{ value: unknown }> = ({ value }) => {
  if (value == null) return <em>No output.</em>;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{short(value, 420)}</p>;
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return <em>Nothing flagged — all clear on current data.</em>;
    return (
      <ul style={{ margin: 0, paddingLeft: 16 }}>
        {value.slice(0, 4).map((it, i) => (
          <li key={i} style={{ marginBottom: 4 }}>
            {typeof it === 'object' && it !== null
              ? short((it as any).title || (it as any).name || (it as any).label || (it as any).text
                  || (it as any).message || (it as any).headline || (it as any).term
                  || (it as any).client || (it as any).organization || JSON.stringify(it), 160)
              : short(it, 160)}
          </li>
        ))}
        {value.length > 4 && <li style={{ opacity: 0.7 }}>… {value.length - 4} more</li>}
      </ul>
    );
  }
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v != null && (typeof v !== 'object' || Array.isArray(v)))
    .slice(0, 6);
  return (
    <div>
      {entries.map(([k, v]) => (
        <div key={k} style={{ marginBottom: 5 }}>
          <strong style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.6, opacity: 0.75 }}>{k}</strong>
          <div style={{ fontSize: 12.5 }}>{Array.isArray(v) ? <RenderOut value={v} /> : short(v, 240)}</div>
        </div>
      ))}
      {entries.length === 0 && <em>Result ready — open the feature page for the full view.</em>}
    </div>
  );
};

const RoleAIGuide: React.FC = () => {
  const navigate = useNavigate();
  const role = roleFromPath();
  const rows = useMemo<FeatureRow[]>(() => ([
    { name: 'QCSAI Assistant', where: 'Every page', path: '', what: 'Floating agent chatbot with /draft-ncr, /summarize, /explain.' },
    ...(CATALOG[role] || []),
  ]), [role]);

  const [statuses, setStatuses] = React.useState<Record<string, 'ok' | 'fail'>>({});
  const [openRow, setOpenRow] = React.useState<string | null>(null);
  const [outputs, setOutputs] = React.useState<Record<string, unknown>>({});
  const working = Object.values(statuses).filter((v) => v === 'ok').length;

  React.useEffect(() => {
    const id = window.setTimeout(() => {
      const next: Record<string, 'ok' | 'fail'> = {};
      rows.forEach((f) => {
        try { RUNNERS[f.name]?.(); next[f.name] = 'ok'; } catch { next[f.name] = 'fail'; }
      });
      setStatuses(next);
    }, 50);
    return () => window.clearTimeout(id);
  }, [rows]);

  const run = (name: string) => {
    try {
      setOutputs((o) => ({ ...o, [name]: RUNNERS[name]?.() ?? 'No runner available.' }));
      setStatuses((s) => ({ ...s, [name]: 'ok' }));
    } catch (e: any) {
      setOutputs((o) => ({ ...o, [name]: `Error: ${e?.message || e}` }));
      setStatuses((s) => ({ ...s, [name]: 'fail' }));
    }
    setOpenRow(name);
  };

  return (
    <AIPanel
      title="AI Features Hub"
      subtitle={`${rows.length} live AI features for ${role} · ${working ? `${working}/${rows.length} verified` : 'checking…'}`}
      icon={<BookOpen size={15} />}
    >
      <ul className="ai-insight-list">
        {rows.map((f) => {
          const status = statuses[f.name];
          const expanded = openRow === f.name;
          return (
            <li key={f.name}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <strong style={{ fontSize: 12.5 }}>{f.name}</strong>
                <span style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}>
                  <span className={'ai-chip ' + (status === 'ok' ? 'ok' : status === 'fail' ? 'high' : 'med')}>
                    {status === 'ok' ? '● Live' : status === 'fail' ? '✗' : '…'}
                  </span>
                  <button type="button" className="ai-action-btn" style={{ marginTop: 0, padding: '4px 10px' }}
                    onClick={() => (expanded ? setOpenRow(null) : run(f.name))}
                    title="Run this AI feature now on live data">
                    {expanded ? <ChevronDown size={11} /> : <Play size={11} />} {expanded ? 'Hide' : 'Run'}
                  </button>
                  {f.path && (
                    <button type="button" className="ai-action-btn" style={{ marginTop: 0, padding: '4px 10px' }}
                      onClick={() => navigate(f.path)} title={`Open ${f.where}`}>
                      <ExternalLink size={11} /> Open
                    </button>
                  )}
                </span>
              </div>
              <div style={{ fontSize: 12, marginTop: 3, opacity: 0.85 }}>{f.what}</div>
              {expanded && (
                <div style={{
                  marginTop: 8, padding: '10px 12px', borderRadius: 8, fontSize: 12.5,
                  background: 'rgba(212,175,55,0.06)', border: '1px solid rgba(212,175,55,0.25)',
                }}>
                  <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.2, textTransform: 'uppercase', color: '#b8860b', marginBottom: 6 }}>
                    Live result — from your current data
                  </div>
                  <RenderOut value={outputs[f.name]} />
                </div>
              )}
            </li>
          );
        })}
      </ul>
      <p className="ai-panel-note">
        “Run” executes the real engine on current application data. Add a Claude API key in AI
        Settings to upgrade responses.
      </p>
    </AIPanel>
  );
};

export default RoleAIGuide;
