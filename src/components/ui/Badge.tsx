import * as React from 'react';

export type BadgeVariant =
  | 'default'
  | 'secondary'
  | 'outline'
  | 'success'
  | 'warning'
  | 'critical'
  | 'info';

interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: BadgeVariant;
  dot?: boolean;
}

const variantStyles: Record<BadgeVariant, string> = {
  default: 'bg-neutral-900 text-neutral-200 border-neutral-700',
  secondary: 'bg-neutral-900/80 text-neutral-300 border-neutral-800',
  outline: 'border-neutral-700 text-neutral-300 bg-transparent',
  success: 'bg-neutral-900 text-neutral-100 border-neutral-600',
  warning: 'bg-neutral-950 text-neutral-300 border-neutral-700 border-dashed',
  critical: 'bg-neutral-100 text-neutral-950 border-white font-semibold',
  info: 'bg-neutral-900 text-neutral-200 border-neutral-700',
};

const dotStyles: Record<BadgeVariant, string> = {
  default: 'bg-neutral-400',
  secondary: 'bg-neutral-500',
  outline: 'bg-neutral-400',
  success: 'bg-neutral-200',
  warning: 'bg-neutral-400',
  critical: 'bg-neutral-950',
  info: 'bg-neutral-300',
};

export function Badge({
  className = '',
  variant = 'default',
  dot = false,
  children,
  ...props
}: BadgeProps) {
  return (
    <div
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium tracking-wide uppercase transition-colors ${variantStyles[variant]} ${className}`}
      {...props}
    >
      {dot && <span className={`h-1.5 w-1.5 rounded-full ${dotStyles[variant]}`} />}
      {children}
    </div>
  );
}
