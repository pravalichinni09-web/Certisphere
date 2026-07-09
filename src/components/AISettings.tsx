import React, { useEffect, useState } from 'react';
import {
  KeyRound,
  Sparkles,
  Eye,
  EyeOff,
  Trash2,
  Check,
  AlertCircle,
  Loader2,
  ExternalLink,
} from 'lucide-react';
import {
  getApiKey,
  setApiKey,
  clearApiKey,
  getModel,
  setModel,
  SUPPORTED_MODELS,
  isClaudeConfigured,
  complete,
  onClaudeConfigChange,
} from '../ai/claudeClient';
import '../styles/AISettings.css';

interface AISettingsProps {
  onClose?: () => void;
}

const AISettings: React.FC<AISettingsProps> = ({ onClose }) => {
  const [keyDraft, setKeyDraft] = useState('');
  const [modelChoice, setModelChoice] = useState(getModel());
  const [reveal, setReveal] = useState(false);
  const [savedKey, setSavedKey] = useState<string | null>(getApiKey());
  const [busy, setBusy] = useState<'idle' | 'saving' | 'testing'>('idle');
  const [feedback, setFeedback] = useState<
    | { kind: 'ok'; text: string }
    | { kind: 'error'; text: string }
    | null
  >(null);

  useEffect(() => {
    const off = onClaudeConfigChange(() => {
      setSavedKey(getApiKey());
      setModelChoice(getModel());
    });
    return off;
  }, []);

  const masked = (k: string) => {
    if (!k) return '';
    if (k.length <= 12) return '*'.repeat(k.length);
    return `${k.slice(0, 7)}${'*'.repeat(k.length - 11)}${k.slice(-4)}`;
  };

  const handleSave = () => {
    const trimmed = keyDraft.trim();
    if (!trimmed) {
      setFeedback({ kind: 'error', text: 'Paste a key before saving.' });
      return;
    }
    if (!trimmed.startsWith('sk-')) {
      setFeedback({
        kind: 'error',
        text: "That doesn't look like an Anthropic key (expected to start with sk-).",
      });
      return;
    }
    setBusy('saving');
    setApiKey(trimmed);
    setModel(modelChoice);
    setSavedKey(trimmed);
    setKeyDraft('');
    setBusy('idle');
    setFeedback({ kind: 'ok', text: 'Saved. Claude is now connected.' });
  };

  const handleRemove = () => {
    clearApiKey();
    setSavedKey(null);
    setKeyDraft('');
    setReveal(false);
    setFeedback({ kind: 'ok', text: 'Key removed. Falling back to smart-mock mode.' });
  };

  const handleTest = async () => {
    if (!isClaudeConfigured()) {
      setFeedback({ kind: 'error', text: 'Save a key first.' });
      return;
    }
    setBusy('testing');
    setFeedback(null);
    try {
      const text = await complete(
        'Reply with the single word "ready" and nothing else.',
        { maxTokens: 16, temperature: 0 }
      );
      const ok = /ready/i.test(text);
      setFeedback(
        ok
          ? { kind: 'ok', text: `Round-trip works (${getModel()}).` }
          : { kind: 'error', text: `Connected, but got an unexpected reply: "${text}"` }
      );
    } catch (e: unknown) {
      const msg = (e as Error)?.message || 'Unknown error';
      setFeedback({ kind: 'error', text: msg });
    } finally {
      setBusy('idle');
    }
  };

  const handleModelChange = (id: string) => {
    setModelChoice(id);
    setModel(id);
  };

  return (
    <div className="ai-settings">
      <header className="ai-settings__head">
        <div className="ai-settings__head-left">
          <div className="ai-settings__icon">
            <Sparkles size={20} />
          </div>
          <div>
            <h2>AI Settings</h2>
            <p>Connect your Anthropic API key to power the Qmics AI Agent with Claude.</p>
          </div>
        </div>
        {onClose && (
          <button className="ai-settings__close" onClick={onClose} aria-label="Close">
            ×
          </button>
        )}
      </header>

      <section className="ai-settings__section">
        <div className="ai-settings__label">
          <KeyRound size={14} />
          <span>Anthropic API key</span>
        </div>

        {savedKey ? (
          <div className="ai-settings__saved">
            <code className="ai-settings__masked">
              {reveal ? savedKey : masked(savedKey)}
            </code>
            <div className="ai-settings__saved-actions">
              <button
                type="button"
                className="ai-btn ai-btn--ghost"
                onClick={() => setReveal((r) => !r)}
              >
                {reveal ? <EyeOff size={14} /> : <Eye size={14} />}
                {reveal ? 'Hide' : 'Reveal'}
              </button>
              <button
                type="button"
                className="ai-btn ai-btn--danger"
                onClick={handleRemove}
              >
                <Trash2 size={14} />
                Remove
              </button>
            </div>
            <p className="ai-settings__hint">
              Stored in your browser's localStorage only. Calls go directly from this
              page to api.anthropic.com.
            </p>
          </div>
        ) : (
          <div className="ai-settings__entry">
            <div className="ai-settings__field">
              <input
                type={reveal ? 'text' : 'password'}
                placeholder="sk-ant-..."
                value={keyDraft}
                onChange={(e) => setKeyDraft(e.target.value)}
                autoComplete="off"
                spellCheck={false}
              />
              <button
                type="button"
                className="ai-settings__eye"
                onClick={() => setReveal((r) => !r)}
                aria-label={reveal ? 'Hide key' : 'Show key'}
              >
                {reveal ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
            <p className="ai-settings__hint">
              Get a key from{' '}
              <a
                href="https://console.anthropic.com/settings/keys"
                target="_blank"
                rel="noreferrer"
              >
                console.anthropic.com <ExternalLink size={11} />
              </a>
              . The key never leaves your browser.
            </p>
          </div>
        )}
      </section>

      <section className="ai-settings__section">
        <div className="ai-settings__label">
          <Sparkles size={14} />
          <span>Model</span>
        </div>
        <div className="ai-settings__models">
          {SUPPORTED_MODELS.map((m) => (
            <label
              key={m.id}
              className={`ai-settings__model ${
                modelChoice === m.id ? 'is-active' : ''
              }`}
            >
              <input
                type="radio"
                name="cms-claude-model"
                value={m.id}
                checked={modelChoice === m.id}
                onChange={() => handleModelChange(m.id)}
              />
              <div>
                <div className="ai-settings__model-name">{m.label}</div>
                <div className="ai-settings__model-desc">{m.description}</div>
              </div>
            </label>
          ))}
        </div>
      </section>

      {feedback && (
        <div
          className={`ai-settings__feedback ${
            feedback.kind === 'ok' ? 'is-ok' : 'is-error'
          }`}
        >
          {feedback.kind === 'ok' ? <Check size={14} /> : <AlertCircle size={14} />}
          <span>{feedback.text}</span>
        </div>
      )}

      <footer className="ai-settings__foot">
        <button
          type="button"
          className="ai-btn ai-btn--ghost"
          onClick={handleTest}
          disabled={busy !== 'idle' || !savedKey}
        >
          {busy === 'testing' ? <Loader2 className="spin" size={14} /> : <Sparkles size={14} />}
          Test connection
        </button>
        {!savedKey && (
          <button
            type="button"
            className="ai-btn ai-btn--primary"
            onClick={handleSave}
            disabled={busy !== 'idle'}
          >
            {busy === 'saving' ? <Loader2 className="spin" size={14} /> : <Check size={14} />}
            Save key
          </button>
        )}
      </footer>
    </div>
  );
};

export default AISettings;
