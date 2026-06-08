export function LoadingSpinner({ label = 'Processing Intelligence...' }: { label?: string }) {
  return (
    <div className="min-h-screen bg-[#050505] flex items-center justify-center">
      <div className="flex flex-col items-center gap-6">
        <div className="relative">
          <div className="w-12 h-12 border border-[var(--rolex-gold)]/20 rounded-full" />
          <div className="absolute inset-0 w-12 h-12 border-t-2 border-[var(--rolex-gold)] rounded-full animate-spin" />
          <div className="absolute inset-2 w-8 h-8 border border-[var(--rolex-gold)]/10 rounded-full animate-pulse" />
        </div>
        <div className="flex flex-col items-center gap-2">
          <span className="text-[9px] font-mono uppercase tracking-[0.4em] text-[var(--rolex-gold)] font-bold">{label}</span>
          <div className="flex gap-1">
            {[0, 1, 2].map(i => (
              <div 
                key={i} 
                className="w-1 h-1 bg-[var(--rolex-gold)]/40 rounded-full animate-bounce" 
                style={{ animationDelay: `${i * 0.15}s` }} 
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
