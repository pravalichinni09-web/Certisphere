import React, { useState, useMemo } from 'react';
import { X, ClipboardPaste, Layers, Sparkles, Plus, ChevronRight } from 'lucide-react';
import '../styles/BulkAddQuestions.css';

interface BulkAddQuestionsProps {
  open: boolean;
  onClose: () => void;
  onAdd: (texts: string[]) => void;
  /** Optional standard hint so the Templates tab can pre-select the right one. */
  defaultStandard?: string;
}

type TabKey = 'paste' | 'blanks' | 'templates';

/* ----------------------------------------------------------------
   Built-in checkpoint templates per standard.
   These give the auditor a curated head-start of typical questions.
---------------------------------------------------------------- */
const TEMPLATES: { code: string; title: string; questions: string[] }[] = [
  {
    code: 'ISO 9001:2015',
    title: 'Quality Management System',
    questions: [
      'Is the organization context, including internal and external issues, identified and reviewed?',
      'Are the needs and expectations of interested parties documented?',
      'Is the scope of the QMS defined and available as documented information?',
      'Are quality policy and quality objectives established, communicated and reviewed?',
      'Is leadership commitment evident through resource allocation and engagement?',
      'Are roles, responsibilities and authorities clearly assigned and communicated?',
      'Are risks and opportunities identified, assessed and addressed?',
      'Is documented information controlled (creation, approval, version, retention)?',
      'Are competency requirements defined and met for personnel?',
      'Is awareness of the QMS, policies and contributions of personnel demonstrated?',
      'Are external providers (suppliers) evaluated, monitored and re-evaluated?',
      'Is product/service realisation planned and controlled?',
      'Are customer requirements determined, reviewed and met?',
      'Are design and development controls applied where applicable?',
      'Are non-conforming outputs identified, controlled and corrected?',
      'Is monitoring, measurement, analysis and evaluation performed?',
      'Is customer satisfaction monitored and analysed?',
      'Are internal audits conducted at planned intervals?',
      'Are management reviews conducted with required inputs and outputs?',
      'Are non-conformities corrected and root causes addressed (CAPA)?',
      'Is continual improvement of the QMS demonstrable?',
    ],
  },
  {
    code: 'ISO 14001:2015',
    title: 'Environmental Management System',
    questions: [
      'Are environmental aspects and impacts identified and evaluated?',
      'Are compliance obligations (legal and other) identified and maintained?',
      'Are environmental objectives and targets established at relevant functions?',
      'Are operational controls in place for significant environmental aspects?',
      'Is there a procedure for emergency preparedness and response?',
      'Are waste management practices compliant with regulations?',
      'Is monitoring and measuring equipment calibrated and maintained?',
      'Is energy/water/resource consumption tracked and reduced where possible?',
      'Are personnel aware of environmental policy, aspects and consequences?',
      'Is supplier environmental performance evaluated?',
      'Are environmental incidents and non-conformities investigated?',
      'Is internal audit performed at planned intervals for the EMS?',
      'Are management reviews conducted with environmental performance data?',
      'Is continual improvement of environmental performance demonstrable?',
    ],
  },
  {
    code: 'ISO 45001:2018',
    title: 'Occupational Health & Safety',
    questions: [
      'Have hazards been systematically identified across all activities and locations?',
      'Are OH&S risks assessed and controls implemented per the hierarchy of controls?',
      'Is the OH&S policy documented, communicated and accessible to workers?',
      'Are workers consulted and participating in OH&S decisions?',
      'Are legal and other requirements determined, monitored and updated?',
      'Are OH&S objectives established at relevant levels?',
      'Are emergency response plans documented, tested and reviewed?',
      'Is PPE available, suitable and used correctly by workers?',
      'Are incidents, near-misses and non-conformities reported and investigated?',
      'Is health surveillance applied where required?',
      'Are contractor and visitor controls in place?',
      'Are workers trained on relevant OH&S procedures and trained records kept?',
      'Are hazardous substances controlled, labelled and stored properly?',
      'Are workplace inspections and safety walks conducted regularly?',
      'Is corrective action effectiveness verified for OH&S non-conformities?',
      'Is performance evaluation and management review conducted?',
    ],
  },
  {
    code: 'ISO 27001:2022',
    title: 'Information Security Management',
    questions: [
      'Is there an up-to-date asset inventory with assigned owners?',
      'Has an information security risk assessment been performed and documented?',
      'Is there a documented risk treatment plan with selected controls?',
      'Is the Statement of Applicability (SoA) maintained?',
      'Are access control policies defined, enforced and reviewed regularly?',
      'Is multi-factor authentication used for privileged and remote access?',
      'Are user access rights provisioned, modified and revoked timely?',
      'Are cryptographic controls applied to protect sensitive information?',
      'Are physical and environmental security controls implemented?',
      'Are operational procedures (backup, malware, patching) documented and followed?',
      'Are network segmentation and secure communications enforced?',
      'Is secure development lifecycle (SDLC) followed for in-house software?',
      'Are supplier relationships and third-party risk assessed?',
      'Is there a documented incident management process and incidents logged?',
      'Are business continuity and disaster recovery plans tested?',
      'Is awareness training conducted for all personnel?',
      'Are internal audits and management reviews carried out?',
      'Are non-conformities and corrective actions tracked and verified?',
    ],
  },
  {
    code: 'ISO 42001:2023',
    title: 'AI Management System',
    questions: [
      'Is the AI system inventory maintained with purpose, owner and impact?',
      'Has an AI impact assessment been performed for relevant AI systems?',
      'Are AI policies and ethical principles documented and approved?',
      'Are roles and responsibilities for AI governance defined?',
      'Are training data sets evaluated for bias, quality and provenance?',
      'Is model documentation (data, design, evaluation) maintained?',
      'Are model performance and drift monitored in production?',
      'Are explainability requirements addressed for relevant AI use cases?',
      'Is human oversight of AI decisions implemented where required?',
      'Are privacy and security controls applied to AI training and inference data?',
      'Are AI-related incidents reported, investigated and addressed?',
      'Are third-party AI components risk-assessed before use?',
      'Is awareness training conducted for AI users and developers?',
      'Are internal audits performed for the AI management system?',
      'Are management reviews held with AI performance and risk inputs?',
    ],
  },
];

