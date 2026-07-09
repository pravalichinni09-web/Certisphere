import React, { useEffect, useMemo, useState } from 'react';
import { Building2, Mail, Phone, MapPin, Globe, Briefcase, RefreshCw } from 'lucide-react';
import { getOrg, getBranches, getCertifications } from './scope';
import { useRealtimeScope } from './useRealtimeScope';
import { LiveBar } from './LiveBar';
import AIPanel from '../../components/AIPanel';
import { buildSiteDigest, digestClaudePrompt } from '../../ai/clientCoordinatorInsights';
import { onCmsChange, claudeComplete, isClaudeConfigured } from '../../ai/liveData';

const Organization: React.FC = () => {
  const { data: org, refresh, lastUpdated, isLive } = useRealtimeScope(getOrg);
  const { data: branches } = useRealtimeScope(getBranches);
  const { data: certs } = useRealtimeScope(getCertifications);

  // ---- Multi-Site Status Digest (AI) --------------------------------------
  const [aiTick, setAiTick] = useState(0);
  const [aiDigestText, setAiDigestText] = useState<string | null>(null);
  const [aiDigestBusy, setAiDigestBusy] = useState(false);
  const [aiDigestErr, setAiDigestErr] = useState<string | null>(null);

  useEffect(() => onCmsChange(() => setAiTick((t) => t + 1)), []);

  const digest = useMemo(() => {
    void aiTick;
    const branchNameOf = (id?: number) => branches.find(b => b.id === id)?.name || 'Head Office';
    return buildSiteDigest(certs, branchNameOf, org?.organizationName);
  }, [certs, branches, org, aiTick]);

  const enhanceDigest = async () => {
    if (aiDigestBusy || digest.entries.length === 0) return;
    setAiDigestBusy(true);
    setAiDigestErr(null);
    const res = await claudeComplete(digestClaudePrompt(digest), { maxTokens: 400 });
    setAiDigestBusy(false);
    if (res.ok) setAiDigestText(res.text);
    else setAiDigestErr(res.error);
  };

  if (!org) return (
    <div style={{ padding: 24 }}>
      <p style={{ color: '#64748b' }}>No organization linked to this session.</p>
      <button onClick={refresh} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 10, padding: '8px 14px', borderRadius: 6, border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer', fontSize: 13 }}>
        <RefreshCw size={13} /> Retry
      </button>
    </div>
  );

  return (
    <div style={{ padding: 24, maxWidth: 900 }}>
      <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: '#0f172a' }}>Organization View</h1>
      <p style={{ margin: '4px 0 10px', color: '#64748b', fontSize: 13 }}>Read-only profile · branch listing</p>

      <LiveBar lastUpdated={lastUpdated} isLive={isLive} onRefresh={refresh} />

      {/* Multi-Site Status Digest — per-site certificate health in plain language */}
      <AIPanel
        title="Multi-Site Status Digest"
        subtitle="Per-site certificate status, days to expiry and open actions — at-risk sites flagged with a reason"
        onRefresh={() => { setAiTick((t) => t + 1); setAiDigestText(null); setAiDigestErr(null); }}
      >
        <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6, color: '#334155' }}>
          {aiDigestText || digest.summary}
        </p>
        {digest.entries.length > 0 && (
          <ul className="ai-insight-list">
            {digest.entries.slice(0, 8).map((e) => (
              <li key={`${e.branch}-${e.certNumber}-${e.standard}`}>
                <span className={`ai-chip ${e.level}`}>{e.atRisk ? 'At risk' : 'Healthy'}</span>
                <span>{e.sentence}</span>
              </li>
            ))}
          </ul>
        )}
        {digest.entries.length > 8 && (
          <p className="ai-panel-note">Showing the 8 most urgent of {digest.entries.length} certificates, sorted by days to expiry.</p>
        )}
        {isClaudeConfigured() && !aiDigestText && digest.entries.length > 0 && (
          <button type="button" className="ai-action-btn" onClick={enhanceDigest} disabled={aiDigestBusy} style={{ marginTop: 10 }}>
            {aiDigestBusy ? 'Enhancing…' : 'Enhance with Claude'}
          </button>
        )}
        {aiDigestErr && <p className="ai-panel-note">Claude enhancement failed: {aiDigestErr} — local digest shown above.</p>}
      </AIPanel>

      {/* Org profile card */}
      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 20, marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 14, alignItems: 'center', marginBottom: 14 }}>
          <div style={{ width: 56, height: 56, borderRadius: 14, background: 'linear-gradient(135deg,#0a2a5f,#1f6bbf)', color: '#FFD700', display: 'grid', placeItems: 'center', fontSize: 26, fontWeight: 900, flexShrink: 0 }}>
            {(org.organizationName || '?').charAt(0).toUpperCase()}
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: '#0f172a' }}>{org.organizationName}</h2>
            <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
              {org.clientCode && <span style={{ marginRight: 8 }}>ID: {org.clientCode}</span>}
              <span>{org.country || '—'}</span>
              {org.industry && <span style={{ marginLeft: 8 }}>· {org.industry}</span>}
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10, fontSize: 13, color: '#475569' }}>
          {org.email && <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Mail size={13} color="#0e7490" /> {org.email}</span>}
          {org.phone && <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Phone size={13} color="#0e7490" /> {org.phone}</span>}
          {org.address && <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><MapPin size={13} color="#0e7490" /> {org.address}</span>}
          {org.country && <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Globe size={13} color="#0e7490" /> {org.country}</span>}
          {org.standard && <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Briefcase size={13} color="#0e7490" /> Primary: {org.standard}</span>}
          {org.clientType && <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Building2 size={13} color="#0e7490" /> {org.clientType}</span>}
        </div>
      </div>

      {/* Branches */}
      <h3 style={{ margin: '0 0 12px', fontSize: 15, fontWeight: 700, color: '#0f172a' }}>
        Branches / Units <span style={{ fontSize: 12, color: '#64748b', fontWeight: 400 }}>({branches.length})</span>
      </h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 10 }}>
        {branches.map(b => (
          <div key={b.id} style={{ background: '#fff', border: '1px solid #e2e8f0', borderLeft: '3px solid #FFD700', borderRadius: 10, padding: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <Building2 size={14} color="#0e7490" />
              <strong style={{ fontSize: 13, color: '#0f172a' }}>{b.name}</strong>
            </div>
            <div style={{ fontSize: 12, color: '#64748b' }}><MapPin size={11} style={{ verticalAlign: 'middle' }} /> {b.location}</div>
            {b.manager && <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>Manager: {b.manager}</div>}
          </div>
        ))}
      </div>
    </div>
  );
};

export default Organization;
