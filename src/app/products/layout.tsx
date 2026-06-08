import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Asset Catalog — Oracle Verification | Tokenly',
  description: 'Browse the asset catalog, submit verification intelligence, and earn yield through accurate market assessments.',
};

export default function ProductsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
