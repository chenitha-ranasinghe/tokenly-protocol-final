'use client';
import { motion } from 'framer-motion';

const SECTIONS = [
  {
    id: 1,
    title: 'Protocol Participation & Risk Disclosure',
    content: 'Tokenly is an institutional-grade decentralized financial protocol. By accessing the interface, you acknowledge that participation in Asset Validation (Staking) involves inherent market and technological risks. The Reviewer Reputation Score (RRS) v3.0 is the algorithmically-enforced arbiter of truth within the network. Capital allocated to inaccurate estimates is subject to Quadratic Slashing.'
  },
  {
    id: 2,
    title: 'Fractional Ownership & Physical Redemption',
    content: 'Fractional Vault Tokens represent a 1/n beneficial interest in physically vaulted luxury assets. Acquiring 100% of an asset\'s total supply (1,000 shares) qualifies the holder for Physical Redemption. Assets are held in Tier-1 secure facilities (Malca-Amit, Brinks). Redemption involves the irreversible destruction of digital tokens in exchange for physical title transfer, subject to regional logistics and duty requirements.'
  },
  {
    id: 3,
    title: 'Node Governance & The CAN DAO',
    content: 'Certified Asset Network (CAN) nodes (Inspectors, Gemologists, Authenticators) are bonded participants. Malicious actors or "Wash Traders" detected by the protocol\'s forensic engine will face an immediate 100% bond slash and permanent network exclusion. Nodes are responsible for the integrity of the physical-to-digital bridge.'
  },
  {
    id: 4,
    title: 'AML/KYC & Global Compliance',
    content: 'Tokenly operates under the "Hardened Protocol Layer" guidelines. Participants entering high-value staking tiers or initiating physical redemptions must undergo Verification through the integrated Privy/Identity layer. Nodes must comply with international Anti-Money Laundering (AML) standards.'
  },
  {
    id: 5,
    title: 'Jurisdiction & Governing Law',
    content: 'These terms are governed by the laws of the Republic of Singapore. Any disputes arising from protocol interaction shall be subject to the exclusive jurisdiction of the Singapore International Arbitration Centre (SIAC).'
  }
];

export default function TermsPage() {
  return (
    <div className="page-wrapper">
      <main className="container" style={{ paddingTop: 32, maxWidth: 800, paddingBottom: 60 }}>
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <h1 style={{ fontSize: '2.5rem', fontWeight: 700, marginBottom: 8, letterSpacing: '-0.03em', textTransform: 'uppercase' }}>Terms of Service</h1>
          <p style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', marginBottom: 40, fontWeight: 800 }}>RELEASE: V5.0.4 &bull; EFFECTIVE: APRIL 20, 2026 &bull; PROTOCOL: HARDENED</p>

          {SECTIONS.map(s => (
            <section key={s.id} style={{ marginBottom: 32 }}>
              <h2 style={{ color: 'var(--rolex-gold)', fontSize: '0.9rem', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.15em', fontWeight: 800 }}>{s.id}. {s.title}</h2>
              <p style={{ fontSize: '0.85rem', lineHeight: 1.6, color: 'var(--text-secondary)', fontWeight: 500 }}>
                {s.content}
              </p>
            </section>
          ))}
        </motion.div>
      </main>
    </div>
  );
}
