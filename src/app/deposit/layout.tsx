import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Deposit — Capital Initialization | Tokenly',
  description: 'Convert fiat to protocol points via secure gateway. Fund your treasury for trading, staking, and governance.',
};

export default function DepositLayout({ children }: { children: React.ReactNode }) {
  return children;
}
