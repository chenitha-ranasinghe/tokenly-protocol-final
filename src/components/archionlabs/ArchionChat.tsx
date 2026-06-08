'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { X, Send, RotateCcw } from 'lucide-react';
import type { BuildResult }      from './BuildPanel';
import type { MARLSimResult }    from './SimulationPanel';
import type { ComplianceResult } from './CompliancePanel';

// ─── Types ────────────────────────────────────────────────────────────────────
interface Message {
  role: 'user' | 'assistant';
  content: string;
  ts: Date;
}

interface Props {
  buildResult?:      BuildResult      | null;
  simResult?:        MARLSimResult    | null;
  complianceResult?: ComplianceResult | null;
  onClose?:          () => void;
}

// ─── Quick question bank (contextual) ─────────────────────────────────────────
const QUICK_QUESTIONS = [
  'What are minimum corridor widths per Sri Lankan UDA 2023?',
  'How can I improve the egress score of this floor plan?',
  'Explain ISO 21542:2011 door width requirements.',
  'What ramp gradient does UDA Section 9.1.1 require?',
  'How many emergency exits does a commercial building need?',
  'What makes a good open-plan kitchen and living layout?',
  'Suggest accessibility improvements for my building.',
  'What is the SLNBC fire compartment rule?',
];

const INITIAL: Message = {
  role:    'assistant',
  content: 'ArchionAI online. I specialise in Sri Lankan UDA 2023 regulations, ISO 21542:2011 accessibility standards, MARL simulation analysis, and architectural design best-practices. Ask me anything — or pick a quick question below.',
  ts:      new Date(),
};

