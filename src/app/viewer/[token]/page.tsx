'use client';

import React, { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { Lock, Shield, ExternalLink } from 'lucide-react';
import { Building3DView } from '@/components/archionlabs/Building3DView';
import type { BuildResult } from '@/components/archionlabs/BuildPanel';
import { ARCHION_PORTFOLIO_DEMO_BUILD } from '@/lib/archion-demo-seed';

interface ShareMeta {
  password_required: boolean;
  watermark: boolean;
  watermark_text: string;
  client_name: string;
  building_name: string;
  compliance_score: number;
  expires_at: string;
  rooms: BuildResult['rooms'];
}

export default function PublicArchionViewerPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = use(params);
  const [meta, setMeta] = useState<ShareMeta | null>(null);
  const [error, setError] = useState('');
  const [password, setPassword] = useState('');
  const [unlocked, setUnlocked] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/archionlabs/viewer/share/${encodeURIComponent(token)}`);
        const data = await res.json();
        if (!res.ok) {
          setError(data.error || 'This share link is no longer available.');
          return;
        }
        setMeta(data as ShareMeta);
        if (!data.password_required) setUnlocked(true);
      } catch {
        setError('Unable to load secure viewer.');
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  const tryUnlock = async () => {
    setError('');
    const res = await fetch('/api/archionlabs/viewer/unlock', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, password }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || 'Incorrect password.');
      return;
    }
    setUnlocked(true);
  };

  const buildFor3d: BuildResult = meta
    ? {
        ...ARCHION_PORTFOLIO_DEMO_BUILD,
        building_name: meta.building_name,
        rooms: meta.rooms.length ? meta.rooms : ARCHION_PORTFOLIO_DEMO_BUILD.rooms,
      }
    : ARCHION_PORTFOLIO_DEMO_BUILD;

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center text-[var(--rolex-gold)] font-mono text-[10px] uppercase tracking-[0.3em]">
        Verifying secure token…
      </div>
    );
  }

  if (error && !meta) {
    return (
      <div className="min-h-screen bg-[#050505] flex flex-col items-center justify-center gap-6 px-6 text-center">
        <p className="text-red-400 font-mono text-sm uppercase tracking-widest">{error}</p>
        <Link href="/archionlabs?tab=viewer&portfolio=1" className="text-[var(--rolex-gold)] text-[10px] font-mono uppercase tracking-widest">
          Open Tokenly Build Viewer
        </Link>
      </div>
    );
  }

  if (!unlocked && meta?.password_required) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center px-4">
        <div className="w-full max-w-md border border-[var(--border-dark)] bg-[#0A0A0A] p-10">
          <div className="flex items-center gap-3 mb-6 text-[var(--rolex-gold)]">
            <Lock size={20} />
            <span className="text-[10px] font-mono uppercase tracking-[0.25em] font-bold">Protected Model</span>
          </div>
          <p className="text-sm text-[var(--text-muted)] mb-6">
            {meta.client_name} shared this 3D model with password protection. Enter the passphrase to continue.
          </p>
          <input
            type="password"
            className="w-full bg-[#050505] border border-[var(--border-dark)] px-4 py-3 text-white font-mono text-sm mb-4 focus:border-[var(--rolex-gold)] outline-none"
            placeholder="Access passphrase"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && void tryUnlock()}
          />
          {error && <p className="text-red-400 text-[10px] font-mono mb-4">{error}</p>}
          <button
            type="button"
            onClick={() => void tryUnlock()}
            className="w-full py-3 bg-[var(--rolex-gold)] text-black text-[10px] font-mono font-bold uppercase tracking-widest"
          >
            Unlock Viewer
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] text-white">
      <header className="border-b border-[var(--border-dark)] px-4 py-4 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-[8px] font-mono uppercase tracking-[0.3em] text-[var(--rolex-gold)] mb-1">Tokenly Build · Viewer</p>
          <h1 className="text-lg font-bold tracking-tight">{meta?.building_name ?? 'Secure 3D Model'}</h1>
          <p className="text-[9px] font-mono text-[var(--text-muted)] mt-1">
            Token {token.slice(0, 12)}… · Compliance {meta?.compliance_score ?? '—'}%
          </p>
        </div>
        <div className="flex items-center gap-2 text-[9px] font-mono text-[var(--text-muted)]">
          <Shield size={14} className="text-[var(--rolex-gold)]" />
          Dual-layer watermark active
          <a
            href="https://chenitha.net/#projects"
            target="_blank"
            rel="noopener noreferrer"
            className="ml-4 inline-flex items-center gap-1 text-[var(--rolex-gold)] hover:underline"
          >
            Portfolio <ExternalLink size={10} />
          </a>
        </div>
      </header>

      <div className="relative h-[calc(100vh-88px)]">
        <Building3DView result={buildFor3d} />
        {meta?.watermark && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden opacity-[0.12]">
            <p className="text-[var(--rolex-gold)] font-mono text-xs uppercase tracking-[0.4em] rotate-[-24deg] whitespace-nowrap select-none">
              {meta.watermark_text || 'ARCHIONLABS · CONFIDENTIAL'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
