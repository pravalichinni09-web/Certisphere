import React, { useState, useEffect } from 'react';
import { X, Check, Award, Plus, Trash2 } from 'lucide-react';
import '../styles/CertificationsPicker.css';

export const DEFAULT_CERTIFICATIONS = [
  'ISO 9001 Lead Auditor',
  'ISO 14001 Lead Auditor',
  'ISO 27001 Lead Auditor',
  'ISO 45001 Lead Auditor',
  'CISA',
  'CISM',
  'ASQ CQA',
];

interface CertificationsPickerProps {
  value: string[];
  onChange: (value: string[]) => void;
  options?: string[];
  placeholder?: string;
  disabled?: boolean;
}

const CertificationsPicker: React.FC<CertificationsPickerProps> = ({
  value,
  onChange,
  options = DEFAULT_CERTIFICATIONS,
  placeholder = 'Click to select certifications',
  disabled = false,
}) => {
  const [open, setOpen] = useState(false);
  const [customInput, setCustomInput] = useState('');
  // Extra (custom) options accumulated while the picker is used
  const [extraOptions, setExtraOptions] = useState<string[]>([]);

  // Whenever `value` contains something not in options, surface it as an extra option
  useEffect(() => {
    if (!value?.length) return;
    setExtraOptions((prev) => {
      const merged = new Set([...prev, ...value.filter((v) => !options.includes(v))]);
      return Array.from(merged);
    });
  }, [value, options]);

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open]);

  const allOptions = Array.from(new Set([...options, ...extraOptions]));

  const toggle = (cert: string) => {
    if (value.includes(cert)) {
      onChange(value.filter((c) => c !== cert));
    } else {
      onChange([...value, cert]);
    }
  };

  const addCustom = () => {
    const v = customInput.trim();
    if (!v) return;
    if (!allOptions.includes(v)) {
      setExtraOptions((prev) => [...prev, v]);
    }
    if (!value.includes(v)) {
      onChange([...value, v]);
    }
    setCustomInput('');
  };

  const removeBadge = (cert: string) => {
    onChange(value.filter((c) => c !== cert));
  };

  return (
    <>
      <button
        type="button"
        className="cert-picker-trigger"
        onClick={() => !disabled && setOpen(true)}
        disabled={disabled}
      >
        {value.length === 0 ? (
          <span className="cert-picker-placeholder">{placeholder}</span>
        ) : (
          <span className="cert-picker-summary">
            <Award size={16} className="cert-picker-summary-icon" />
            <span>
              {value.length} certification{value.length === 1 ? '' : 's'} selected
            </span>
          </span>
        )}
        <span className="cert-picker-action">Edit</span>
      </button>

      {/* Read-only chip preview shown beneath the trigger */}
      {value.length > 0 && (
        <div className="cert-picker-chips">
          {value.map((c) => (
            <span key={c} className="cert-picker-chip">
              {c}
              <button
                type="button"
                aria-label={`Remove ${c}`}
                onClick={() => removeBadge(c)}
                className="cert-picker-chip-remove"
              >
                <X size={12} />
              </button>
            </span>
          ))}
        </div>
      )}

      {open && (
        <div className="cert-picker-overlay" onClick={() => setOpen(false)}>
          <div
            className="cert-picker-modal"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-label="Select certifications"
          >
            <div className="cert-picker-header">
              <div>
                <h3>Select Certifications</h3>
                <p className="cert-picker-sub">
                  Pick one or more from the list, or add a custom certification.
                </p>
              </div>
              <button
                type="button"
                className="cert-picker-close"
                onClick={() => setOpen(false)}
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            <ul className="cert-picker-list">
              {allOptions.map((cert) => {
                const selected = value.includes(cert);
                const isCustom = !options.includes(cert);
                return (
                  <li key={cert}>
                    <button
                      type="button"
                      className={`cert-picker-option ${selected ? 'selected' : ''}`}
                      onClick={() => toggle(cert)}
                    >
                      <span className="cert-picker-option-check">
                        {selected && <Check size={14} />}
                      </span>
                      <Award size={16} className="cert-picker-option-icon" />
                      <span className="cert-picker-option-label">{cert}</span>
                      {isCustom && <span className="cert-picker-custom-tag">Custom</span>}
                    </button>
                  </li>
                );
              })}
            </ul>

            <div className="cert-picker-add-row">
              <input
                type="text"
                value={customInput}
                onChange={(e) => setCustomInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addCustom();
                  }
                }}
                placeholder="Add custom certification..."
                className="cert-picker-add-input"
              />
              <button
                type="button"
                className="cert-picker-add-btn"
                onClick={addCustom}
                disabled={!customInput.trim()}
              >
                <Plus size={14} /> Add
              </button>
            </div>

            {value.length > 0 && (
              <div className="cert-picker-selected">
                <div className="cert-picker-selected-head">
                  <span>Selected ({value.length})</span>
                  <button
                    type="button"
                    className="cert-picker-clear"
                    onClick={() => onChange([])}
                  >
                    <Trash2 size={12} /> Clear
                  </button>
                </div>
                <div className="cert-picker-chips">
                  {value.map((c) => (
                    <span key={c} className="cert-picker-chip">
                      {c}
                      <button
                        type="button"
                        aria-label={`Remove ${c}`}
                        onClick={() => removeBadge(c)}
                        className="cert-picker-chip-remove"
                      >
                        <X size={12} />
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="cert-picker-footer">
              <button
                type="button"
                className="cert-picker-done"
                onClick={() => setOpen(false)}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default CertificationsPicker;
