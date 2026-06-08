import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'C.A.N. Protocol — Governance | Tokenly',
  description: 'Certified Authenticator Network. Stake capital, acquire node clearance, vote on DAO proposals, and validate real-world assets.',
};

export default function CanLayout({ children }: { children: React.ReactNode }) {
  return children;
}
