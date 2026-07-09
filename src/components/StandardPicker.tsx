import React, { useState, useEffect } from 'react';
import { ChevronDown, X, Check, Award } from 'lucide-react';
import '../styles/StandardPicker.css';

// Central list of supported standards — edit here to update everywhere
export const STANDARDS: { value: string; title: string; subtitle: string }[] = [
  { value: 'ISO 9001:2015', title: 'ISO 9001:2015', subtitle: 'Quality Management System' },
  { value: 'ISO 14001:2015', title: 'ISO 14001:2015', subtitle: 'Environmental Management System' },
  { value: 'ISO 45001:2018', title: 'ISO 45001:2018', subtitle: 'Occupational Health & Safety' },
  { value: 'ISO 27001:2022', title: 'ISO 27001:2022', subtitle: 'Information Security Management' },
  { value: 'ISO 42001:2023', title: 'ISO 42001:2023', subtitle: 'AI Management System' },
];

export const STANDARD_VALUES = STANDARDS.map((s) => s.value);

interface StandardPickerProps {
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  placeholder?: string;
  disabled?: boolean;
  id?: string;
  name?: string;
}

const StandardPicker: React.FC<StandardPickerProps> = ({
  value,
  onChange,
  required = false,
  placeholder = 'Select a standard',
  disabled = false,
  id,
  name,
}) => {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open]);

  const handleSelect = (v: string) => {
    onChange(v);
    setOpen(false);
  };

  const selected = STANDARDS.find((s) => s.value === value);

  return (
    <>
      {/* Hidden field for native form validation when required */}
      {required && (
        <input
          type="text"
          tabIndex={-1}
          required
          value={value || ''}
          onChange={() => {}}
          style={{
            position: 'absolute',
            opacity: 0,
            height: 0,
            width: 0,
            pointerEvents: 'none',
          }}
          aria-hidden="true"
        />
      )}

      <button
        type="button"
        id={id}
        name={name}
        className={`standard-picker-trigger ${!value ? 'is-empty' : ''}`}
        onClick={() => !disabled && setOpen(true)}
        disabled={disabled}
      >
        <span className="standard-picker-value">
          {selected ? (
            <>
              <Award size={16} className="standard-picker-icon" />
              <span>
                <strong>{selected.title}</strong>
                <small>{selected.subtitle}</small>
              </span>
            </>
          ) : (
            <span className="standard-picker-placeholder">{placeholder}</span>
          )}
        </span>
        <ChevronDown size={18} className="standard-picker-caret" />
      </button>

      {open && (
        <div className="standard-picker-overlay" onClick={() => setOpen(false)}>
          <div
            className="standard-picker-modal"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-label="Select standard"
          >
            <div className="standard-picker-header">
              <h3>Select Standard</h3>
              <button
                type="button"
                className="standard-picker-close"
                onClick={() => setOpen(false)}
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>
            <ul className="standard-picker-list">
              {STANDARDS.map((s) => (
                <li key={s.value}>
                  <button
                    type="button"
                    className={`standard-picker-option ${
                      s.value === value ? 'selected' : ''
                    }`}
                    onClick={() => handleSelect(s.value)}
                  >
                    <div className="standard-picker-option-main">
                      <Award size={18} className="standard-picker-option-icon" />
                      <div>
                        <div className="standard-picker-option-title">{s.title}</div>
                        <div className="standard-picker-option-sub">{s.subtitle}</div>
                      </div>
                    </div>
                    {s.value === value && <Check size={18} className="standard-picker-check" />}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </>
  );
};

export default StandardPicker;
