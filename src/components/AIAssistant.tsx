'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { usePathname } from 'next/navigation';
import { authFetch } from '@/lib/client';
import { useStore } from '@/lib/store';
import { X, Send, RotateCcw, Minimize2 } from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────────────────
interface Message {
  role: 'user' | 'assistant';
  content: string;
  ts: number;
}

// ── Quick action chips — context-sensitive based on current page ──────────
const QUICK_ACTIONS: Record<string, { label: string; prompt: string }[]> = {
  '/dashboard': [
    { label: 'Improve my RRS', prompt: 'How can I improve my Node Reputation Score (RRS)?' },
    { label: 'Explain my tier', prompt: 'Explain what RRS tiers mean and how to advance to the next tier.' },
    { label: 'Best assets to review', prompt: 'Which asset categories are best for building RRS score quickly?' },
  ],
  '/vault': [
    { label: 'What drives price?', prompt: 'What factors drive consensus price changes on vault assets?' },
    { label: 'Buying strategy',    prompt: 'What is the best strategy for buying fractional shares at current prices?' },
    { label: 'Risk assessment',    prompt: 'How do I assess the risk of a vault position in the Tokenly protocol?' },
  ],
  '/analytics': [
    { label: 'Explain A/B data',  prompt: 'Explain the difference between the staking and control experiment groups.' },
    { label: 'Staking advantage', prompt: 'What is the statistical advantage of the staking mechanism over the control group?' },
  ],
  '/leaderboard': [
    { label: 'Rank formula',      prompt: 'Explain the exact RRS formula and how each component is weighted.' },
    { label: 'Top node secrets',  prompt: 'What strategies do top-ranked nodes use to maintain elite status?' },
  ],
  '/can': [
    { label: 'CAN eligibility',   prompt: 'What are the requirements to become a Certified Authenticator Node?' },
    { label: 'Bond mechanics',    prompt: 'How does the CAN bond mechanism work and what happens when a bond is slashed?' },
  ],
  default: [
    { label: 'Protocol overview', prompt: 'Give me a concise overview of how the Tokenly protocol works.' },
    { label: 'How to earn',       prompt: 'What are the best ways to earn PTS in the Tokenly protocol?' },
    { label: 'Asset categories',  prompt: 'What asset categories are supported and which are most liquid?' },
    { label: 'Security model',    prompt: 'How does Tokenly ensure the security of physical assets and user funds?' },
  ],
};

const INITIAL_MSG: Message = {
  role:    'assistant',
  content: 'Protocol Guardian online. I can help with RRS strategy, vault positions, CAN authentication, trading mechanics, or anything else about the Tokenly protocol. What would you like to know?',
  ts:      Date.now(),
};

// ── Typing animation helper — simulates streaming ─────────────────────────
function useTypingText(text: string, speed = 12) {
  const [displayed, setDisplayed] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    setDisplayed('');
    setDone(false);
    if (!text) return;
    let i = 0;
    const tick = setInterval(() => {
      i++;
      setDisplayed(text.slice(0, i));
      if (i >= text.length) { clearInterval(tick); setDone(true); }
    }, speed);
    return () => clearInterval(tick);
  }, [text, speed]);

  return { displayed, done };
}

// ── Last assistant message with typing effect ─────────────────────────────
function TypingMessage({ content, isLatest }: { content: string; isLatest: boolean }) {
  const { displayed } = useTypingText(isLatest ? content : '', 10);
  return <span>{isLatest ? displayed : content}</span>;
}

