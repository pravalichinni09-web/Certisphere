import React, { useEffect, useMemo, useState } from 'react';
import {
  X,
  Sparkles,
  ArrowRight,
  Briefcase,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Users,
} from 'lucide-react';
import {
  matchAuditors,
  summarizeWithClaude,
  AuditContext,
  AuditorMatch,
} from '../ai/auditorMatcher';
import type { Auditor, AuditSchedule } from '../pages/AuditorCoordinator/mockData';
import { isClaudeConfigured, onClaudeConfigChange } from '../ai/claudeClient';
import '../styles/SmartAssignSuggest.css';

interface Props {
  open: boolean;
  context: AuditContext;
  auditors: Auditor[];
  schedules?: AuditSchedule[];
  onClose: () => void;
  onPick?: (auditorName: string) => void;
}

const SmartAssignSuggest: React.FC<Props> = ({
  open,
  context,
  auditors,
  schedules = [],
  onClose,
  onPick,
}) => {
  const [claudeReady, setClaudeReady] = useState<boolean>(isClaudeConfigured());
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  useEffect(() => onClaudeConfigChange(() => setClaudeReady(isClaudeConfigured())), []);

  // Reset cache when context changes / panel reopens.
  useEffect(() => {
    if (!open) return;
    setAiSummary(null);
    setAiError(null);
    setAiLoading(false);
  }, [open, context.standard, context.proposedDate, context.role]);

  const matches = useMemo<AuditorMatch[]>(
    () => (open ? matchAuditors(auditors, context, schedules, 3) : []),
    [open, auditors, context, schedules]
  );

  if (!open) return null;

  const runAiSummary = async () => {
    if (!claudeReady || aiLoading) return;
    setAiLoading(true);
    setAiError(null);
    try {
      const text = await summarizeWithClaude(context, matches);
      if (text) {
        setAiSummary(text);
      } else {
        setAiError('Claude returned no result. Please try again.');
      }
    } catch (err) {
      setAiError(err instanceof Error ? err.message : 'AI summary failed');
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <div className="sas-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="sas-stage" onClick={(e) => e.stopPropagation()}>
        <header className="sas-header">
          <div className="sas-title-row">
            <span className="sas-title-icon">
              <Users size={18} />
            </span>
            <div>
              <h2>Suggested auditors</h2>
              <p>
                Top picks based on standard, workload, and date
                {claudeReady ? (
                  <span className="sas-pill sas-pill-ai">
                    <Sparkles size={11} /> AI summary available
                  </span>
                ) : null}
              </p>
            </div>
          </div>
          <button className="sas-close" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </header>

        <section className="sas-context">
          <div className="sas-ctx-row">
            {context.standard ? (
              <span className="sas-chip sas-chip-strong">{context.standard}</span>
            ) : (
              <span className="sas-chip sas-chip-warn">No standard set</span>
            )}
            {context.role ? (
              <span className="sas-chip">
                {context.role === 'lead' ? 'Lead Auditor' : 'Auditor'}
              </span>
            ) : null}
            {context.proposedDate ? (
              <span className="sas-chip">Date: {context.proposedDate}</span>
            ) : null}
            {context.sector ? <span className="sas-chip">Sector: {context.sector}</span> : null}
            {context.location ? <span className="sas-chip">Loc: {context.location}</span> : null}
          </div>
        </section>

        <div className="sas-list">
          {matches.length === 0 ? (
            <div className="sas-empty">
              <AlertTriangle size={20} />
              <p>
                No auditors available to score. Add auditors via Auditor Coordinator → Auditor
                Profiles, then try again.
              </p>
            </div>
          ) : (
            matches.map((m, idx) => {
              const pct = Math.round(m.confidence * 100);
              return (
                <article key={m.auditor.id} className="sas-card">
                  <header className="sas-card-head">
                    <div className="sas-rank">#{idx + 1}</div>
                    <div className="sas-who">
                      <h3>{m.auditor.name}</h3>
                      <div className="sas-sub">
                        <Briefcase size={12} /> {m.auditor.role}
                        {m.auditor.department ? <> · {m.auditor.department}</> : null}
                      </div>
                    </div>
                    <div className="sas-confidence" title={`Score ${m.score.toFixed(1)}`}>
                      {pct}%
                    </div>
                  </header>

                  {m.reasons.length ? (
                    <ul className="sas-reasons">
                      {m.reasons.map((r) => (
                        <li key={r}>
                          <CheckCircle2 size={12} /> {r}
                        </li>
                      ))}
                    </ul>
                  ) : null}

                  {m.warnings.length ? (
                    <ul className="sas-warnings">
                      {m.warnings.map((w) => (
                        <li key={w}>
                          <AlertTriangle size={12} /> {w}
                        </li>
                      ))}
                    </ul>
                  ) : null}

                  {m.auditor.certifications && m.auditor.certifications.length > 0 ? (
                    <div className="sas-certs">
                      {m.auditor.certifications.slice(0, 6).map((c) => (
                        <span key={c} className="sas-cert">
                          {c}
                        </span>
                      ))}
                    </div>
                  ) : null}

                  <footer className="sas-actions">
                    {onPick ? (
                      <button
                        type="button"
                        className="sas-btn sas-btn-primary"
                        onClick={() => {
                          onPick(m.auditor.name);
                          onClose();
                        }}
                      >
                        Use {m.auditor.name.split(' ')[0]} <ArrowRight size={13} />
                      </button>
                    ) : null}
                  </footer>
                </article>
              );
            })
          )}
        </div>

        {claudeReady ? (
          <section className="sas-ai-section">
            {aiSummary ? (
              <div className="sas-ai-box">
                <div className="sas-ai-head">
                  <Sparkles size={12} /> AI summary
                </div>
                <p>{aiSummary}</p>
              </div>
            ) : null}
            {aiError ? (
              <div className="sas-error">
                <AlertTriangle size={13} /> {aiError}
              </div>
            ) : null}
            <button
              type="button"
              className="sas-btn sas-btn-ghost"
              onClick={runAiSummary}
              disabled={aiLoading}
            >
              {aiLoading ? (
                <>
                  <Loader2 size={13} className="sas-spin" /> Asking Claude…
                </>
              ) : (
                <>
                  <Sparkles size={13} /> {aiSummary ? 'Re-summarize with Claude' : 'Summarize trade-offs with Claude'}
                </>
              )}
            </button>
          </section>
        ) : null}

        <footer className="sas-footer">
          <span>Suggestions are heuristics; final assignment is yours.</span>
          <button className="sas-btn sas-btn-ghost" onClick={onClose}>
            Done
          </button>
        </footer>
      </div>
    </div>
  );
};

export default SmartAssignSuggest;
