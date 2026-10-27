/**
 * Auto Document Analysis — Auditee tool.
 * Paste or upload an audit document; get a structured AI analysis:
 * Summary · Key Findings · Non-Conformities (severity) · Recommendations · Next Steps.
 */
import React, { useRef, useState } from 'react';
import { FileSearch, Upload, Wand2, Loader2, Sparkles, AlertTriangle, CheckCircle2, ListChecks, ArrowRight } from 'lucide-react';
import { isClaudeConfigured } from '../../ai/claudeClient';
import { analyzeDocumentHeuristic, analyzeDocumentWithClaude, type DocumentAnalysis } from '../../ai/documentAnalysis';

const sevColor: Record<string, string> = { Critical: '#dc2626', Major: '#f59e0b', Minor: '#0ea5e9' };

const card: React.CSSProperties = {
  background: '#fff', border: '1px solid #e7ecf3', borderRadius: 16,
  padding: 22, boxShadow: '0 1px 3px rgba(15,23,42,.05), 0 8px 22px rgba(15,23,42,.04)', marginBottom: 20,
};
const h3: React.CSSProperties = { margin: '0 0 12px', fontSize: 16, fontWeight: 800, color: '#0f2547', display: 'flex', alignItems: 'center', gap: 8 };
const btn: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 18px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,#2563eb,#1d4ed8)', color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer' };
const ghost: React.CSSProperties = { ...btn, background: '#fff', color: '#1d4ed8', border: '1.5px solid #1d4ed8' };

const DocumentAnalysis: React.FC = () => {
  const claude = isClaudeConfigured();
  const [text, setText] = useState('');
  const [fileName, setFileName] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<DocumentAnalysis | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const onFile = (f?: File) => {
    if (!f) return;
    setFileName(f.name);
    const reader = new FileReader();
    reader.onload = () => setText(String(reader.result || ''));
    reader.readAsText(f);
  };

  const run = async () => {
    if (!text.trim()) return;
    setBusy(true);
    // instant heuristic, then upgrade with Claude if configured
    setResult(analyzeDocumentHeuristic(text));
    if (claude) {
      const r = await analyzeDocumentWithClaude(text);
      if (r) setResult(r);
    }
    setBusy(false);
  };

  return (
    <div style={{ padding: '0 8px', maxWidth: 1060, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12, marginBottom: 14 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800, color: '#0f2547', display: 'flex', alignItems: 'center', gap: 10 }}>
            <FileSearch size={26} color="#2563eb" /> Auto Document Analysis
          </h1>
          <p style={{ margin: '6px 0 0', color: '#64748b', fontSize: 13 }}>
            Paste or upload an audit document to extract findings, non-conformities and recommended next steps.
          </p>
        </div>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '7px 14px', borderRadius: 999, fontSize: 12.5, fontWeight: 700,
          background: claude ? '#ecfdf5' : '#f1f5f9', color: claude ? '#047857' : '#475569', border: `1px solid ${claude ? '#a7f3d0' : '#e2e8f0'}` }}>
          <Sparkles size={14} /> {claude ? 'Claude connected' : 'Heuristic mode · AI not enabled on server'}
        </span>
      </div>

      {/* Input */}
      <div style={card}>
        <h3 style={h3}><Upload size={18} color="#2563eb" /> Document</h3>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Paste the audit document text here, or upload a .txt file below…"
          style={{ width: '100%', minHeight: 180, resize: 'vertical', padding: '12px 14px', border: '1.5px solid #cbd5e1', borderRadius: 10, fontSize: 14, fontFamily: 'inherit', color: '#0f172a', boxSizing: 'border-box' }}
        />
        <input ref={fileRef} type="file" accept=".txt,.md,.csv,text/plain" style={{ display: 'none' }} onChange={(e) => onFile(e.target.files?.[0])} />
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 12, flexWrap: 'wrap' }}>
          <button type="button" style={ghost} onClick={() => fileRef.current?.click()}><Upload size={16} /> Upload .txt</button>
          {fileName && <span style={{ fontSize: 12.5, color: '#64748b' }}>📎 {fileName}</span>}
          <button type="button" style={btn} onClick={run} disabled={busy || !text.trim()}>
            {busy ? <Loader2 size={16} className="cs-spin" /> : <Wand2 size={16} />} Analyze
          </button>
          {text && <button type="button" onClick={() => { setText(''); setFileName(''); setResult(null); }} style={{ ...ghost, border: '1.5px solid #cbd5e1', color: '#475569' }}>Clear</button>}
        </div>
      </div>

      {/* Result */}
      {result && (
        <>
          <div style={card}>
            <h3 style={h3}><Sparkles size={18} color="#2563eb" /> Summary</h3>
            <p style={{ margin: 0, color: '#334155', fontSize: 14, lineHeight: 1.6 }}>{result.summary}</p>
            <div style={{ marginTop: 10, fontSize: 11.5, color: '#94a3b8' }}>{result.source === 'claude' ? 'AI analysis (Claude)' : 'Heuristic analysis'}</div>
          </div>

          <div style={card}>
            <h3 style={h3}><CheckCircle2 size={18} color="#16a34a" /> Key Findings & Strengths</h3>
            {result.keyFindings.length === 0 ? <p style={{ color: '#94a3b8', fontSize: 13, margin: 0 }}>None detected.</p> : (
              <ul style={{ margin: 0, paddingLeft: 18, color: '#334155', fontSize: 14, lineHeight: 1.7 }}>
                {result.keyFindings.map((k, i) => <li key={i}>{k}</li>)}
              </ul>
            )}
          </div>

          <div style={card}>
            <h3 style={h3}><AlertTriangle size={18} color="#dc2626" /> Non-Conformities Found</h3>
            {result.nonConformities.length === 0 ? <p style={{ color: '#94a3b8', fontSize: 13, margin: 0 }}>No non-conformities detected.</p> : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {result.nonConformities.map((n, i) => (
                  <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '10px 12px', background: '#f8fafc', border: '1px solid #eef2f7', borderRadius: 10 }}>
                    <span style={{ flexShrink: 0, fontSize: 11, fontWeight: 800, padding: '3px 9px', borderRadius: 999, color: sevColor[n.severity], background: sevColor[n.severity] + '1f', border: `1px solid ${sevColor[n.severity]}55` }}>{n.severity}</span>
                    <span style={{ color: '#334155', fontSize: 13.5, lineHeight: 1.5 }}>{n.text}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={card}>
            <h3 style={h3}><ListChecks size={18} color="#2563eb" /> Recommendations</h3>
            <ul style={{ margin: 0, paddingLeft: 18, color: '#334155', fontSize: 14, lineHeight: 1.7 }}>
              {result.recommendations.map((r, i) => <li key={i}>{r}</li>)}
            </ul>
          </div>

          <div style={card}>
            <h3 style={h3}><ArrowRight size={18} color="#2563eb" /> Next Steps</h3>
            <ul style={{ margin: 0, paddingLeft: 18, color: '#334155', fontSize: 14, lineHeight: 1.7 }}>
              {result.nextSteps.map((s, i) => <li key={i}>{s}</li>)}
            </ul>
          </div>
        </>
      )}

      <style>{`.cs-spin{animation:cs-spin 1s linear infinite}@keyframes cs-spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
};

export default DocumentAnalysis;