// ── Main component ─────────────────────────────────────────────────────────
export default function AIAssistant() {
  const [open,     setOpen]     = useState(false);
  const [messages, setMessages] = useState<Message[]>([INITIAL_MSG]);
  const [input,    setInput]    = useState('');
  const [loading,  setLoading]  = useState(false);
  const [lastIdx,  setLastIdx]  = useState(0); // index of latest assistant message
  const scrollRef  = useRef<HTMLDivElement>(null);
  const inputRef   = useRef<HTMLInputElement>(null);
  const pathname   = usePathname();
  const user       = useStore(s => s.user);
  const [hideForPortfolio, setHideForPortfolio] = useState(false);

  useEffect(() => {
    const check = () => setHideForPortfolio(window.location.search.includes('portfolio=1'));
    check();
    window.addEventListener('popstate', check);
    return () => window.removeEventListener('popstate', check);
  }, [pathname]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, loading]);

  // Keyboard shortcut ⌘J / Ctrl+J to toggle
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'j') {
        e.preventDefault();
        setOpen(o => !o);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Focus input when panel opens
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 200);
  }, [open]);

  // Pick context-appropriate quick actions
  const quickActions = (() => {
    const key = Object.keys(QUICK_ACTIONS).find(k => pathname.startsWith(k) && k !== 'default');
    return QUICK_ACTIONS[key ?? 'default'];
  })();

  // Build a concise context injection
  const buildContext = useCallback((): string => {
    const parts: string[] = [`Current page: ${pathname}`];
    if (user) {
      parts.push(`User: ${user.name}, RRS: ${user.rrs_score?.toFixed(1)}, PTS: ${user.points?.toLocaleString()}, Reviews: ${user.total_reviews}`);
    }
    return parts.join(' | ');
  }, [pathname, user]);

  const send = useCallback(async (text: string) => {
    const msg = text.trim();
    if (!msg || loading) return;
    setInput('');

    const userMsg: Message = { role: 'user', content: msg, ts: Date.now() };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);

    try {
      const res = await authFetch('/api/ai', {
        method: 'POST',
        body:   JSON.stringify({ message: msg, context: buildContext() }),
      });
      const data = await res.json() as { response?: string; reply?: string };
      const reply = data.response || data.reply || 'Signal lost. Please retry.';
      setMessages(prev => {
        const next = [...prev, { role: 'assistant' as const, content: reply, ts: Date.now() }];
        setLastIdx(next.length - 1);
        return next;
      });
    } catch {
      setMessages(prev => [...prev, {
        role: 'assistant', content: 'System anomaly detected. Please check connectivity.', ts: Date.now(),
      }]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  }, [loading, buildContext]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input); }
  };

  const clearChat = () => {
    setMessages([INITIAL_MSG]);
    setLastIdx(0);
  };

  const isFirstTurn = messages.length === 1;

  if (hideForPortfolio) return null;

  return (
    <div data-ai-assistant-root>
      {/* ── Trigger button ─────────────────────────────────────────── */}
      <motion.button
        aria-label="Open AI Guardian (⌘J)"
        title="Protocol Guardian · ⌘J"
        onClick={() => setOpen(o => !o)}
        className="fixed bottom-10 right-6 z-[1000] w-12 h-12 flex items-center justify-center border border-[var(--rolex-green-light)]/40 bg-[#050505] text-[var(--rolex-green-light)] shadow-[0_0_20px_rgba(0,168,107,0.25)] hover:shadow-[0_0_32px_rgba(0,168,107,0.45)] hover:border-[var(--rolex-green-light)]/70 transition-all duration-300"
        whileHover={{ scale: 1.1, y: -3 }}
        whileTap={{ scale: 0.95 }}
      >
        <AnimatePresence mode="wait">
          {open ? (
            <motion.span key="x" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }}>
              <Minimize2 size={18} />
            </motion.span>
          ) : (
            <motion.span key="ai" initial={{ rotate: 90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: -90, opacity: 0 }}>
              {/* Tokenly diamond icon */}
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 21L3 12L12 3L21 12L12 21Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                <path d="M12 17L8 12L12 7L16 12L12 17Z" fill="currentColor" fillOpacity="0.3" stroke="currentColor" strokeWidth="1"/>
                <circle cx="12" cy="12" r="1.5" fill="currentColor"/>
              </svg>
            </motion.span>
          )}
        </AnimatePresence>
        {/* Pulse ring when closed */}
        {!open && (
          <span className="absolute inset-0 rounded-none border border-[var(--rolex-green-light)]/25 animate-ping" />
        )}
      </motion.button>

      {/* ── Panel ──────────────────────────────────────────────────── */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.96, filter: 'blur(8px)' }}
            animate={{ opacity: 1, y: 0,  scale: 1,    filter: 'blur(0px)' }}
            exit={{   opacity: 0, y: 24,  scale: 0.96, filter: 'blur(8px)' }}
            transition={{ type: 'spring', stiffness: 300, damping: 28 }}
            className="fixed bottom-28 right-6 z-[999] w-[360px] max-h-[560px] flex flex-col bg-[#050505] border border-[var(--rolex-gold)] shadow-[0_20px_60px_rgba(0,0,0,0.85),0_0_0_1px_rgba(163,126,44,0.1)]"
            style={{ maxWidth: 'calc(100vw - 48px)' }}
          >
            {/* ── Header ────────────────────────────────────────────── */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-dark)] bg-[#030303] flex-shrink-0">
              <div className="flex items-center gap-3">
                {/* Animated diamond */}
                <motion.div
                  className="text-[var(--rolex-green-light)]"
                  animate={{ scale: [1, 1.08, 1], rotate: [0, 4, 0] }}
                  transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut' }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12 21L3 12L12 3L21 12L12 21Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                    <path d="M12 17L8 12L12 7L16 12L12 17Z" fill="currentColor" fillOpacity="0.25" stroke="currentColor" strokeWidth="0.8"/>
                  </svg>
                </motion.div>
                <div>
                  <div className="text-[8px] font-mono uppercase tracking-[0.25em] text-[var(--rolex-gold)] font-bold leading-none">CORE INTELLIGENCE V5</div>
                  <div className="text-[10px] font-bold text-white tracking-wide uppercase leading-none mt-0.5">Protocol Guardian</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="flex items-center gap-1.5 text-[7px] font-mono text-[var(--rolex-green-light)] uppercase tracking-widest font-bold">
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--rolex-green-light)] animate-pulse" /> ONLINE
                </span>
                <button onClick={clearChat} title="Clear chat" className="p-1.5 text-[var(--text-muted)] hover:text-white transition-colors">
                  <RotateCcw size={12} />
                </button>
                <button onClick={() => setOpen(false)} title="Close" className="p-1.5 text-[var(--text-muted)] hover:text-white transition-colors">
                  <X size={13} />
                </button>
              </div>
            </div>

            {/* ── Quick actions (only before first user message) ─────── */}
            <AnimatePresence>
              {isFirstTurn && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="px-3 pt-3 pb-2 border-b border-[var(--border-dark)] flex-shrink-0"
                >
                  <p className="text-[7px] font-mono uppercase tracking-widest text-[var(--text-muted)] mb-2">Quick Actions</p>
                  <div className="flex flex-col gap-1.5">
                    {quickActions.map((a, i) => (
                      <button
                        key={i}
                        onClick={() => send(a.prompt)}
                        className="text-left text-[8px] font-mono px-2.5 py-1.5 border border-[var(--border-dark)] text-[var(--text-muted)] hover:border-[var(--rolex-gold)]/40 hover:text-white/75 hover:bg-[var(--rolex-gold)]/5 transition-all"
                      >
                        {a.label}
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* ── Message thread ─────────────────────────────────────── */}
            <div
              ref={scrollRef}
              className="flex-1 overflow-y-auto p-3 space-y-3 min-h-0"
              style={{ scrollbarWidth: 'thin' }}
            >
              {messages.map((m, i) => (
                <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[88%] ${m.role === 'user' ? 'ml-8' : 'mr-8'}`}>

                    {m.role === 'assistant' && (
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className="text-[var(--rolex-green-light)] text-[10px]">◈</span>
                        <span className="text-[7px] font-mono text-[var(--text-muted)] uppercase tracking-widest">Oracle Guardian</span>
                      </div>
                    )}

                    <div className={`px-3 py-2.5 text-[11px] font-mono leading-relaxed ${
                      m.role === 'user'
                        ? 'bg-[var(--rolex-gold)]/10 border border-[var(--rolex-gold)]/25 text-white'
                        : 'bg-[#0A0A0A] border border-[var(--border-dark)] text-white/80'
                    }`}>
                      {m.role === 'assistant'
                        ? <TypingMessage content={m.content} isLatest={i === lastIdx} />
                        : m.content}
                    </div>

                    <p className="text-[6.5px] font-mono text-[var(--text-muted)] mt-0.5 px-0.5">
                      {new Date(m.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              ))}

              {/* Thinking dots */}
              {loading && (
                <div className="flex justify-start">
                  <div className="ml-4 px-3 py-2.5 bg-[#0A0A0A] border border-[var(--border-dark)] text-[11px] font-mono text-[var(--text-muted)] flex items-center gap-2">
                    <span className="text-[7px] uppercase tracking-widest text-[var(--rolex-green-light)]">
                      [ DECRYPTING_SIGNAL
                    </span>
                    <span className="flex gap-1">
                      {[0, 1, 2].map(j => (
                        <span key={j}
                          className="w-1 h-1 bg-[var(--rolex-green-light)] rounded-full animate-bounce"
                          style={{ animationDelay: `${j * 0.15}s` }}
                        />
                      ))}
                    </span>
                    <span className="text-[7px] text-[var(--rolex-green-light)]">]</span>
                  </div>
                </div>
              )}
            </div>

            {/* ── Input bar ──────────────────────────────────────────── */}
            <div className="border-t border-[var(--border-dark)] p-3 flex-shrink-0">
              <div className="flex gap-2">
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Inquire about protocol status..."
                  className="flex-1 bg-black border border-[var(--border-dark)] text-white text-[10px] font-mono px-3 py-2.5 focus:outline-none focus:border-[var(--rolex-gold)] placeholder-white/20 transition-colors"
                />
                <button
                  onClick={() => send(input)}
                  disabled={loading || !input.trim()}
                  className="px-3 py-2 bg-[var(--rolex-gold)] text-black hover:bg-[var(--rolex-gold-light)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center flex-shrink-0"
                >
                  <Send size={13} />
                </button>
              </div>
              <p className="text-[6.5px] font-mono text-[var(--text-muted)] mt-1.5 px-0.5 flex items-center justify-between">
                <span>↵ Send · ⌘J toggle panel</span>
                <span className="text-[var(--rolex-gold)]/50">Llama 3.3 70B · Groq</span>
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
