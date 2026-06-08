import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'About — Protocol Whitepaper | Tokenly',
  description: 'The world\'s first economically enforced authenticity protocol. Learn about decentralized trust, Neural Visual Oracle, and the Arbitration Hub.',
};

export default function AboutLayout({ children }: { children: React.ReactNode }) {
  return children;
}
