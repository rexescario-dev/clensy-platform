export type StatusTone = 'success' | 'warning' | 'danger' | 'neutral';

export interface StatusBadgeProps {
  label: string;
  tone?: StatusTone;
}

const TONE_CLASSES: Record<StatusTone, string> = {
  success: 'bg-green-100 text-green-800',
  warning: 'bg-amber-100 text-amber-800',
  danger: 'bg-red-100 text-red-800',
  neutral: 'bg-slate-100 text-slate-700',
};

export function StatusBadge({ label, tone = 'neutral' }: StatusBadgeProps) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${TONE_CLASSES[tone]}`}>
      {label}
    </span>
  );
}
