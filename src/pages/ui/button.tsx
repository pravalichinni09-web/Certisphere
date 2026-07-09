import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  size?: 'sm' | 'md' | 'lg';
  variant?: 'outline' | 'destructive' | 'default';
}

export const Button: React.FC<ButtonProps> = ({ children, className = '', size = 'md', variant, ...rest }) => {
  const sizeClass = size === 'sm' ? 'btn-sm' : size === 'lg' ? 'btn-lg' : '';
  const variantClass = variant ? `btn-${variant}` : '';
  return (
    <button className={`btn ${sizeClass} ${variantClass} ${className}`} {...rest}>
      {children}
    </button>
  );
};

export default Button;
