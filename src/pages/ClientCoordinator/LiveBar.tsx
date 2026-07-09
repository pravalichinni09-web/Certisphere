import React from 'react';
import { RefreshCw } from 'lucide-react';
import { liveLabel } from './useRealtimeScope';

interface LiveBarProps {
  lastUpdated: Date;
  isLive: boolean;
  onRefresh: () => void;
  count?: number;
  unit?: string;
}

export const LiveBar: React.FC<LiveBarProps> = ({ lastUpdated, isLive, onRefresh, count, unit }) => (
  <div style={{
    display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#64748b',
    marginBottom: 16, flexWrap: 'wrap',
  }}>
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      background: isLive ? '#dcfce7' : '#fee2e2',
      color: isLive ? '#15803d' : '#dc2626',
      padding: '3px 10px', borderRadius: 999, fontWeight: 700, fontSize: 11,
    }}>
      <span style={{
        width: 6, height: 6, borderRadius: '50%',
        background: isLive ? '#22c55e' : '#ef4444',
        display: 'inline-block',
        animation: isLive ? 'livePulse 2s infinite' : 'none',
      }} />
      {isLive ? 'Live Data' : 'Offline'}
    </span>
    {count !== undefined && unit && (
      <span style={{ color: '#475569', fontWeight: 600 }}>{count} {unit}</span>
    )}
    <span style={{ color: '#94a3b8' }}>Updated {liveLabel(lastUpdated, isLive)}</span>
    <button
      onClick={onRefresh}
      title="Refresh now"
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 4,
        background: 'none', border: '1px solid #cbd5e1', borderRadius: 6,
        padding: '3px 10px', fontSize: 11, color: '#475569', cursor: 'pointer',
        fontWeight: 600,
      }}
    >
      <RefreshCw size={11} /> Refresh
    </button>
    <style>{`
      @keyframes livePulse {
        0%, 100% { opacity: 1; transform: scale(1); }
        50% { opacity: 0.5; transform: scale(0.8); }
      }
    `}</style>
  </div>
);
