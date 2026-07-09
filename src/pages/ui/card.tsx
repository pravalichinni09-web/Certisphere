import React from 'react';

export const Card: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ children, className = '', ...rest }) => (
  <div className={`card ${className}`} {...rest}>
    {children}
  </div>
);

export const CardHeader: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ children, className = '', ...rest }) => (
  <div className={`card-header ${className}`} {...rest}>{children}</div>
);

export const CardContent: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ children, className = '', ...rest }) => (
  <div className={`card-content ${className}`} {...rest}>{children}</div>
);

export const CardTitle: React.FC<React.HTMLAttributes<HTMLHeadingElement>> = ({ children, className = '', ...rest }) => (
  <h3 className={`card-title ${className}`} {...rest}>{children}</h3>
);

export default Card;
