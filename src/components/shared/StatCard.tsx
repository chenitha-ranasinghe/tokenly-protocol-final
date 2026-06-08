interface StatCardProps {
  label: string;
  value: string | number;
  sub?: string;
  highlight?: boolean;
}
export function StatCard({ label, value, sub, highlight }: StatCardProps) {
  return (
    <div className="p-6 bg-[#0A0A0A] border border-[var(--border-dark)]">
      <div className={`text-2xl font-bold font-mono tracking-tight mb-1 ${highlight ? 'text-[var(--rolex-gold)]' : 'text-white'}`}>
        {typeof value === 'number' ? value.toLocaleString() : value}
      </div>
      <div className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">{label}</div>
      {sub && <div className="text-[9px] font-mono text-[var(--text-muted)] opacity-60 mt-1">{sub}</div>}
    </div>
  );
}
