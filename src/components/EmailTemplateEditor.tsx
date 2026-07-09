import React, { useEffect, useMemo, useState } from 'react';
import { Plus, Save, Trash2, X, Eye, FileText } from 'lucide-react';
import {
  EmailTemplate,
  listEmailTemplates,
  upsertEmailTemplate,
  deleteEmailTemplate,
  renderTemplate,
} from '../utils/emailTemplates';

interface Props {
  /** Filter templates by stage tag (dispatch, reminder, welcome, cert) */
  tag?: EmailTemplate['tag'];
  /** Sample variables used to power the live Preview panel */
  sampleVars?: Record<string, string>;
  /** Called when the user picks "Use this template" */
  onUse?: (rendered: { subject: string; body: string; templateId: string }) => void;
  onClose?: () => void;
}

const blankTemplate = (tag?: EmailTemplate['tag']): EmailTemplate => ({
  id: `tpl-custom-${Date.now()}`,
  name: 'New template',
  subject: '',
  body: '',
  tag: tag || 'general',
});

const EmailTemplateEditor: React.FC<Props> = ({ tag, sampleVars, onUse, onClose }) => {
  const [templates, setTemplates] = useState<EmailTemplate[]>(() => listEmailTemplates(tag));
  const [activeId, setActiveId] = useState<string | null>(templates[0]?.id || null);
  const [draft, setDraft] = useState<EmailTemplate | null>(templates[0] ? { ...templates[0] } : null);

  useEffect(() => {
    const refresh = () => {
      const next = listEmailTemplates(tag);
      setTemplates(next);
    };
    window.addEventListener('email-templates-updated', refresh);
    return () => window.removeEventListener('email-templates-updated', refresh);
  }, [tag]);

  const selectTemplate = (id: string) => {
    setActiveId(id);
    const t = templates.find((x) => x.id === id);
    if (t) setDraft({ ...t });
  };

  const handleNew = () => {
    const fresh = blankTemplate(tag);
    upsertEmailTemplate(fresh);
    setTemplates(listEmailTemplates(tag));
    setActiveId(fresh.id);
    setDraft({ ...fresh });
  };

  const handleSave = () => {
    if (!draft) return;
    upsertEmailTemplate(draft);
    setTemplates(listEmailTemplates(tag));
  };

  const handleDelete = () => {
    if (!draft) return;
    if (!window.confirm(`Delete template "${draft.name}"?`)) return;
    deleteEmailTemplate(draft.id);
    const next = listEmailTemplates(tag);
    setTemplates(next);
    setActiveId(next[0]?.id || null);
    setDraft(next[0] ? { ...next[0] } : null);
  };

  const preview = useMemo(() => {
    if (!draft) return { subject: '', body: '' };
    return renderTemplate(draft, sampleVars || {});
  }, [draft, sampleVars]);

  const handleUse = () => {
    if (!draft) return;
    onUse?.({ subject: preview.subject, body: preview.body, templateId: draft.id });
    onClose?.();
  };

  return (
    <div className="cms-tpl-editor">
      <div className="cms-tpl-editor__header">
        <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
          <FileText size={16} /> Email Template Editor
        </h3>
        {onClose && (
          <button onClick={onClose} className="cms-tpl-editor__icon-btn" aria-label="Close">
            <X size={18} />
          </button>
        )}
      </div>

      <div className="cms-tpl-editor__body">
        <aside className="cms-tpl-editor__list">
          <button className="cms-tpl-editor__new" onClick={handleNew}>
            <Plus size={14} /> New template
          </button>
          <ul>
            {templates.map((t) => (
              <li key={t.id}>
                <button
                  className={`cms-tpl-editor__list-btn ${t.id === activeId ? 'is-active' : ''}`}
                  onClick={() => selectTemplate(t.id)}
                >
                  <span className="cms-tpl-editor__name">{t.name}</span>
                  {t.tag && <span className="cms-tpl-editor__tag">{t.tag}</span>}
                </button>
              </li>
            ))}
            {templates.length === 0 && (
              <li style={{ color: '#94a3b8', fontSize: 12, padding: '8px 4px' }}>No templates yet.</li>
            )}
          </ul>
        </aside>

        <main className="cms-tpl-editor__main">
          {draft ? (
            <>
              <label>Name</label>
              <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />

              <label>Subject</label>
              <input
                value={draft.subject}
                onChange={(e) => setDraft({ ...draft, subject: e.target.value })}
                placeholder="e.g. Audit application — {{clientName}}"
              />

              <label>Body</label>
              <textarea
                rows={9}
                value={draft.body}
                onChange={(e) => setDraft({ ...draft, body: e.target.value })}
                placeholder="Use {{tokens}} like {{clientName}}, {{contactName}}, {{auditDate}}…"
              />

              <div className="cms-tpl-editor__preview">
                <div className="cms-tpl-editor__preview-head">
                  <Eye size={12} /> Live preview
                </div>
                <div className="cms-tpl-editor__preview-subject">{preview.subject}</div>
                <pre className="cms-tpl-editor__preview-body">{preview.body}</pre>
              </div>

              <div className="cms-tpl-editor__actions">
                <button className="cancel-btn" onClick={handleDelete}>
                  <Trash2 size={14} style={{ verticalAlign: 'middle' }} /> Delete
                </button>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="cancel-btn" onClick={handleSave}>
                    <Save size={14} style={{ verticalAlign: 'middle' }} /> Save
                  </button>
                  {onUse && (
                    <button className="submit-btn" onClick={handleUse}>
                      Use this template
                    </button>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div style={{ color: '#94a3b8' }}>Select or create a template.</div>
          )}
        </main>
      </div>
    </div>
  );
};

export default EmailTemplateEditor;
