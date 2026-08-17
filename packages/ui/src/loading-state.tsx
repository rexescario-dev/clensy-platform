export interface LoadingStateProps {
  message?: string;
}

export function LoadingState({ message = 'Loading…' }: LoadingStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-3 py-10 text-slate-500">
      <span
        role="status"
        aria-label={message}
        className="h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600"
      />
      <p className="text-sm">{message}</p>
    </div>
  );
}
