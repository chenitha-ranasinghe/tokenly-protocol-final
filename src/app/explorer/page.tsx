'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Search, ShieldCheck, Globe, Lock } from 'lucide-react';
import { CA_STAGGER, CA_ITEM } from '@/lib/animations';

export default function ExplorerLanding() {
  const [hash, setHash] = useState('');
  const router = useRouter();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (hash.trim()) {
      router.push(`/explorer/${hash.trim()}`);
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col items-center justify-center p-6 sm:p-12 font-sans relative overflow-hidden">
      
      {/* Background Grid Accent */}
      <div className="absolute inset-0 opacity-10 pointer-events-none" 
        style={{ backgroundImage: 'linear-gradient(var(--border-dark) 1px, transparent 1px), linear-gradient(90deg, var(--border-dark) 1px, transparent 1px)', backgroundSize: '60px 60px' }} />

      <motion.div 
        variants={CA_STAGGER} 
        initial="hidden" 
        animate="show"
        className="max-w-4xl w-full relative z-10"
      >
        <motion.div variants={CA_ITEM} className="text-center mb-12">
          <div className="inline-flex items-center gap-3 bg-[var(--rolex-gold)]/10 border border-[var(--rolex-gold)]/30 px-5 py-1.5 mb-8">
            <ShieldCheck size={12} className="text-[var(--rolex-gold)]" />
            <span className="text-[9px] font-bold font-mono tracking-[0.25em] text-[var(--rolex-gold)] uppercase">PROTOCOL TRANSPARENCY LEDGER</span>
          </div>
          <h1 className="text-5xl md:text-7xl font-bold tracking-tighter text-white mb-6 uppercase leading-[0.9]">
            Proof of <span className="text-[var(--rolex-gold)]">Trust</span>.
          </h1>
          <p className="text-[10px] font-mono tracking-widest uppercase text-[var(--text-secondary)] max-w-2xl mx-auto leading-relaxed font-semibold">
            Verify the authenticity and certification history of any asset secured by the Tokenly Protocol. Open. Immutable. Global.
          </p>
        </motion.div>

        <motion.form 
          variants={CA_ITEM}
          onSubmit={handleSearch}
          className="relative max-w-2xl mx-auto mb-16 group"
        >
          <div className="absolute -inset-1 bg-gradient-to-r from-[var(--rolex-gold)]/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity blur-md" />
          <div className="relative flex flex-col sm:flex-row gap-0 border border-[var(--border-dark)] bg-black/80 backdrop-blur-xl">
            <div className="flex-grow flex items-center relative border-b sm:border-b-0 sm:border-r border-[var(--border-dark)]">
              <Search className="absolute left-5 text-[var(--text-muted)]" size={16} />
              <input 
                type="text" 
                value={hash}
                onChange={(e) => setHash(e.target.value)}
                placeholder="PASTE AUDIT HASH OR CERTIFICATE ID..."
                className="w-full bg-transparent border-none text-white px-12 py-5 text-[10px] font-mono tracking-widest focus:outline-none placeholder:text-white/20 uppercase font-bold"
              />
            </div>
            <button 
              type="submit"
              className="bg-[var(--rolex-gold)] text-black px-10 py-5 text-[10px] font-bold font-mono tracking-widest uppercase hover:bg-white transition-all duration-300"
            >
              Verify
            </button>
          </div>
        </motion.form>

        <motion.div 
          variants={CA_ITEM}
          className="grid grid-cols-1 md:grid-cols-3 gap-0 border border-[var(--border-dark)] bg-[#0A0A0A]"
        >
          <div className="p-8 border-b md:border-b-0 md:border-r border-[var(--border-dark)] group hover:bg-white/[0.02] transition-colors">
            <Globe size={20} className="text-[var(--rolex-gold)] mb-6" />
            <h3 className="text-[11px] font-bold font-mono tracking-widest uppercase text-white mb-3">Public Access</h3>
            <p className="text-[9px] font-mono tracking-wider uppercase text-[var(--text-muted)] leading-relaxed font-bold">Anyone can verify asset integrity without an account or wallet.</p>
          </div>
          <div className="p-8 border-b md:border-b-0 md:border-r border-[var(--border-dark)] group hover:bg-white/[0.02] transition-colors">
            <Lock size={20} className="text-[var(--rolex-gold)] mb-6" />
            <h3 className="text-[11px] font-bold font-mono tracking-widest uppercase text-white mb-3">Tamper-Proof</h3>
            <p className="text-[9px] font-mono tracking-wider uppercase text-[var(--text-muted)] leading-relaxed font-bold">Audit logs are cryptographically hashed and anchored to the protocol.</p>
          </div>
          <div className="p-8 group hover:bg-white/[0.02] transition-colors">
            <ShieldCheck size={20} className="text-[var(--rolex-gold)] mb-6" />
            <h3 className="text-[11px] font-bold font-mono tracking-widest uppercase text-white mb-3">Node Verified</h3>
            <p className="text-[9px] font-mono tracking-wider uppercase text-[var(--text-muted)] leading-relaxed font-bold">Every certificate is backed by high-RRS Gemologist consensus.</p>
          </div>
        </motion.div>
      </motion.div>

      <div className="absolute bottom-12 text-[9px] font-mono text-[var(--text-muted)] tracking-[0.4em] uppercase opacity-50">
        TOKENLY PROTOCOL V5 &bull; PRODUCTION CORE &bull; [ {new Date().getFullYear()} ]
      </div>
    </div>
  );
}
