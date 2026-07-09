import React from 'react';

interface DialogProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children?: React.ReactNode;
}

export const Dialog: React.FC<DialogProps> = ({ children }) => {
  // Minimal wrapper: render children directly
  return <div className="dialog-root">{children}</div>;
};

export const DialogContent: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ children, className = '', ...rest }) => (
  <div className={`dialog-content ${className}`} {...rest}>{children}</div>
);

export const DialogHeader: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ children, className = '', ...rest }) => (
  <div className={`dialog-header ${className}`} {...rest}>{children}</div>
);

export const DialogTitle: React.FC<React.HTMLAttributes<HTMLHeadingElement>> = ({ children, className = '', ...rest }) => (
  <h3 className={`dialog-title ${className}`} {...rest}>{children}</h3>
);

export const DialogDescription: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ children, className = '', ...rest }) => (
  <div className={`dialog-description ${className}`} {...rest}>{children}</div>
);

export const DialogFooter: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ children, className = '', ...rest }) => (
  <div className={`dialog-footer ${className}`} {...rest}>{children}</div>
);

export default Dialog;
