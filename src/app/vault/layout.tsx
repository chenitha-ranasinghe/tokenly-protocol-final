import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Vault — Asset Marketplace | Tokenly',
  description: 'Browse and trade fractionalized luxury assets. Real-time consensus pricing, institutional-grade verification, and 24/7 liquidity.',
};

export default function VaultLayout({ children }: { children: React.ReactNode }) {
  return children;
}
