import React from 'react';
import { Check } from 'lucide-react';

export interface WizardStep {
  key: string;
  label: string;
  optional?: boolean;
}

interface Props {
  steps: WizardStep[];
  currentIndex: number;
  /** Set of step keys that have been completed (independent of position). */
  completedKeys?: Set<string>;
  onSelect?: (index: number) => void;
}

const WizardSteps: React.FC<Props> = ({ steps, currentIndex, completedKeys, onSelect }) => {
  return (
    <ol className="cms-wizard">
      {steps.map((s, i) => {
        const done = completedKeys?.has(s.key) || i < currentIndex;
        const active = i === currentIndex;
        const cls = ['cms-wizard__step'];
        if (done) cls.push('is-done');
        if (active) cls.push('is-active');
        return (
          <li key={s.key} className={cls.join(' ')}>
            <button
              type="button"
              className="cms-wizard__btn"
              onClick={() => onSelect?.(i)}
              aria-current={active ? 'step' : undefined}
            >
              <span className="cms-wizard__bullet">
                {done ? <Check size={12} /> : <span>{i + 1}</span>}
              </span>
              <span className="cms-wizard__label">
                {s.label}
                {s.optional ? <small> · optional</small> : null}
              </span>
            </button>
            {i < steps.length - 1 ? <span className="cms-wizard__line" /> : null}
          </li>
        );
      })}
    </ol>
  );
};

export default WizardSteps;
