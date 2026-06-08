'use client';

import React, {
  useState, useRef, useEffect, useCallback,
} from 'react';
import {
  Lock, Share2, Eye, Copy, Check, Shield, Clock,
  Layers, AlertCircle, Key, QrCode, Code, ExternalLink,
  Download, Users, Upload, Cpu,
} from 'lucide-react';
import { PanelLoader, PanelEmpty } from './CompliancePanel';
import type { BuildResult } from './BuildPanel';
import Building3D from './Building3D';
import type { ModelType } from './Building3D';
import QRCode from 'qrcode';

// ─────────────────────────────────────────────────────────────────────────────
// RealQRCode component using the 'qrcode' library
// ─────────────────────────────────────────────────────────────────────────────
function RealQRCode({ value, size = 150 }: { value: string; size?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (canvasRef.current) {
      QRCode.toCanvas(
        canvasRef.current,
        value,
        {
          width: size,
          margin: 1,
          color: {
            dark: '#000000',
            light: '#ffffff',
          },
        },
        (error) => {
          if (error) console.error('[QRCODE] Error generating QR code:', error);
        }
      );
    }
  }, [value, size]);

  return <canvas ref={canvasRef} style={{ width: size, height: size }} />;
}

// ─────────────────────────────────────────────────────────────────────────────
// Exported types
// ─────────────────────────────────────────────────────────────────────────────
export interface ViewerResult {
  success: boolean;
  powered_by: string;
  share_token: string;
  share_url: string;
  full_share_url: string;
  password_protected: boolean;
  expires_at: string;
  expiry_hours: number;
  watermark_enabled: boolean;
  client_name: string;
  security: {
    token_type: string;
    encryption: string;
    access_log: boolean;
    max_views?: number;
    dual_layer_watermark: boolean;
    watermark_text?: string;
  };
  model_id: string;
  name?: string;
  floors?: number;
  total_area_sqm?: number;
  compliance_score?: number;
  last_inspection?: string;
  elements?: { type: string; count: number; status: string }[];
  render_quality?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Simulated access log entries (appear once a token is generated)
// ─────────────────────────────────────────────────────────────────────────────
const ACCESS_LOG = [
  { ip: '112.134.xx.xx', country: 'Sri Lanka',     time: '2 min ago',  action: 'Viewed'    },
  { ip: '81.201.xx.xx',  country: 'Singapore',     time: '18 min ago', action: 'Downloaded'},
  { ip: '194.33.xx.xx',  country: 'United Kingdom',time: '1 hr ago',   action: 'Viewed'    },
];

// ─────────────────────────────────────────────────────────────────────────────
// Small utility row component for token metadata
// ─────────────────────────────────────────────────────────────────────────────
function InfoRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex justify-between text-[9px] font-mono border-b border-[var(--border-dark)] pb-1.5 mb-1.5">
      <span className="text-[var(--text-muted)]">{label}</span>
      <span className={highlight ? 'text-[var(--rolex-gold)] font-bold' : 'text-white'}>{value}</span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main ViewerPanel
// ─────────────────────────────────────────────────────────────────────────────
export function ViewerPanel({
  result, loading, buildResult, onShare,
}: {
  result:      ViewerResult | null;
  loading:     boolean;
  buildResult?: BuildResult | null;
  onShare:     (opts: { password: string; expiryHours: number; watermark: boolean; clientName: string }) => void;
}) {
  const [password,    setPassword]    = useState('');
  const [usePassword, setUsePassword] = useState(false);
  const [expiry,      setExpiry]      = useState(168);
  const [watermark,   setWatermark]   = useState(true);
  const [clientName,  setClientName]  = useState('');
  const [copied,      setCopied]      = useState<'url' | 'embed' | null>(null);
  const [showEmbed,   setShowEmbed]   = useState(false);
  const [activeTab,   setActiveTab]   = useState<'config' | 'token' | 'access' | 'bim'>('config');
  // BIM model upload state
  const [modelUrl,     setModelUrl]     = useState<string | undefined>(undefined);
  const [modelType,    setModelType]    = useState<ModelType>('procedural');
  const [uploadingBIM, setUploadingBIM] = useState(false);
  const [uploadMsg,    setUploadMsg]    = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── BIM model upload handler ──────────────────────────────────────────────
  const handleBIMUpload = useCallback(async (file: File) => {
    if (uploadingBIM) return;
    setUploadingBIM(true);
    setUploadMsg('Uploading model…');
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res  = await fetch('/api/archionlabs/models', { method: 'POST', body: formData });
      const data = await res.json();
      if (!res.ok) {
        setUploadMsg(`✗ ${data.error ?? 'Upload failed'}`);
        return;
      }
      setModelUrl(data.modelUrl);
      setModelType(data.modelType as ModelType);
      setUploadMsg(`✓ ${file.name} (${(file.size / 1024).toFixed(0)} KB) — loaded in viewer`);
    } catch {
      setUploadMsg('✗ Upload failed. Check your connection and try again.');
    } finally {
      setUploadingBIM(false);
    }
  }, [uploadingBIM]);

