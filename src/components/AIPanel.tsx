/**
 * AIPanel — reusable collapsible card that hosts an AI insight feature.
 * Consistent look across every role: gold "AI" badge, refresh, loading state.
 * Purely presentational — feature logic lives in src/ai/*Insights.ts.
 */
import React, { useState } from 'react';
import { Sparkles, RefreshCw, ChevronDown } from 'lucide-react';
import '../styles/AIPanel.css';

interface AIPanelProps {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  /** Called when the user clicks refresh (re-run the analysis). */
  onRefresh?: () => void;
  loading?: boolean;
  /** Start collapsed (default open). */
  defaultCollapsed?: boolean;
  children: React.ReactNode;
  className?: string;
}

const AIPanel: React.FC<AIPanelProps> = ({
  title, subtitle, icon, onRefresh, loading, defaultCollapsed, children, className,
}) => {
  const [open, setOpen] = useState(!defaultCollapsed);
  return (
    <section className={'ai-panel' + (open ? ' is-open' : '') + (className ? ' ' + className : '')}>
      <header className="ai-panel-head" onClick={() => setOpen((v) => !v)}>
        <span className="ai-panel-icon">{icon || <Sparkles size={15} />}</span>
        <div className="ai-panel-titles">
          <h3>{title} <span className="ai-panel-badge">AI</span></h3>
          {subtitle && <p>{subtitle}</p>}
        </div>
        <div className="ai-panel-tools" onClick={(e) => e.stopPropagation()}>
          {onRefresh && (
            <button
              type="button"
              className={'ai-panel-refresh' + (loading ? ' is-loading' : '')}
              onClick={onRefresh}
              title="Re-run analysis"
              disabled={loading}
            >
              <RefreshCw size={13} />
            </button>
          )}
          <button
            type="button"
            className="ai-panel-toggle"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            title={open ? 'Collapse' : 'Expand'}
          >
            <ChevronDown size={14} />
          </button>
        </div>
      </header>
      {open && (
        <div className="ai-panel-body">
          {loading ? (
            <div className="ai-panel-loading">
              <span className="ai-panel-dot" /><span className="ai-panel-dot" /><span className="ai-panel-dot" />
              <span className="ai-panel-loading-label">Analysing live data…</span>
            </div>
          ) : children}
        </div>
      )}
    </section>
  );
};

export default AIPanel;
