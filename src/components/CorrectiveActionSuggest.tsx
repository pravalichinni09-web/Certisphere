import React, { useEffect, useMemo, useState } from 'react';
import {
  Sparkles,
  Copy,
  Check,
  X,
  RefreshCw,
  Lightbulb,
  ShieldCheck,
  CalendarClock,
  Loader2,
  AlertCircle,
  ArrowRight,
} from 'lucide-react';
import {
  suggestActions,
  refineWithClaude,
  FindingInput,
  ActionSuggestion,
} from '../ai/correctiveActions';
import { isClaudeConfigured, onClaudeConfigChange } from '../ai/claudeClient';
import '../styles/CorrectiveActionSuggest.css';

export interface CorrectiveActionPayload {
  correction: string;
  rootCause: string;
  correctiveAction: string;
  preventiveAction: string;
  dueIn: string;
  title: string;
}

interface Props {
  open: boolean;
  finding: FindingInput;
  onClose: () => void;
  /** Called when user clicks "Use this" on a suggestion. Parent decides what to fill. */
  onUse?: (payload: CorrectiveActionPayload) => void;
}

const CorrectiveActionSuggest: React.FC<Props> = ({ open, finding, onClose, onUse }) => {
  const [claudeReady, setClaudeReady] = useState<boolean>(isClaudeConfigured());
  const [refiningId, setRefiningId] = useState<string | null>(null);
  const [refinedById, setRefinedById] = useState<Record<string, string>>({});
  const [refineErrorById, setRefineErrorById] = useState<Record<string, string>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => onClaudeConfigChange(() => setClaudeReady(isClaudeConfigured())), []);

  // Reset refined cache when finding changes (panel re-opens for new item).
  useEffect(() => {
    if (!open) return;
    setRefinedById({});
    setRefineErrorById({});
    setRefiningId(null);
  }, [open, finding.description, finding.severity, finding.clause]);

  const suggestions = useMemo<ActionSuggestion[]>(
    () => (open && finding.description.trim() ? suggestActions(finding, 5) : []),
    [open, finding]
  );

  if (!open) return null;

  const handleCopy = async (s: ActionSuggestion) => {
    const text =
      `Title: ${s.title}\n` +
      `Corrective: ${s.correctiveAction}\n` +
      `Preventive: ${s.preventiveAction}\n` +
      `Due in: ${s.dueIn}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(s.id);
      window.setTimeout(() => setCopiedId(null), 1500);
    } catch {
      // best effort
    }
  };

  const handleUse = (s: ActionSuggestion) => {
    if (!onUse) return;
    const payload: CorrectiveActionPayload = {
      title: s.title,
      correction: s.correctiveAction,
      rootCause: '',
      correctiveAction: s.correctiveAction,
      preventiveAction: s.preventiveAction,
      dueIn: s.dueIn,
    };
    onUse(payload);
    onClose();
  };

  const handleRefine = async (s: ActionSuggestion) => {
    if (!claudeReady || refiningId) return;
    setRefiningId(s.id);
    setRefineErrorById((prev) => {
      const next = { ...prev };
      delete next[s.id];
      return next;
    });
    try {
      const text = await refineWithClaude(finding, s);
      if (text) {
        setRefinedById((prev) => ({ ...prev, [s.id]: text }));
      } else {
        setRefineErrorById((prev) => ({ ...prev, [s.id]: 'Claude returned an empty result. Try again.' }));
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'AI refine failed';
      setRefineErrorById((prev) => ({ ...prev, [s.id]: msg }));
    } finally {
      setRefiningId(null);
    }
  };

  const dismissRefined = (id: string) => {
    setRefinedById((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  return (
    <div className="cas-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="cas-stage" onClick={(e) => e.stopPropagation()}>
        <header className="cas-header">
          <div className="cas-title-row">
            <span className="cas-title-icon">
              <Lightbulb size={18} />
            </span>
            <div>
              <h2>Suggested actions</h2>
              <p>
                Rule-based suggestions for this finding
                {claudeReady ? (
                  <span className="cas-pill cas-pill-ai">
                    <Sparkles size={11} /> AI refine available
                  </span>
                ) : null}
              </p>
            </div>
          </div>
          <button className="cas-close" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </header>

        <section className="cas-finding-summary">
          <div className="cas-finding-label">Finding</div>
          <div className="cas-finding-text">{finding.description || '(no description)'}</div>
          <div className="cas-finding-meta">
            {finding.severity ? (
              <span className={`cas-meta-chip cas-sev-${finding.severity.toLowerCase()}`}>
                {finding.severity}
              </span>
            ) : null}
            {finding.standard ? (
              <span className="cas-meta-chip">{finding.standard}</span>
            ) : null}
            {finding.clause ? (
              <span className="cas-meta-chip">Clause {finding.clause}</span>
            ) : null}
            {finding.category ? (
              <span className="cas-meta-chip">{finding.category}</span>
            ) : null}
          </div>
        </section>

        <div className="cas-list">
          {suggestions.length === 0 ? (
            <div className="cas-empty">
              <AlertCircle size={20} />
              <p>
                No suggestions yet. Add a description of the finding (e.g.
                &quot;calibration overdue on micrometer&quot;) and try again.
              </p>
            </div>
          ) : (
            suggestions.map((s, idx) => {
              const refined = refinedById[s.id];
              const refineError = refineErrorById[s.id];
              const isRefining = refiningId === s.id;
              return (
                <article key={s.id} className="cas-card">
                  <header className="cas-card-head">
                    <div className="cas-rank">#{idx + 1}</div>
                    <div className="cas-card-title">
                      <h3>{s.title}</h3>
                      <div className="cas-tags">
                        {s.matchedOn.slice(0, 4).map((tag) => (
                          <span key={tag} className="cas-tag">
                            {tag}
                          </span>
                        ))}
                        <span className="cas-tag cas-tag-due">
                          <CalendarClock size={11} /> {s.dueIn}
                        </span>
                      </div>
                    </div>
                    <div className="cas-score" title="Match score">
                      {Math.round(Math.min(1, s.score / 8) * 100)}%
                    </div>
                  </header>

                  <div className="cas-body">
                    <div className="cas-field">
                      <div className="cas-field-label">
                        <ShieldCheck size={13} /> Corrective
                      </div>
                      <p>{s.correctiveAction}</p>
                    </div>
                    <div className="cas-field">
                      <div className="cas-field-label">
                        <RefreshCw size={13} /> Preventive
                      </div>
                      <p>{s.preventiveAction}</p>
                    </div>
                  </div>

                  {refined ? (
                    <div className="cas-refined">
                      <div className="cas-refined-head">
                        <span>
                          <Sparkles size={12} /> AI refined
                        </span>
                        <button
                          className="cas-refined-dismiss"
                          onClick={() => dismissRefined(s.id)}
                          aria-label="Dismiss refined output"
                        >
                          <X size={12} />
                        </button>
                      </div>
                      <pre>{refined}</pre>
                    </div>
                  ) : null}

                  {refineError ? (
                    <div className="cas-error">
                      <AlertCircle size={13} /> {refineError}
                    </div>
                  ) : null}

                  <footer className="cas-actions">
                    <button
                      type="button"
                      className="cas-btn cas-btn-ghost"
                      onClick={() => handleCopy(s)}
                    >
                      {copiedId === s.id ? (
                        <>
                          <Check size={13} /> Copied
                        </>
                      ) : (
                        <>
                          <Copy size={13} /> Copy
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      className="cas-btn cas-btn-ghost"
                      onClick={() => handleRefine(s)}
                      disabled={!claudeReady || isRefining}
                      title={
                        claudeReady
                          ? 'Refine with Claude'
                          : 'Add a Claude API key in AI Assistant settings to enable refine'
                      }
                    >
                      {isRefining ? (
                        <>
                          <Loader2 size={13} className="cas-spin" /> Refining…
                        </>
                      ) : (
                        <>
                          <Sparkles size={13} /> AI refine
                        </>
                      )}
                    </button>
                    {onUse ? (
                      <button
                        type="button"
                        className="cas-btn cas-btn-primary"
                        onClick={() => handleUse(s)}
                      >
                        Use this <ArrowRight size={13} />
                      </button>
                    ) : null}
                  </footer>
                </article>
              );
            })
          )}
        </div>

        <footer className="cas-footer">
          <span>
            Suggestions are rule-based and should be reviewed for context fit.
          </span>
          <button className="cas-btn cas-btn-ghost" onClick={onClose}>
            Done
          </button>
        </footer>
      </div>
    </div>
  );
};

export default CorrectiveActionSuggest;
