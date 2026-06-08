'use client';
import { use } from 'react';
import { Box } from 'lucide-react';
import Link from 'next/link';

export default function Secure3DViewer({ params }: { params: Promise<{ id: string }> }) {
  const unwrappedParams = use(params);
  const id = unwrappedParams.id;

  return (
    <div className="bg-[#020202] min-h-screen text-white font-mono flex flex-col items-center justify-center p-6">
      <Box size={48} className="text-white/20 mb-8" />
      <div className="text-[14px] font-bold tracking-[0.2em] uppercase text-center mb-4">
        3D Viewer — Coming Phase 2
      </div>
      <p className="text-[10px] text-white/40 text-center max-w-md leading-relaxed uppercase tracking-widest mb-12">
        Full WebGL asset rendering and spatial data visualization for Asset ID: {id} is scheduled for our Phase 2 protocol upgrade. We do not simulate metrics.
      </p>
      <Link href="/" className="px-8 py-3 border border-white/10 hover:bg-white/5 transition-colors text-[10px] uppercase tracking-widest">
        Return to Protocol
      </Link>
    </div>
  );
}