// ─── ArchionChat ──────────────────────────────────────────────────────────────
export default function ArchionChat({ buildResult, simResult, complianceResult, onClose }: Props) {
  const [messages, setMessages] = useState<Message[]>([INITIAL]);
  const [input,    setInput]    = useState('');
  const [loading,  setLoading]  = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef  = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom whenever messages update
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, loading]);

  // ── Build contextual summary to inject into system prompt ─────────────────
  const buildContext = useCallback((): string => {
    const parts: string[] = [];

    if (buildResult) {
      parts.push(
        `Active floor plan: "${buildResult.building_name}" (${buildResult.building_type}), ` +
        `${buildResult.floors} floor(s), ${buildResult.total_area_sqm} m², ` +
        `${buildResult.rooms?.length ?? 0} rooms. ` +
        `Rooms: ${buildResult.rooms?.map(r => `${r.name} (${r.type}, ${r.width}m×${r.height}m, ${r.area_sqm} m²)`).join('; ')}.`
      );
      if (buildResult.accessibility_notes) {
        parts.push(`Accessibility note: ${buildResult.accessibility_notes}`);
      }
    }

    if (simResult) {
      const sm = simResult.simulation_metrics;
      parts.push(
        `MARL simulation: ${sm.total_agents} agents, egress score ${sm.egress_score}/100, ` +
        `bottleneck risk ${sm.bottleneck_risk}, evacuation time ${sm.evacuation_time_s}s, ` +
        `flow rate ${sm.flow_rate_agents_per_min} agents/min. ` +
        `Congestion zones: ${sm.congestion_zones?.join(', ') || 'none'}.`
      );
    }

    if (complianceResult) {
      const fails = complianceResult.violations?.filter(v => v.severity === 'critical').length ?? 0;
      parts.push(
        `Compliance score: ${complianceResult.overall_compliance_score}/100. ` +
        `${complianceResult.violations?.length ?? 0} violations (${fails} critical). ` +
        `Standards checked: ${complianceResult.jurisdictions_checked?.join(', ')}.`
      );
    }

    return parts.length > 0
      ? `\n\n--- CURRENT PROJECT CONTEXT ---\n${parts.join('\n')}\n--- END CONTEXT ---\n`
      : '';
  }, [buildResult, simResult, complianceResult]);

  // ── Send message ─────────────────────────────────────────────────────────────
  const handleSend = useCallback(async (text?: string) => {
    const msg = (text ?? input).trim();
    if (!msg || loading) return;

    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: msg, ts: new Date() }]);
    setLoading(true);

    try {
      const res  = await fetch('/api/archionlabs/chat', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ message: msg, context: buildContext() }),
      });
      const data = await res.json() as { response?: string };
      setMessages(prev => [...prev, {
        role:    'assistant',
        content: data.response || 'No response received.',
        ts:      new Date(),
      }]);
    } catch {
      setMessages(prev => [...prev, {
        role:    'assistant',
        content: 'Connection error. Please verify your API key configuration.',
        ts:      new Date(),
      }]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  }, [input, loading, buildContext]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const hasContext = !!(buildResult || simResult || complianceResult);
  const isFirstTurn = messages.length === 1;

  return (
    <div className="flex flex-col h-full bg-[#050505]">

      {/* ── Header ────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-dark)] bg-[#030303] flex-shrink-0">
        <div className="flex items-center gap-2.5">
          <span className="text-[var(--rolex-gold)] text-lg leading-none">⚗</span>
          <div>
            <p className="text-[9px] font-mono uppercase tracking-widest text-white font-bold leading-none">ArchionAI</p>
            <p className="text-[7px] font-mono text-[var(--text-muted)] uppercase tracking-wider mt-0.5">Architecture · Regulations · Design</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {hasContext && (
            <span className="text-[7px] font-mono text-[var(--rolex-gold)] px-2 py-0.5 border border-[var(--rolex-gold)]/30 bg-[var(--rolex-gold)]/8 uppercase tracking-widest">
              Context Active
            </span>
          )}
          <span className="flex items-center gap-1 text-[7px] font-mono text-green-400 uppercase tracking-widest">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" /> Online
          </span>
          <button onClick={() => setMessages([INITIAL])} title="Clear chat"
            className="p-1 text-[var(--text-muted)] hover:text-white transition-colors">
            <RotateCcw size={11} />
          </button>
          {onClose && (
            <button onClick={onClose} className="p-1 text-[var(--text-muted)] hover:text-white transition-colors">
              <X size={11} />
            </button>
          )}
        </div>
      </div>

      {/* ── Quick questions (only before first user message) ──── */}
      {isFirstTurn && (
        <div className="px-3 py-3 border-b border-[var(--border-dark)] flex-shrink-0">
          <p className="text-[7px] font-mono uppercase tracking-widest text-[var(--text-muted)] mb-2">Quick Questions</p>
          <div className="flex flex-col gap-1.5">
            {QUICK_QUESTIONS.slice(0, hasContext ? 5 : 4).map((q, i) => (
              <button key={i} onClick={() => handleSend(q)}
                className="text-left text-[8px] font-mono px-2.5 py-1.5 border border-[var(--border-dark)] text-[var(--text-muted)] hover:border-[var(--rolex-gold)]/40 hover:text-white/70 hover:bg-[var(--rolex-gold)]/5 transition-all leading-relaxed"
              >
                {q}
              </button>
            ))}
            {hasContext && (
              <button onClick={() => handleSend(
                buildResult
                  ? `Analyse my "${buildResult.building_name}" floor plan and suggest the three most impactful improvements.`
                  : 'What are the top three accessibility improvements I should make?'
              )}
                className="text-left text-[8px] font-mono px-2.5 py-1.5 border border-[var(--rolex-gold)]/30 text-[var(--rolex-gold)] hover:bg-[var(--rolex-gold)]/8 transition-all leading-relaxed"
              >
                ⚗ Analyse my current project →
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Message thread ─────────────────────────────────────── */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-3 min-h-0">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[92%] ${msg.role === 'user' ? 'ml-6' : 'mr-6'}`}>
              {msg.role === 'assistant' && (
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="text-[var(--rolex-gold)] text-xs">⚗</span>
                  <span className="text-[7px] font-mono text-[var(--text-muted)] uppercase tracking-widest">ArchionAI</span>
                </div>
              )}

              <div className={`px-3 py-2.5 text-[10px] font-mono leading-[1.65] ${
                msg.role === 'user'
                  ? 'bg-[var(--rolex-gold)]/10 border border-[var(--rolex-gold)]/25 text-white'
                  : 'bg-[#0A0A0A] border border-[var(--border-dark)] text-white/80'
              }`}>
                {/* Render line breaks from AI response */}
                {msg.content.split('\n').map((line, j) => (
                  <React.Fragment key={j}>
                    {line}
                    {j < msg.content.split('\n').length - 1 && <br />}
                  </React.Fragment>
                ))}
              </div>

              <p className="text-[6px] font-mono text-[var(--text-muted)] mt-0.5 px-0.5">
                {msg.ts.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          </div>
        ))}

        {/* Thinking indicator */}
        {loading && (
          <div className="flex justify-start">
            <div className="ml-6 px-3 py-2.5 bg-[#0A0A0A] border border-[var(--border-dark)] text-[10px] font-mono text-[var(--text-muted)] flex items-center gap-2.5">
              <span className="flex gap-1">
                {[0, 1, 2].map(j => (
                  <span key={j}
                    className="w-1.5 h-1.5 bg-[var(--rolex-gold)]/50 rounded-full animate-bounce"
                    style={{ animationDelay: `${j * 0.14}s` }}
                  />
                ))}
              </span>
              Analysing…
            </div>
          </div>
        )}
      </div>

      {/* ── Input area ─────────────────────────────────────────── */}
      <div className="border-t border-[var(--border-dark)] p-3 flex-shrink-0">
        <div className="flex gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about Sri Lankan regs, design advice, simulation results…"
            rows={2}
            className="flex-1 bg-black border border-[var(--border-dark)] text-white text-[10px] font-mono p-2.5 resize-none focus:outline-none focus:border-[var(--rolex-gold)] placeholder-white/20 transition-colors"
          />
          <button
            onClick={() => handleSend()}
            disabled={loading || !input.trim()}
            className="px-3 py-2 bg-[var(--rolex-gold)] text-black hover:bg-[var(--rolex-gold)]/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex-shrink-0 self-stretch flex items-center justify-center"
          >
            <Send size={12} />
          </button>
        </div>
        <p className="text-[6.5px] font-mono text-[var(--text-muted)] mt-1.5 px-0.5">
          ↵ Send · Shift+↵ new line · Llama 3.3 70B via Groq
          {hasContext && <span className="text-[var(--rolex-gold)]"> · Project context injected</span>}
        </p>
      </div>
    </div>
  );
}
