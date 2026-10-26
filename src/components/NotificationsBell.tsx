/**
 * NotificationsBell
 *
 * Floating notifications button pinned to the top-right corner of every
 * role's layout. Shows a badge with the count of "Pending for you" items
 * from the workflow handoff service, and opens a popover with the full
 * list when clicked.
 *
 * The badge auto-refreshes when any role triggers a handoff event
 * (`cms-workflow-handoff` / `audit-workflow-updated` / storage events).
 *
 * Click outside the popover (or press Escape) to close.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Bell, X, ExternalLink, Clock, Inbox, CheckCircle2, AlertCircle } from 'lucide-react';
import { Role, PendingItem, PendingAction, getPendingForRole } from '../services/workflowHandoff';

interface NotificationsBellProps {
  role: Role;
  /** Optional max number of items shown in the popover. */
  limit?: number;
}

const relative = (iso?: string): string => {
  if (!iso) return '';
  const d = new Date(iso).getTime();
  if (Number.isNaN(d)) return '';
  const diff = Date.now() - d;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  const wks = Math.floor(days / 7);
  if (wks < 5) return `${wks}w ago`;
  return new Date(iso).toLocaleDateString();
};

const NotificationsBell: React.FC<NotificationsBellProps> = ({ role, limit = 10 }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [tick, setTick] = useState(0);
  /** Action currently asking for input: `${itemId}::${actionId}` */
  const [pending, setPending] = useState<string | null>(null);
  const [inputValue, setInputValue] = useState('');
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);
  const popRef = useRef<HTMLDivElement>(null);

  // Live refresh on any handoff / storage event
  useEffect(() => {
    const refresh = () => setTick((t) => t + 1);
    window.addEventListener('cms-workflow-handoff', refresh);
    window.addEventListener('audit-workflow-updated', refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener('cms-workflow-handoff', refresh);
      window.removeEventListener('audit-workflow-updated', refresh);
      window.removeEventListener('storage', refresh);
    };
  }, []);

  // Close on outside-click or Escape
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (popRef.current && !popRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  // `tick` is a dependency so the list re-reads after every handoff event
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const items: PendingItem[] = useMemo(() => getPendingForRole(role), [role, tick]);
  const visible = items.slice(0, limit);
  const more = Math.max(0, items.length - limit);
  const count = items.length;

  const onJump = (link: string) => {
    const target = new URL(link, window.location.origin);
    const samePage = target.pathname === location.pathname;
    // Always push the link (with ?focus=) so the screen can open the record,
    // even when we are already on that page.
    navigate(`${target.pathname}${target.search}`, { state: { focusAt: Date.now() } });
    if (samePage) window.scrollTo({ top: 0, behavior: 'smooth' });
    setOpen(false);
  };

  const runAction = (item: PendingItem, action: PendingAction, value?: string) => {
    if (action.input?.required && !String(value ?? '').trim()) {
      setFeedback({ ok: false, text: `Please enter ${action.input.label.toLowerCase()}.` });
      return;
    }
    let result: unknown;
    try {
      result = action.run(value);
    } catch (err) {
      result = null;
      // eslint-disable-next-line no-console
      console.error('[Notifications] action failed', err);
    }
    if (result === null || result === false) {
      setFeedback({ ok: false, text: `Could not complete "${action.label}" for ${item.title}. Please open the screen instead.` });
      return;
    }
    setFeedback({ ok: true, text: action.doneMessage });
    setPending(null);
    setInputValue('');
    setTick((t) => t + 1);
  };

  const onActionClick = (e: React.MouseEvent, item: PendingItem, action: PendingAction) => {
    e.stopPropagation();
    const key = `${item.id}::${action.id}`;
    if (action.input) {
      if (pending === key) { runAction(item, action, inputValue); return; }
      setPending(key);
      setInputValue(action.input.kind === 'select' ? (action.input.options?.[0] ?? '') : '');
      setFeedback(null);
      return;
    }
    runAction(item, action);
  };

  const toneStyle = (tone: PendingAction['tone']): React.CSSProperties => {
    if (tone === 'danger') return { background: '#fff', color: '#be123c', border: '1px solid #fecdd3' };
    if (tone === 'secondary') return { background: '#fff', color: '#0e7490', border: '1px solid #a5f3fc' };
    return { background: '#0e7490', color: '#fff', border: '1px solid #0e7490' };
  };

  return (
    <div ref={popRef} style={{
      position: 'fixed',
      top: 16,
      right: 20,
      zIndex: 9995,
    }}>
      {/* Bell button */}
      <button
        onClick={() => { setOpen((o) => !o); setFeedback(null); setPending(null); }}
        title={`Notifications — ${count} pending`}
        aria-label="Notifications"
        style={{
          position: 'relative',
          width: 44,
          height: 44,
          borderRadius: 999,
          border: '1px solid rgba(15, 23, 42, 0.08)',
          background: '#fff',
          color: count > 0 ? '#0e7490' : '#475569',
          cursor: 'pointer',
          boxShadow: '0 6px 18px rgba(15, 23, 42, 0.10)',
          display: 'grid',
          placeItems: 'center',
          transition: 'transform 0.12s ease, box-shadow 0.12s ease',
        }}
      >
        <Bell size={18} />
        {count > 0 && (
          <span
            aria-label={`${count} pending`}
            style={{
              position: 'absolute',
              top: -4,
              right: -4,
              minWidth: 20,
              height: 20,
              padding: '0 6px',
              borderRadius: 999,
              background: '#dc2626',
              color: '#fff',
              fontSize: 11,
              fontWeight: 800,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 2px 6px rgba(220, 38, 38, 0.5)',
              border: '2px solid #fff',
            }}
          >
            {count > 99 ? '99+' : count}
          </span>
        )}
      </button>

      {/* Popover */}
      {open && (
        <div
          role="dialog"
          aria-label="Pending notifications"
          style={{
            position: 'absolute',
            top: 52,
            right: 0,
            width: 'min(380px, calc(100vw - 32px))',
            maxHeight: 'min(560px, calc(100vh - 80px))',
            background: '#fff',
            borderRadius: 12,
            border: '1px solid #e2e8f0',
            boxShadow: '0 24px 60px rgba(15, 23, 42, 0.18), 0 8px 24px rgba(15, 23, 42, 0.08)',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            animation: 'cms-notif-slide 0.18s ease-out',
          }}
        >
          <header style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '12px 14px', borderBottom: '1px solid #e2e8f0',
            background: 'linear-gradient(135deg, #ecfeff 0%, #ffffff 60%)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{
                background: '#cffafe', color: '#0e7490', width: 30, height: 30,
                borderRadius: 8, display: 'grid', placeItems: 'center',
              }}>
                <Inbox size={16} />
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>Pending for you</div>
                <div style={{ fontSize: 11, color: '#64748b' }}>
                  {count === 0 ? 'You are all caught up.' : `${count} item${count === 1 ? '' : 's'} need your action`}
                </div>
              </div>
            </div>
            <button
              onClick={() => setOpen(false)}
              title="Close"
              aria-label="Close notifications"
              style={{
                background: 'transparent', border: 'none', color: '#94a3b8',
                width: 28, height: 28, borderRadius: 6, cursor: 'pointer',
                display: 'grid', placeItems: 'center',
              }}
            >
              <X size={16} />
            </button>
          </header>

          {feedback && (
            <div
              role="status"
              style={{
                display: 'flex', alignItems: 'flex-start', gap: 8,
                padding: '8px 14px', fontSize: 12, fontWeight: 600,
                background: feedback.ok ? '#ecfdf5' : '#fff1f2',
                color: feedback.ok ? '#047857' : '#be123c',
                borderBottom: '1px solid #e2e8f0',
              }}
            >
              {feedback.ok ? <CheckCircle2 size={14} style={{ flexShrink: 0, marginTop: 1 }} /> : <AlertCircle size={14} style={{ flexShrink: 0, marginTop: 1 }} />}
              <span style={{ flex: 1 }}>{feedback.text}</span>
              <button
                type="button"
                onClick={() => setFeedback(null)}
                aria-label="Dismiss"
                style={{ background: 'transparent', border: 'none', color: 'inherit', cursor: 'pointer', padding: 0 }}
              >
                <X size={12} />
              </button>
            </div>
          )}

          <div style={{ overflowY: 'auto', flex: 1 }}>
            {count === 0 ? (
              <div style={{ padding: '24px 16px', textAlign: 'center', color: '#64748b', fontSize: 13 }}>
                No handoffs are waiting on the <strong style={{ color: '#0f172a' }}>{role}</strong> role.
              </div>
            ) : (
              <ul style={{ listStyle: 'none', margin: 0, padding: 8 }}>
                {visible.map((it) => (
                  <li
                    key={it.id}
                    style={{
                      padding: 10, borderRadius: 8,
                      marginBottom: 6,
                      border: '1px solid #e2e8f0',
                      background: '#fafafa',
                      cursor: 'pointer',
                    }}
                    onClick={() => onJump(it.link)}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <span style={{
                        background: it.badgeBg, color: it.badgeColor,
                        padding: '2px 8px', borderRadius: 999,
                        fontSize: 10, fontWeight: 700, whiteSpace: 'nowrap',
                      }}>{it.badge}</span>
                      <strong style={{ fontSize: 12, color: '#0f172a' }}>{it.title}</strong>
                      {it.receivedAt && (
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', gap: 3,
                          marginLeft: 'auto',
                          fontSize: 10, color: '#94a3b8',
                        }}>
                          <Clock size={10} /> {relative(it.receivedAt)}
                        </span>
                      )}
                    </div>
                    <p style={{ margin: '4px 0 6px 0', fontSize: 11, color: '#475569' }}>
                      {it.subtitle}
                    </p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      {(it.actions || []).map((a) => (
                        <button
                          key={a.id}
                          type="button"
                          onClick={(e) => onActionClick(e, it, a)}
                          style={{
                            ...toneStyle(a.tone),
                            fontSize: 11, fontWeight: 700, borderRadius: 6,
                            padding: '5px 10px', cursor: 'pointer',
                          }}
                        >
                          {pending === `${it.id}::${a.id}` ? `Confirm ${a.label.toLowerCase()}` : a.label}
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); onJump(it.link); }}
                        style={{
                          display: 'inline-flex', alignItems: 'center', gap: 4,
                          fontSize: 11, color: '#0e7490', fontWeight: 600,
                          background: 'transparent', border: 'none', padding: '5px 4px', cursor: 'pointer',
                        }}
                      >
                        <ExternalLink size={11} /> {it.linkLabel}
                      </button>
                    </div>

                    {(it.actions || []).map((a) => (pending === `${it.id}::${a.id}` && a.input) ? (
                      <div
                        key={`in-${a.id}`}
                        onClick={(e) => e.stopPropagation()}
                        style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}
                      >
                        <label style={{ fontSize: 11, color: '#475569', fontWeight: 600 }}>{a.input.label}</label>
                        {a.input.kind === 'select' ? (
                          <select
                            autoFocus
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                            style={{ fontSize: 12, padding: '6px 8px', borderRadius: 6, border: '1px solid #cbd5e1' }}
                          >
                            {(a.input.options || []).map((o) => <option key={o} value={o}>{o}</option>)}
                          </select>
                        ) : (
                          <input
                            autoFocus
                            type={a.input.kind === 'date' ? 'date' : 'text'}
                            value={inputValue}
                            placeholder={a.input.placeholder}
                            min={a.input.kind === 'date' ? new Date().toISOString().slice(0, 10) : undefined}
                            onChange={(e) => setInputValue(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') runAction(it, a, inputValue); }}
                            style={{ fontSize: 12, padding: '6px 8px', borderRadius: 6, border: '1px solid #cbd5e1' }}
                          />
                        )}
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button
                            type="button"
                            onClick={() => runAction(it, a, inputValue)}
                            style={{ ...toneStyle(a.tone), fontSize: 11, fontWeight: 700, borderRadius: 6, padding: '5px 10px', cursor: 'pointer' }}
                          >
                            {a.label}
                          </button>
                          <button
                            type="button"
                            onClick={() => { setPending(null); setInputValue(''); }}
                            style={{ ...toneStyle('secondary'), fontSize: 11, fontWeight: 600, borderRadius: 6, padding: '5px 10px', cursor: 'pointer' }}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : null)}
                  </li>
                ))}
                {more > 0 && (
                  <li style={{
                    textAlign: 'center', color: '#64748b', fontSize: 11,
                    padding: '6px 0',
                  }}>
                    + {more} more item{more === 1 ? '' : 's'}…
                  </li>
                )}
              </ul>
            )}
          </div>

          <footer style={{
            padding: '8px 14px', borderTop: '1px solid #e2e8f0',
            background: '#f8fafc', fontSize: 11, color: '#64748b', textAlign: 'center',
          }}>
            Use the buttons to act now, or click a card to open its screen.
          </footer>
        </div>
      )}

      {/* Inline keyframes for the slide animation */}
      <style>
        {`@keyframes cms-notif-slide {
          from { opacity: 0; transform: translateY(-6px); }
          to   { opacity: 1; transform: translateY(0); }
        }`}
      </style>
    </div>
  );
};

export default NotificationsBell;
