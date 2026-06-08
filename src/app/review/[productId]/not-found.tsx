import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[var(--bg-primary)] flex flex-col items-center justify-center font-sans text-white px-4">
      <div className="border border-[var(--border-dark)] bg-[#050505] p-12 max-w-lg w-full text-center">
        <div className="text-[var(--rolex-gold)] mb-6">
          <svg className="w-16 h-16 mx-auto opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h1 className="text-3xl font-bold uppercase tracking-tight mb-2">Target Not Found</h1>
        <p className="text-[10px] font-mono text-[var(--text-muted)] uppercase tracking-widest mb-8">
          The requested asset could not be located for verification.
        </p>
        <Link href="/products" className="inline-block px-8 py-3 bg-[var(--rolex-gold)] text-black text-[10px] font-mono font-bold tracking-widest uppercase hover:bg-white transition-colors">
          RETURN TO CATALOG
        </Link>
      </div>
    </div>
  );
}
