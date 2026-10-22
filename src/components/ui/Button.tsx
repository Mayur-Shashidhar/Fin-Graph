import * as React from 'react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'outline' | 'ghost' | 'secondary' | 'danger';
  size?: 'sm' | 'md' | 'lg';
}

export function Button({
  className = '',
  variant = 'default',
  size = 'md',
  children,
  ...props
}: ButtonProps) {
  const base =
    'inline-flex items-center justify-center font-medium rounded-lg transition-all focus:outline-none focus:ring-2 focus:ring-neutral-400 disabled:opacity-40 disabled:pointer-events-none cursor-pointer';

  const variants = {
    default: 'bg-white hover:bg-neutral-200 text-black border border-white font-medium',
    outline: 'border border-neutral-700 bg-neutral-950 hover:bg-neutral-900 text-neutral-200',
    ghost: 'hover:bg-neutral-900 text-neutral-400 hover:text-white',
    secondary: 'bg-neutral-900 hover:bg-neutral-800 text-neutral-100 border border-neutral-800',
    danger: 'bg-neutral-900 hover:bg-neutral-800 text-white border border-neutral-600',
  };

  const sizes = {
    sm: 'text-xs px-3 py-1.5 gap-1.5',
    md: 'text-sm px-4 py-2 gap-2',
    lg: 'text-base px-5 py-2.5 gap-2.5',
  };

  return (
    <button
      className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
