import React from 'react';

export const Label: React.FC<React.LabelHTMLAttributes<HTMLLabelElement>> = ({ children, className = '', ...rest }) => (
  <label className={`label ${className}`} {...rest}>{children}</label>
);

export default Label;
