import type { InputHTMLAttributes } from 'react';

export interface FormFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  name: string;
  error?: string;
}

export function FormField({ label, name, error, className, ...props }: FormFieldProps) {
  const inputClasses = [
    'rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400',
    error ? 'border-red-500' : 'border-slate-300',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={name} className="text-sm font-medium text-slate-700">
        {label}
      </label>
      <input
        id={name}
        name={name}
        className={inputClasses}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${name}-error` : undefined}
        {...props}
      />
      {error ? (
        <p id={`${name}-error`} className="text-sm text-red-600">
          {error}
        </p>
      ) : null}
    </div>
  );
}
