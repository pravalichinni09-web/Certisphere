import React from 'react';

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'outline' | 'solid' | string;
}

export const Badge: React.FC<BadgeProps> = ({ children, className = '', variant, ...rest }) => (
  <span className={`badge ${variant ? `badge-${variant}` : ''} ${className}`} {...rest}>{children}</span>
);

export default Badge;
