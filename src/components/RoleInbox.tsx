/**
 * RoleInbox
 *
 * Drop-in dashboard card that shows the items currently waiting on the given
 * role's action. Drives a single, consistent inbox UI across all five roles.
 *
 * Re-renders automatically whenever the workflow handoff service broadcasts
 * a `cms-workflow-handoff` event (or when the underlying workflow store
 * fires its own `audit-workflow-updated` event).
 */

import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Inbox, ExternalLink, Clock } from 'lucide-react';
import {
  Role,
  PendingItem,
  getPendingForRole,
} from '../services/workflowHandoff';

interface RoleInboxProps {
  role: Role;
  /** Optional limit on the number of items shown. Default 8. */
  limit?: number;
  /** Optional custom title; defaults to "Pending for you". */
  title?: string;
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

const RoleInbox: React.FC<RoleInboxProps> = ({ role, limit = 8, title = 'Pending for you' }) => {
  const navigate = useNavigate();
  const [tick, setTick] = useState(0);

  // Re-pull on workflow handoff events
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

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const items: PendingItem[] = useMemo(() => getPendingForRole(role), [role, tick]);
  const visible = items.slice(0, limit);
  const more = Math.max(0, items.length - limit);

  return (
    <div style={{
      background: '#fff',
      border: '1px solid #e2e8f0',
      borderRadius: 12,
      padding: 18,
      boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04)',
    }}>
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            background: '#ecfeff', color: '#0e7490',
            width: 32, height: 32, borderRadius: 8,
            display: 'grid', placeItems: 'center',
          }}>
            <Inbox size={18} />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#0f172a' }}>{title}</h3>
            <p style={{ margin: 0, fontSize: 12, color: '#64748b' }}>
              {items.length === 0
                ? 'No items waiting on your action.'
                : `${items.length} item${items.length === 1 ? '' : 's'} need your attention.`}
            </p>
          </div>
        </div>
        <span style={{
          background: items.length === 0 ? '#dcfce7' : '#fef3c7',
          color: items.length === 0 ? '#15803d' : '#a16207',
          padding: '4px 10px', borderRadius: 999,
          fontSize: 12, fontWeight: 700,
        }}>
          {items.length} pending
        </span>
      </header>

      {items.length === 0 ? (
        <div style={{
          padding: '24px 16px', textAlign: 'center',
          background: '#f8fafc', borderRadius: 8, border: '1px dashed #cbd5e1',
          color: '#64748b', fontSize: 13,
        }}>
          You're all caught up — no handoffs are waiting on the {role} role.
        </div>
      ) : (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {visible.map((it) => (
            <li
              key={it.id}
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr auto',
                gap: 10,
                alignItems: 'center',
                padding: 10,
                borderRadius: 8,
                border: '1px solid #e2e8f0',
                background: '#fafafa',
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{
                    background: it.badgeBg, color: it.badgeColor,
                    padding: '2px 8px', borderRadius: 999,
                    fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap',
                  }}>
                    {it.badge}
                  </span>
                  <strong style={{ fontSize: 13, color: '#0f172a' }}>{it.title}</strong>
                  {it.receivedAt && (
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: 3,
                      fontSize: 11, color: '#64748b',
                    }}>
                      <Clock size={11} /> {relative(it.receivedAt)}
                    </span>
                  )}
                </div>
                <p style={{ margin: '4px 0 0 0', fontSize: 12, color: '#475569' }}>
                  {it.subtitle}
                </p>
              </div>
              <button
                onClick={() => navigate(it.link)}
                title={`Open ${it.linkLabel}`}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  background: '#0e7490', color: '#fff',
                  border: 'none', padding: '6px 12px',
                  borderRadius: 6, fontSize: 12, fontWeight: 600,
                  cursor: 'pointer', whiteSpace: 'nowrap',
                }}
              >
                <ExternalLink size={12} />
                {it.linkLabel}
              </button>
            </li>
          ))}
          {more > 0 && (
            <li style={{ textAlign: 'center', color: '#64748b', fontSize: 12, padding: '4px 0' }}>
              + {more} more item{more === 1 ? '' : 's'}…
            </li>
          )}
        </ul>
      )}
    </div>
  );
};

export default RoleInbox;
