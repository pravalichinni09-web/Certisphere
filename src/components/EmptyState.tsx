import React from 'react';
import { Inbox } from 'lucide-react';
import '../styles/EmptyState.css';

export interface EmptyStateProps {
  /** Optional icon node (defaults to Inbox). Pass any lucide icon. */
  icon?: React.ReactNode;
  /** Bold heading. */
  title: string;
  /** Supporting copy underneath. */
  description?: React.ReactNode;
  /** Optional primary call-to-action. */
  actionLabel?: string;
  /** Click handler for the call-to-action. */
  onAction?: () => void;
  /** Variant changes the surface treatment. */
  variant?: 'card' | 'inline' | 'page';
  /** Optional secondary action rendered next to the primary one. */
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
  /** Override the default illustration / icon size. */
  iconSize?: number;
  className?: string;
}

const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  actionLabel,
  onAction,
  secondaryActionLabel,
  onSecondaryAction,
  variant = 'card',
  iconSize = 36,
  className = '',
}) => {
  return (
    <div className={`cms-empty-state cms-empty-state--${variant} ${className}`.trim()}>
      <div className="cms-empty-state__icon" aria-hidden="true">
        {icon || <Inbox size={iconSize} strokeWidth={1.5} />}
      </div>
      <div className="cms-empty-state__copy">
        <h3 className="cms-empty-state__title">{title}</h3>
        {description && (
          <p className="cms-empty-state__description">{description}</p>
        )}
      </div>
      {(actionLabel || secondaryActionLabel) && (
        <div className="cms-empty-state__actions">
          {actionLabel && onAction && (
            <button
              type="button"
              className="cms-empty-state__btn cms-empty-state__btn--primary"
              onClick={onAction}
            >
              {actionLabel}
            </button>
          )}
          {secondaryActionLabel && onSecondaryAction && (
            <button
              type="button"
              className="cms-empty-state__btn cms-empty-state__btn--secondary"
              onClick={onSecondaryAction}
            >
              {secondaryActionLabel}
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default EmptyState;