/* ----------------------------------------------------------------
   Helpers
---------------------------------------------------------------- */
const cleanLine = (line: string): string =>
  line
    .replace(/^\s*[-*•]+\s*/, '')        // bullets - * •
    .replace(/^\s*\d+[.)]\s*/, '')        // 1. or 1)
    .replace(/^\s*[a-zA-Z][.)]\s*/, '')   // a. or a)
    .trim();

const parsePastedText = (text: string): string[] =>
  text
    .split(/\r?\n/)
    .map(cleanLine)
    .filter((l) => l.length > 0);

/* ================================================================ */
const BulkAddQuestions: React.FC<BulkAddQuestionsProps> = ({
  open,
  onClose,
  onAdd,
  defaultStandard,
}) => {
  const [tab, setTab] = useState<TabKey>('paste');

  // Paste tab state
  const [pasteText, setPasteText] = useState('');

  // Blanks tab state
  const [blankCount, setBlankCount] = useState<number>(10);

  // Templates tab state
  const initialStd =
    TEMPLATES.find((t) => t.code === defaultStandard)?.code || TEMPLATES[0].code;
  const [selectedStandard, setSelectedStandard] = useState<string>(initialStd);
  const [selectedTplIds, setSelectedTplIds] = useState<Set<number>>(new Set());

  const activeTpl = useMemo(
    () => TEMPLATES.find((t) => t.code === selectedStandard) || TEMPLATES[0],
    [selectedStandard]
  );

  const parsedFromPaste = useMemo(() => parsePastedText(pasteText), [pasteText]);

  if (!open) return null;

  const handleSwitchStandard = (code: string) => {
    setSelectedStandard(code);
    setSelectedTplIds(new Set());
  };

  const toggleTplItem = (idx: number) => {
    setSelectedTplIds((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const selectAllTplItems = () => {
    if (selectedTplIds.size === activeTpl.questions.length) {
      setSelectedTplIds(new Set());
    } else {
      setSelectedTplIds(new Set(activeTpl.questions.map((_, i) => i)));
    }
  };

  const handleAdd = () => {
    if (tab === 'paste') {
      if (parsedFromPaste.length === 0) {
        alert('No questions detected. Paste one question per line.');
        return;
      }
      onAdd(parsedFromPaste);
      setPasteText('');
      onClose();
      return;
    }
    if (tab === 'blanks') {
      const n = Math.max(1, Math.min(200, Number(blankCount) || 0));
      onAdd(new Array(n).fill(''));
      onClose();
      return;
    }
    if (tab === 'templates') {
      const ids = selectedTplIds.size > 0
        ? Array.from(selectedTplIds).sort((a, b) => a - b)
        : activeTpl.questions.map((_, i) => i);
      const lines = ids.map((i) => activeTpl.questions[i]);
      onAdd(lines);
      setSelectedTplIds(new Set());
      onClose();
      return;
    }
  };

  const willAddCount =
    tab === 'paste'
      ? parsedFromPaste.length
      : tab === 'blanks'
      ? Math.max(1, Math.min(200, Number(blankCount) || 0))
      : selectedTplIds.size > 0
      ? selectedTplIds.size
      : activeTpl.questions.length;

  return (
    <div className="bulk-add-overlay" onClick={onClose}>
      <div className="bulk-add-modal" onClick={(e) => e.stopPropagation()}>
        <div className="bulk-add-header">
          <div className="bulk-add-title">
            <span className="bulk-add-icon"><Layers size={18} /></span>
            <div>
              <h3>Bulk Add Checkpoints</h3>
              <p>Add many questions at once instead of one by one</p>
            </div>
          </div>
          <button className="bulk-add-close" onClick={onClose} title="Close">
            <X size={18} />
          </button>
        </div>

        <div className="bulk-add-tabs">
          <button
            className={`bulk-tab ${tab === 'paste' ? 'active' : ''}`}
            onClick={() => setTab('paste')}
          >
            <ClipboardPaste size={14} /> Paste List
          </button>
          <button
            className={`bulk-tab ${tab === 'blanks' ? 'active' : ''}`}
            onClick={() => setTab('blanks')}
          >
            <Plus size={14} /> Add Blanks
          </button>
          <button
            className={`bulk-tab ${tab === 'templates' ? 'active' : ''}`}
            onClick={() => setTab('templates')}
          >
            <Sparkles size={14} /> Use Template
          </button>
        </div>

        <div className="bulk-add-body">
          {tab === 'paste' && (
            <div className="bulk-paste-pane">
              <p className="bulk-hint">
                Paste a list of questions, one per line. Bullets and numbering (e.g. <code>1.</code>, <code>-</code>, <code>•</code>) are stripped automatically.
              </p>
              <textarea
                className="bulk-paste-area"
                placeholder={`1. Is the quality policy maintained?\n2. Are objectives established?\n- Are internal audits conducted?\n• Is documented information controlled?`}
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                rows={10}
              />
              <div className="bulk-preview">
                <strong>{parsedFromPaste.length}</strong> question{parsedFromPaste.length === 1 ? '' : 's'} detected
                {parsedFromPaste.length > 0 && (
                  <ul className="bulk-preview-list">
                    {parsedFromPaste.slice(0, 5).map((line, i) => (
                      <li key={i}>{i + 1}. {line}</li>
                    ))}
                    {parsedFromPaste.length > 5 && (
                      <li className="bulk-preview-more">… and {parsedFromPaste.length - 5} more</li>
                    )}
                  </ul>
                )}
              </div>
            </div>
          )}

          {tab === 'blanks' && (
            <div className="bulk-blanks-pane">
              <p className="bulk-hint">Add a batch of empty checkpoints — fill them in afterwards.</p>
              <div className="bulk-counter">
                <button
                  className="bulk-counter-btn"
                  onClick={() => setBlankCount(Math.max(1, blankCount - 5))}
                  type="button"
                >
                  −5
                </button>
                <button
                  className="bulk-counter-btn"
                  onClick={() => setBlankCount(Math.max(1, blankCount - 1))}
                  type="button"
                >
                  −1
                </button>
                <input
                  type="number"
                  min={1}
                  max={200}
                  value={blankCount}
                  onChange={(e) => setBlankCount(Number(e.target.value) || 1)}
                  className="bulk-counter-input"
                />
                <button
                  className="bulk-counter-btn"
                  onClick={() => setBlankCount(Math.min(200, blankCount + 1))}
                  type="button"
                >
                  +1
                </button>
                <button
                  className="bulk-counter-btn"
                  onClick={() => setBlankCount(Math.min(200, blankCount + 5))}
                  type="button"
                >
                  +5
                </button>
              </div>
              <div className="bulk-quick-presets">
                <span>Quick add:</span>
                {[10, 20, 30, 50, 100].map((n) => (
                  <button
                    key={n}
                    className={`bulk-preset ${blankCount === n ? 'active' : ''}`}
                    onClick={() => setBlankCount(n)}
                    type="button"
                  >
                    {n}
                  </button>
                ))}
              </div>
              <p className="bulk-hint-small">
                Maximum 200 per batch. You can add another batch if needed.
              </p>
            </div>
          )}

          {tab === 'templates' && (
            <div className="bulk-templates-pane">
              <p className="bulk-hint">Pick a standard and select the questions you want to import.</p>
              <div className="bulk-template-tabs">
                {TEMPLATES.map((t) => (
                  <button
                    key={t.code}
                    className={`bulk-template-tab ${selectedStandard === t.code ? 'active' : ''}`}
                    onClick={() => handleSwitchStandard(t.code)}
                    type="button"
                  >
                    {t.code.replace(':', ' • ')}
                  </button>
                ))}
              </div>

              <div className="bulk-template-toolbar">
                <span className="bulk-template-meta">
                  <strong>{activeTpl.title}</strong> — {activeTpl.questions.length} suggested questions
                </span>
                <button className="bulk-mini-btn" onClick={selectAllTplItems} type="button">
                  {selectedTplIds.size === activeTpl.questions.length ? 'Deselect all' : 'Select all'}
                </button>
              </div>

              <div className="bulk-template-list">
                {activeTpl.questions.map((q, i) => (
                  <label key={i} className="bulk-template-item">
                    <input
                      type="checkbox"
                      checked={selectedTplIds.has(i)}
                      onChange={() => toggleTplItem(i)}
                    />
                    <span className="bulk-template-num">{i + 1}.</span>
                    <span className="bulk-template-text">{q}</span>
                  </label>
                ))}
              </div>

              <p className="bulk-hint-small">
                If you don't tick anything, all {activeTpl.questions.length} questions will be added.
              </p>
            </div>
          )}
        </div>

        <div className="bulk-add-footer">
          <div className="bulk-add-summary">
            Will add <strong>{willAddCount}</strong> checkpoint{willAddCount === 1 ? '' : 's'}
          </div>
          <div className="bulk-add-actions">
            <button className="bulk-cancel-btn" onClick={onClose} type="button">
              Cancel
            </button>
            <button
              className="bulk-confirm-btn"
              onClick={handleAdd}
              type="button"
              disabled={tab === 'paste' && parsedFromPaste.length === 0}
            >
              <ChevronRight size={14} /> Add {willAddCount} {tab === 'blanks' ? 'blanks' : 'questions'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BulkAddQuestions;
