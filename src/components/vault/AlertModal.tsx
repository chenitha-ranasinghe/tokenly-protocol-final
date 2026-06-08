'use client';
import { motion } from 'framer-motion';

interface AlertModalProps {
  show: boolean;
  onClose: () => void;
  alertDir: 'above' | 'below';
  setAlertDir: (d: 'above' | 'below') => void;
  alertTarget: number;
  setAlertTarget: (v: number) => void;
  onSubmit: () => void;
  activeAlertCount: number;
}

export function AlertModal({ show, onClose, alertDir, setAlertDir, alertTarget, setAlertTarget, onSubmit, activeAlertCount }: AlertModalProps) {
  if (!show) return null;
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
        className="bg-[#050505] border border-[var(--rolex-gold)] p-10 w-full max-w-md relative"
        onClick={e => e.stopPropagation()}
      >
        <div className="text-[10px] font-mono text-[var(--rolex-gold)] uppercase tracking-[0.4em] mb-4">
          Price Alert Protocol {activeAlertCount > 0 && `· ${activeAlertCount} Active`}
        </div>
        <h2 className="text-2xl font-bold mb-8 uppercase">Set Target Vector</h2>

        <div className="mb-8">
          <label className="block text-[9px] font-mono uppercase tracking-widest text-[var(--text-muted)] mb-4">Alert when price is:</label>
          <div className="flex gap-4">
            <button
              onClick={() => setAlertDir('above')}
              className={`flex-1 py-3 border text-[10px] font-mono uppercase tracking-widest font-bold transition-colors ${
                alertDir === 'above'
                  ? 'border-[var(--success)] text-[var(--success)] bg-[var(--success)]/5'
                  : 'border-white/10 text-white/40 hover:border-white/30'
              }`}
            >
              Above ↑
            </button>
            <button
              onClick={() => setAlertDir('below')}
              className={`flex-1 py-3 border text-[10px] font-mono uppercase tracking-widest font-bold transition-colors ${
                alertDir === 'below'
                  ? 'border-red-500 text-red-500 bg-red-500/5'
                  : 'border-white/10 text-white/40 hover:border-white/30'
              }`}
            >
              Below ↓
            </button>
          </div>
        </div>

        <div className="mb-10">
          <label className="block text-[9px] font-mono uppercase tracking-widest text-[var(--text-muted)] mb-4">
            Target Price (PTS)
          </label>
          <input
            type="number"
            value={alertTarget}
            onChange={e => setAlertTarget(parseInt(e.target.value) || 0)}
            min={1}
            className="w-full bg-white/5 border border-white/10 p-5 text-2xl font-mono text-white focus:outline-none focus:border-[var(--rolex-gold)] transition-colors"
          />
        </div>

        <button
          onClick={onSubmit}
          disabled={alertTarget <= 0}
          className="w-full py-5 bg-white text-black font-bold text-[11px] font-mono uppercase tracking-widest hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Initialize Alert Sync →
        </button>

        <button onClick={onClose} className="absolute top-4 right-4 text-[var(--text-muted)] hover:text-white text-lg transition-colors">✕</button>
      </motion.div>
    </motion.div>
  );
}