  const shareUrl = result?.full_share_url ?? `${typeof window !== 'undefined' ? window.location.origin : ''}/viewer/—`;
  const wmText   = result?.security?.watermark_text
    ?? `TOKENLY BUILD · CONFIDENTIAL · ${new Date().toLocaleDateString()}`;

  const embedCode = result
    ? `<iframe\n  src="${result.full_share_url}"\n  width="900"\n  height="600"\n  frameborder="0"\n  allow="fullscreen"\n  title="${result.name ?? 'Tokenly Build 3D Viewer'}"\n></iframe>`
    : '';

  const copyText = async (text: string, key: 'url' | 'embed') => {
    await navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2200);
  };

  const EXPIRY_OPTIONS = [
    { h: 24,   l: '24 h' },
    { h: 168,  l: '7 d'  },
    { h: 720,  l: '30 d' },
    { h: 2160, l: '90 d' },
  ];

  if (loading) return <PanelLoader label="Generating Secure Token & Viewer Session…" />;

  return (
    <div className="space-y-4">

      {/* ── 3D Viewer — real IFC/GLB + WebXR ────────────────── */}
      <div
        className="relative border border-[var(--border-dark)] overflow-hidden bg-black"
        style={{ height: 340 }}
      >
        <Building3D
          buildResult={buildResult ?? null}
          watermark={watermark}
          watermarkText={wmText}
          modelUrl={modelUrl}
          modelType={modelType}
        />

        {/* Top-left badge */}
        <div className="absolute top-3 left-3 z-10 px-2.5 py-1.5 bg-black/75 border border-white/10 backdrop-blur-sm pointer-events-none">
          <p className="text-[7px] font-mono text-[var(--rolex-gold)] uppercase tracking-[0.22em] mb-0.5 font-bold">
            TOKENLY BUILD · 3D SECURE
          </p>
          <p className="text-[8px] font-mono text-white/45">
            {result?.name ?? buildResult?.building_name ?? 'Building Model'}
          </p>
        </div>

        {/* Watermark status badge */}
        {watermark && (
          <div className="absolute top-3 right-3 z-10 px-2 py-1 bg-black/65 border border-[var(--rolex-gold)]/20 pointer-events-none">
            <p className="text-[7px] font-mono text-[var(--rolex-gold)]/65 uppercase tracking-widest">
              WATERMARKED
            </p>
          </div>
        )}
      </div>

      {/* ── Tab nav ─────────────────────────────────────────────── */}
      <div className="flex border border-[var(--border-dark)] overflow-x-auto">
        {([
          ['config' as const, 'Share Config',  Share2   ],
          ['bim'    as const, 'BIM Upload',    Cpu      ],
          ['token'  as const, 'Secure Token',  Lock     ],
          ['access' as const, 'Access Log',    Users    ],
        ] as const).map(([id, label, Icon]) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`flex items-center gap-1.5 px-5 py-3 text-[8px] font-mono uppercase tracking-widest transition-colors flex-shrink-0 border-r border-[var(--border-dark)] last:border-r-0 ${
              activeTab === id
                ? 'bg-[var(--rolex-gold)]/8 text-[var(--rolex-gold)]'
                : 'text-[var(--text-muted)] hover:text-white'
            }`}
          >
            <Icon size={10} /> {label}
            {id === 'token' && result && (
              <span className="ml-1 w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            )}
          </button>
        ))}
      </div>

      {/* ━━━━━ SHARE CONFIGURATION TAB ━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      {activeTab === 'config' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Left — configuration controls */}
          <div className="bg-[#050505] border border-[var(--border-dark)] p-5 space-y-4">
            <div className="flex items-center gap-2 mb-1">
              <Share2 size={11} className="text-[var(--rolex-gold)]" />
              <p className="text-[9px] font-mono uppercase tracking-widest text-[var(--rolex-gold)] font-bold">
                Share Configuration
              </p>
            </div>

            {/* Client name */}
            <div>
              <label className="block text-[7px] font-mono uppercase tracking-widest text-[var(--text-muted)] mb-1.5">
                Client / Recipient Name
              </label>
              <input
                value={clientName}
                onChange={e => setClientName(e.target.value)}
                placeholder="e.g. ABC Developers Ltd."
                className="w-full bg-black border border-[var(--border-dark)] text-white text-[11px] font-mono px-3 py-2 focus:outline-none focus:border-[var(--rolex-gold)] placeholder-white/20 transition-colors"
              />
            </div>

            {/* Link expiry */}
            <div>
              <label className="block text-[7px] font-mono uppercase tracking-widest text-[var(--text-muted)] mb-1.5">
                Link Expiry
              </label>
              <div className="flex gap-1.5">
                {EXPIRY_OPTIONS.map(opt => (
                  <button
                    key={opt.h}
                    onClick={() => setExpiry(opt.h)}
                    className={`flex-1 py-1.5 text-[8px] font-mono uppercase tracking-widest border transition-colors ${
                      expiry === opt.h
                        ? 'border-[var(--rolex-gold)] text-[var(--rolex-gold)] bg-[var(--rolex-gold)]/10'
                        : 'border-[var(--border-dark)] text-[var(--text-muted)] hover:text-white'
                    }`}
                  >
                    {opt.l}
                  </button>
                ))}
              </div>
            </div>

            {/* Password toggle */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-[7px] font-mono uppercase tracking-widest text-[var(--text-muted)]">
                  Password Protection
                </label>
                <button
                  onClick={() => setUsePassword(p => !p)}
                  className={`relative w-10 h-5 rounded-full transition-colors ${usePassword ? 'bg-[var(--rolex-gold)]' : 'bg-[var(--border-dark)]'}`}
                >
                  <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${usePassword ? 'left-5' : 'left-0.5'}`} />
                </button>
              </div>
              {usePassword && (
                <div className="relative">
                  <Key size={10} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
                  <input
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Set access password…"
                    className="w-full bg-black border border-[var(--border-dark)] text-white text-[11px] font-mono pl-8 pr-3 py-2 focus:outline-none focus:border-[var(--rolex-gold)] placeholder-white/20 transition-colors"
                  />
                </div>
              )}
            </div>

            {/* Watermark toggle */}
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[7px] font-mono uppercase tracking-widest text-[var(--text-muted)]">
                  Dual-Layer Watermark
                </p>
                <p className="text-[7px] font-mono text-[var(--text-muted)]/55 mt-0.5">
                  Diagonal + footer stamp on 3D canvas
                </p>
              </div>
              <button
                onClick={() => setWatermark(w => !w)}
                className={`relative w-10 h-5 rounded-full transition-colors flex-shrink-0 ${watermark ? 'bg-[var(--rolex-gold)]' : 'bg-[var(--border-dark)]'}`}
              >
                <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${watermark ? 'left-5' : 'left-0.5'}`} />
              </button>
            </div>

            {/* Generate button */}
            <button
              onClick={() => onShare({ password: usePassword ? password : '', expiryHours: expiry, watermark, clientName })}
              className="w-full flex items-center justify-center gap-2 py-3 bg-[var(--rolex-gold)] text-black text-[9px] font-mono font-bold uppercase tracking-widest hover:bg-[var(--rolex-gold)]/90 transition-colors"
            >
              <Share2 size={12} /> Generate Secure Share Link →
            </button>
          </div>

          {/* Right — security protocol summary */}
          <div className="bg-[#050505] border border-[var(--border-dark)] p-5">
            <div className="flex items-center gap-2 mb-4">
              <Shield size={11} className="text-[var(--rolex-gold)]" />
              <p className="text-[9px] font-mono uppercase tracking-widest text-[var(--rolex-gold)] font-bold">
                Security Protocol
              </p>
            </div>
            <div className="space-y-0.5">
              {[
                ['Token Algorithm',  'JWT · HMAC-SHA256 Signed'  ],
                ['Encryption',       'AES-256-GCM End-to-End'    ],
                ['Transport',        'TLS 1.3 Required'          ],
                ['Access Logging',   'IP + timestamp + device'   ],
                ['Max Views',        result?.security?.max_views ? `${result.security.max_views}` : '50 views'],
                ['Watermark Mode',   watermark ? 'Dual-layer canvas stamp' : 'Disabled'],
                ['Expiry',           `${EXPIRY_OPTIONS.find(o => o.h === expiry)?.l ?? expiry + 'h'}`],
                ['Password',         usePassword ? 'Set ✓' : 'Not required'],
              ].map(([k, v]) => (
                <InfoRow key={k} label={k} value={v} />
              ))}
            </div>

            <div className="mt-4 px-3 py-2.5 bg-[var(--rolex-gold)]/5 border border-[var(--rolex-gold)]/15">
              <p className="text-[8px] font-mono text-[var(--rolex-gold)] font-bold uppercase tracking-wider mb-0.5">
                Compliance Note
              </p>
              <p className="text-[8px] font-mono text-white/45 leading-relaxed">
                All shared links are subject to Tokenly Build Terms of Service. Watermarked exports may not be redistributed without written consent.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ━━━━━ SECURE TOKEN TAB ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      {activeTab === 'token' && (
        !result ? (
          <div className="bg-[#050505] border border-[var(--border-dark)] p-10 flex flex-col items-center gap-4 text-center">
            <Lock size={36} className="text-[var(--rolex-gold)] opacity-25" />
            <p className="text-[9px] font-mono uppercase tracking-widest text-[var(--text-muted)]">
              No token generated yet
            </p>
            <p className="text-[9px] text-white/30 max-w-xs">
              Configure sharing options in the Share Config tab, then click Generate Secure Share Link.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-4">
            {/* Token details */}
            <div className="space-y-3">
              <div className="bg-[#050505] border border-[var(--rolex-gold)]/30 p-5">
                <div className="flex items-center gap-2 mb-3">
                  <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                  <p className="text-[8px] font-mono uppercase tracking-widest text-[var(--rolex-gold)] font-bold">Active Share Token</p>
                </div>

                {/* Token value */}
                <div className="font-mono text-xl font-bold text-[var(--rolex-gold)] tracking-[0.18em] mb-4 break-all leading-relaxed">
                  {result.share_token}
                </div>

                <InfoRow label="Expires"          value={new Date(result.expires_at).toLocaleString()} highlight />
                <InfoRow label="Password"         value={result.password_protected ? '🔒 Set' : 'Open access'} />
                <InfoRow label="Watermark"        value={result.watermark_enabled ? 'Dual-layer' : 'Off'} />
                <InfoRow label="Client"           value={result.client_name || '—'} />
                <InfoRow label="Max Views"        value={String(result.security?.max_views ?? 50)} />

                {/* Share URL with copy */}
                <div className="flex items-center gap-2 bg-black border border-[var(--border-dark)] px-3 py-2 mt-3 mb-3">
                  <span className="text-[8px] font-mono text-[var(--text-muted)] truncate flex-1">
                    {result.full_share_url}
                  </span>
                  <button
                    onClick={() => copyText(result.full_share_url, 'url')}
                    className="flex-shrink-0 flex items-center gap-1 text-[8px] font-mono uppercase text-[var(--rolex-gold)] hover:text-white transition-colors"
                  >
                    {copied === 'url' ? <><Check size={9}/> Copied!</> : <><Copy size={9}/> Copy</>}
                  </button>
                </div>

                {/* Action buttons */}
                <div className="flex gap-2">
                  <a
                    href={result.share_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 border border-[var(--rolex-gold)]/40 text-[var(--rolex-gold)] text-[8px] font-mono uppercase tracking-widest hover:bg-[var(--rolex-gold)]/10 transition-colors"
                  >
                    <Eye size={10}/> Launch Viewer
                  </a>
                  <button
                    onClick={() => setShowEmbed(s => !s)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 border border-[var(--border-dark)] text-[var(--text-muted)] text-[8px] font-mono uppercase tracking-widest hover:text-white hover:border-white/20 transition-colors"
                  >
                    <Code size={10}/> Embed Code
                  </button>
                </div>

                {/* Embed code block */}
                {showEmbed && (
                  <div className="mt-3 bg-black border border-[var(--border-dark)] p-3">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-[7px] font-mono text-[var(--text-muted)] uppercase tracking-widest">HTML iframe</p>
                      <button
                        onClick={() => copyText(embedCode, 'embed')}
                        className="flex items-center gap-1 text-[8px] font-mono text-[var(--rolex-gold)] hover:text-white transition-colors"
                      >
                        {copied === 'embed' ? <><Check size={9}/> Copied!</> : <><Copy size={9}/> Copy</>}
                      </button>
                    </div>
                    <pre className="text-[8px] font-mono text-white/55 overflow-x-auto whitespace-pre leading-relaxed">
                      {embedCode}
                    </pre>
                  </div>
                )}
              </div>

              {/* Building element breakdown */}
              {result.elements && (
                <div className="bg-[#050505] border border-[var(--border-dark)]">
                  <div className="px-4 py-3 border-b border-[var(--border-dark)] bg-[#0A0A0A]">
                    <p className="text-[8px] font-mono uppercase tracking-widest text-white font-bold flex items-center gap-2">
                      <Layers size={10} className="text-[var(--rolex-gold)]" /> Building Elements
                    </p>
                  </div>
                  {result.elements.map((elem, i) => {
                    const statusColors: Record<string, string> = {
                      compliant: '#22c55e', review: '#f97316', failed: '#ef4444',
                    };
                    const col = statusColors[elem.status] ?? '#888';
                    return (
                      <div key={i} className="px-4 py-3 flex items-center justify-between border-b border-[var(--border-dark)] last:border-b-0">
                        <div className="flex items-center gap-3 text-[9px] font-mono">
                          <span className="text-[var(--text-muted)] uppercase w-24">{elem.type}</span>
                          <span className="text-white">{elem.count}</span>
                        </div>
                        <span
                          className="text-[8px] font-mono font-bold px-2 py-0.5 border"
                          style={{ color: col, borderColor: col + '44', background: col + '12' }}
                        >
                          {elem.status}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* QR code */}
            <div className="flex flex-col items-center gap-3 p-5 bg-[#050505] border border-[var(--border-dark)]">
              <div className="flex items-center gap-2 self-stretch">
                <QrCode size={10} className="text-[var(--text-muted)]" />
                <p className="text-[7px] font-mono uppercase tracking-widest text-[var(--text-muted)] font-bold">QR Code</p>
              </div>
              <RealQRCode value={result.full_share_url} size={150} />
              <p className="text-[7px] font-mono text-[var(--text-muted)] text-center">
                Scan to open secure viewer
              </p>
              <a
                href={result.share_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-[8px] font-mono text-[var(--rolex-gold)] hover:text-white transition-colors"
              >
                <ExternalLink size={9}/> Open link
              </a>
            </div>
          </div>
        )
      )}

      {/* ━━━━━ BIM UPLOAD TAB ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      {activeTab === 'bim' && (
        <div className="space-y-4">
          {/* Upload zone */}
          <div
            className="bg-[#050505] border-2 border-dashed border-[var(--border-dark)] p-8 text-center cursor-pointer hover:border-[var(--rolex-gold)]/40 transition-colors"
            onClick={() => fileInputRef.current?.click()}
            onDragOver={e => { e.preventDefault(); e.currentTarget.classList.add('border-[var(--rolex-gold)]'); }}
            onDragLeave={e => { e.currentTarget.classList.remove('border-[var(--rolex-gold)]'); }}
            onDrop={e => {
              e.preventDefault();
              e.currentTarget.classList.remove('border-[var(--rolex-gold)]');
              const file = e.dataTransfer.files[0];
              if (file) handleBIMUpload(file);
            }}
          >
            <Upload size={28} className="mx-auto mb-3 text-[var(--rolex-gold)]/40" />
            <p className="text-[9px] font-mono uppercase tracking-widest text-[var(--rolex-gold)] font-bold mb-1">
              {uploadingBIM ? 'UPLOADING…' : 'DRAG & DROP OR CLICK TO UPLOAD'}
            </p>
            <p className="text-[8px] font-mono text-[var(--text-muted)] mt-1">
              Accepts: .ifc (Industry Foundation Classes) · .glb · .gltf — Max 100 MB
            </p>
            {uploadMsg && (
              <p className={`text-[9px] font-mono mt-3 ${uploadMsg.startsWith('✓') ? 'text-green-400' : 'text-red-400'}`}>
                {uploadMsg}
              </p>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept=".ifc,.glb,.gltf"
              className="hidden"
              onChange={e => {
                const file = e.target.files?.[0];
                if (file) handleBIMUpload(file);
                e.target.value = '';
              }}
            />
          </div>

          {/* Current model status */}
          {modelUrl && (
            <div className="bg-[#050505] border border-[var(--rolex-gold)]/20 p-4 flex items-start gap-3">
              <Cpu size={14} className="text-[var(--rolex-gold)] flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-[8px] font-mono uppercase tracking-widest text-[var(--rolex-gold)] font-bold mb-1">
                  {modelType.toUpperCase()} Model Loaded
                </p>
                <p className="text-[9px] font-mono text-[var(--text-muted)] break-all">{modelUrl}</p>
                <button
                  onClick={() => { setModelUrl(undefined); setModelType('procedural'); setUploadMsg(''); }}
                  className="mt-2 text-[8px] font-mono uppercase tracking-widest text-red-400/70 hover:text-red-400 transition-colors"
                >
                  Remove model → revert to floor plan
                </button>
              </div>
            </div>
          )}

          {/* Setup instructions */}
          <div className="bg-[#050505] border border-[var(--border-dark)] p-5">
            <p className="text-[8px] font-mono uppercase tracking-widest text-[var(--rolex-gold)] font-bold mb-3">
              IFC SETUP (one-time)
            </p>
            <div className="space-y-1 font-mono text-[9px] text-[var(--text-muted)]">
              {[
                'npm install web-ifc-three web-ifc',
                'cp node_modules/web-ifc/web-ifc.wasm public/',
              ].map((cmd, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-[var(--rolex-gold)]/60">$</span>
                  <code className="text-white/60">{cmd}</code>
                </div>
              ))}
            </div>
            <p className="text-[8px] font-mono text-[var(--text-muted)]/60 mt-3 leading-relaxed">
              GLB files work out of the box — no setup needed.
            </p>
          </div>
        </div>
      )}

      {/* ━━━━━ ACCESS LOG TAB ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      {activeTab === 'access' && (
        <div className="space-y-3">
          <div className="bg-[#050505] border border-[var(--border-dark)] p-4 flex items-start gap-3">
            <AlertCircle size={12} className="text-[var(--rolex-gold)] flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-[8px] font-mono uppercase tracking-widest text-[var(--text-muted)] mb-1 font-bold">
                Access Logging Active
              </p>
              <p className="text-[9px] text-white/40 leading-relaxed">
                All viewer sessions are recorded with IP address, timestamp, country, and device fingerprint for full audit compliance. Data is retained for 90 days.
              </p>
            </div>
          </div>

          {!result ? (
            <PanelEmpty label="ACCESS LOG" description="Generate a share link to begin tracking viewer access sessions." />
          ) : (
            <div className="bg-[#050505] border border-[var(--border-dark)]">
              <div className="px-5 py-3 border-b border-[var(--border-dark)] bg-[#0A0A0A]">
                <p className="text-[8px] font-mono uppercase tracking-widest text-white font-bold flex items-center gap-2">
                  <Users size={11} className="text-[var(--rolex-gold)]" /> Recent Sessions (Simulated)
                </p>
              </div>

              {/* Table header */}
              <div className="grid grid-cols-4 gap-px bg-[var(--border-dark)] border-b border-[var(--border-dark)]">
                {['IP Address', 'Country', 'Time', 'Action'].map(h => (
                  <div key={h} className="bg-[#0A0A0A] px-4 py-2">
                    <p className="text-[7px] font-mono text-[var(--text-muted)] uppercase tracking-widest">{h}</p>
                  </div>
                ))}
              </div>

              {ACCESS_LOG.map((entry, i) => (
                <div key={i} className="grid grid-cols-4 border-b border-[var(--border-dark)] last:border-b-0 hover:bg-white/[0.02] transition-colors">
                  <div className="px-4 py-3">
                    <p className="text-[9px] font-mono text-white/60">{entry.ip}</p>
                  </div>
                  <div className="px-4 py-3">
                    <p className="text-[9px] font-mono text-white/60">{entry.country}</p>
                  </div>
                  <div className="px-4 py-3">
                    <p className="text-[9px] font-mono text-[var(--text-muted)]">{entry.time}</p>
                  </div>
                  <div className="px-4 py-3">
                    <span className={`text-[8px] font-mono font-bold px-2 py-0.5 border ${
                      entry.action === 'Viewed'
                        ? 'text-blue-400 border-blue-400/30 bg-blue-400/10'
                        : 'text-[var(--rolex-gold)] border-[var(--rolex-gold)]/30 bg-[var(--rolex-gold)]/10'
                    }`}>
                      {entry.action}
                    </span>
                  </div>
                </div>
              ))}

              {/* Log footer */}
              <div className="px-4 py-3 flex items-center justify-between">
                <p className="text-[8px] font-mono text-[var(--text-muted)]">
                  Showing 3 of 3 sessions · Token: {result.share_token}
                </p>
                <button className="flex items-center gap-1.5 text-[8px] font-mono text-[var(--text-muted)] hover:text-white transition-colors">
                  <Download size={9} /> Export CSV
                </button>
              </div>
            </div>
          )}

          {/* Expiry countdown */}
          {result && (
            <div className="flex items-center gap-2 px-1 text-[8px] font-mono text-[var(--text-muted)]">
              <Clock size={10} />
              Link expires: {new Date(result.expires_at).toLocaleString()} ·
              Encryption: {result.security?.encryption ?? 'AES-256-GCM'}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
