import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Dashboard — Command Center | Tokenly',
  description: 'Your personal protocol command center. Track portfolio performance, quest progression, reputation score, and transaction history.',
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return children;
}
