import React from 'react';
import { diffLines, summarizeDiff } from '../utils/textDiff';

interface Props {
  oldText: string;
  newText: string;
  oldLabel?: string;
  newLabel?: string;
}

const TextDiffView: React.FC<Props> = ({ oldText, newText, oldLabel = 'Previous', newLabel = 'Current' }) => {
  const diff = diffLines(oldText, newText);
  const summary = summarizeDiff(diff);
  return (
    <div className="diff-view">
      <div className="diff-view__head">
        <span className="diff-view__chip diff-view__chip--add">+{summary.added} added</span>
        <span className="diff-view__chip diff-view__chip--rem">-{summary.removed} removed</span>
        <span className="diff-view__chip diff-view__chip--eq">{summary.equal} unchanged</span>
        <span className="diff-view__caption">{oldLabel} → {newLabel}</span>
      </div>
      <pre className="diff-view__body">
        {diff.map((d, i) => (
          <div key={i} className={`diff-line diff-line--${d.op}`}>
            <span className="diff-line__no">
              {d.op !== 'add' ? d.oldNo ?? '' : ''}
            </span>
            <span className="diff-line__no">
              {d.op !== 'remove' ? d.newNo ?? '' : ''}
            </span>
            <span className="diff-line__sign">
              {d.op === 'add' ? '+' : d.op === 'remove' ? '-' : ' '}
            </span>
            <span className="diff-line__text">{d.text || ' '}</span>
          </div>
        ))}
      </pre>
    </div>
  );
};

export default TextDiffView;
