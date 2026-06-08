export function ErrorBanner({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="p-4 bg-red-500/10 border border-red-500/30 text-red-400 text-[11px] font-mono flex items-center justify-between">
      <span>⚠ {message}</span>
      {onRetry && (
        <button onClick={onRetry} className="text-[var(--rolex-gold)] underline ml-4">
          Retry
        </button>
      )}
    </div>
  );
}
