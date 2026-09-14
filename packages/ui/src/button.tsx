import type { ButtonHTMLAttributes } from 'react';

export type ButtonVariant = 'danger' | 'primary' | 'secondary';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
}

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  danger: 'bg-red-600 text-white hover:bg-red-500',
  primary: 'bg-slate-900 text-white hover:bg-slate-700',
  secondary: 'bg-white text-slate-900 border border-slate-300 hover:bg-slate-50',
};

export function Button({ variant = 'primary', className, type = 'button', ...props }: ButtonProps) {
  const classes = [
    'inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed',
    VARIANT_CLASSES[variant],
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return <button type={type} className={classes} {...props} />;
}
