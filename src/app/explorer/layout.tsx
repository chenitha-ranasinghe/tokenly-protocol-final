import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Explorer — Public Ledger | Tokenly',
  description: 'Transparent audit verification. Browse protocol transactions and verify cryptographic audit hashes on the public ledger.',
};

export default function ExplorerLayout({ children }: { children: React.ReactNode }) {
  return children;
}
