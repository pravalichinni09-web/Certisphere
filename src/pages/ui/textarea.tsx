import React from 'react';

export const Textarea: React.FC<React.TextareaHTMLAttributes<HTMLTextAreaElement>> = ({ className = '', ...rest }) => (
  <textarea className={`textarea ${className}`} {...rest} />
);

export default Textarea;
