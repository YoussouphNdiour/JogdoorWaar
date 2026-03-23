import * as React from 'react';
import { cn } from '../utils/cn';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'terracotta' | 'savane' | 'gold' | 'outline';
}

const variantStyles = {
  default: 'bg-sand-dark text-savane',
  terracotta: 'bg-terracotta/10 text-terracotta',
  savane: 'bg-savane/10 text-savane',
  gold: 'bg-gold/20 text-savane-700',
  outline: 'border border-savane/30 text-savane',
};

export function Badge({ variant = 'default', className, children, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-dm font-medium',
        variantStyles[variant],
        className,
      )}
      {...props}
    >
      {children}
    </span>
  );
}
