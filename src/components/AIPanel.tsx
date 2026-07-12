/**
 * AIPanel — role-attached AI feature, hidden behind a floating "AI" symbol.
 *
 * The gold sparkles symbol can be DRAGGED anywhere on screen (position is
 * remembered per feature). A short click opens a drawer with the full AI
 * analysis, anchored to whichever side of the symbol has room.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Sparkles, RefreshCw, X } from 'lucide-react';
import '../styles/AIPanel.css';

/* ---- slot registry so several AI symbols stack neatly by default ---- */
const slots: boolean[] = [];
const takeSlot = (): number => {
  for (let i = 0; i < slots.length; i++) {
    if (!slots[i]) { slots[i] = true; return i; }
  }
  slots.push(true);
  return slots.length - 1;
};
const freeSlot = (i: number) => { slots[i] = false; };

/* ---- role attachment derived from the current route ---- */
const roleFromPath = (): string => {
  const seg = (window.location.pathname.split('/')[1] || '').toLowerCase();
  switch (seg) {
    case 'management':          return 'Management';
    case 'auditor-coordinator': return 'Audit Coordinator';
    case 'lead-auditor':        return 'Lead Auditor';
    case 'auditor':             return 'Auditor';
    case 'audit-client':        return 'Auditee';
    case 'client-coordinator':  return 'Client Coordinator';
    default:                    return 'CertiSphere';
  }
};

const FAB = 46;               // symbol diameter
const DRAWER_W = 380;

interface Pos { x: number; y: number; }

interface AIPanelProps {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  onRefresh?: () => void;
  loading?: boolean;
  /** Kept for backwards compatibility — the panel always starts hidden. */
  defaultCollapsed?: boolean;
  children: React.ReactNode;
  className?: string;
}

const AIPanel: React.FC<AIPanelProps> = ({
  title, subtitle, icon, onRefresh, loading, children, className,
}) => {
  const [open, setOpen] = useState(false);
  const [slot, setSlot] = useState(0);
  const role = useMemo(roleFromPath, []);
  const posKey = useMemo(() => `cms_ai_fab_pos::${role}::${title}`, [role, title]);

  // Saved / dragged position (null = default right-docked stack)
  const [pos, setPos] = useState<Pos | null>(() => {
    try {
      const raw = localStorage.getItem(posKey);
      if (raw) {
        const p = JSON.parse(raw);
        if (typeof p?.x === 'number' && typeof p?.y === 'number') return p;
      }
    } catch { /* ignore */ }
    return null;
  });

  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number; moved: boolean } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const s = takeSlot();
    setSlot(s);
    return () => freeSlot(s);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const clamp = (p: Pos): Pos => ({
    x: Math.min(Math.max(4, p.x), window.innerWidth - FAB - 4),
    y: Math.min(Math.max(4, p.y), window.innerHeight - FAB - 4),
  });

  const defaultPos = (): Pos => ({ x: window.innerWidth - FAB - 16, y: 110 + slot * 58 });
  const current: Pos = pos ? clamp(pos) : defaultPos();

  /* ---------- drag handling (pointer events) ---------- */
  const onPointerDown = (e: React.PointerEvent) => {
    const start = pos ? clamp(pos) : defaultPos();
    dragRef.current = { startX: e.clientX, startY: e.clientY, origX: start.x, origY: start.y, moved: false };
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);

    const onMove = (ev: PointerEvent) => {
      const d = dragRef.current;
      if (!d) return;
      const dx = ev.clientX - d.startX;
      const dy = ev.clientY - d.startY;
      if (!d.moved && Math.hypot(dx, dy) < 6) return; // click tolerance
      d.moved = true;
      setPos(clamp({ x: d.origX + dx, y: d.origY + dy }));
    };
    const onUp = () => {
      const d = dragRef.current;
      if (d?.moved) {
        // persist final spot
        setPos((p) => {
          if (p) { try { localStorage.setItem(posKey, JSON.stringify(p)); } catch { /* ignore */ } }
          return p;
        });
      }
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      // keep `moved` flag until the click event fires (click fires after pointerup)
      setTimeout(() => { dragRef.current = null; }, 0);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  const onClick = () => {
    if (dragRef.current?.moved) return; // it was a drag, not a click
    setOpen((v) => !v);
  };

  /* ---------- drawer anchored to the symbol ---------- */
  const drawerStyle = (): React.CSSProperties => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const openLeft = current.x + FAB / 2 > vw / 2; // symbol on right half → drawer to its left
    const left = openLeft
      ? Math.max(8, current.x - DRAWER_W - 10)
      : Math.min(vw - DRAWER_W - 8, current.x + FAB + 10);
    const top = Math.min(Math.max(8, current.y), Math.max(8, vh - 320));
    return { left, top };
  };

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        className={'ai-ins-fab' + (open ? ' is-active' : '') + (className ? ' ' + className : '')}
        style={{ left: current.x, top: current.y, right: 'auto' }}
        onPointerDown={onPointerDown}
        onClick={onClick}
        title={`${title} — AI for ${role} · drag to move`}
        aria-expanded={open}
      >
        <span className="ai-ins-fab-icon">{icon || <Sparkles size={17} />}</span>
        <span className="ai-ins-fab-tag">AI</span>
      </button>

      {open && (
        <div className="ai-ins-drawer" style={drawerStyle()} role="dialog" aria-label={title}>
          <header className="ai-ins-drawer-head">
            <span className="ai-ins-icon">{icon || <Sparkles size={15} />}</span>
            <div className="ai-ins-titles">
              <h3>{title} <span className="ai-ins-badge">AI</span></h3>
              <p>
                <span className="ai-ins-drawer-role">{role}</span>
                {subtitle ? <> · {subtitle}</> : null}
              </p>
            </div>
            <div className="ai-ins-tools">
              {onRefresh && (
                <button
                  type="button"
                  className={'ai-ins-refresh' + (loading ? ' is-loading' : '')}
                  onClick={onRefresh}
                  title="Re-run analysis"
                  disabled={loading}
                >
                  <RefreshCw size={13} />
                </button>
              )}
              <button type="button" className="ai-ins-toggle" onClick={() => setOpen(false)} title="Close">
                <X size={14} />
              </button>
            </div>
          </header>
          <div className="ai-ins-drawer-body">
            {loading ? (
              <div className="ai-ins-loading">
                <span className="ai-ins-dot" /><span className="ai-ins-dot" /><span className="ai-ins-dot" />
                <span className="ai-ins-loading-label">Analysing live data…</span>
              </div>
            ) : children}
          </div>
        </div>
      )}
    </>
  );
};

export default AIPanel;
