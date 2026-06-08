import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Portfolio — Holdings & P&L | Tokenly',
  description: 'Manage your fractionalized asset portfolio. View unrealized gains, execute P2P transfers, and track share distributions.',
};

export default function PortfolioLayout({ children }: { children: React.ReactNode }) {
  return children;
}
