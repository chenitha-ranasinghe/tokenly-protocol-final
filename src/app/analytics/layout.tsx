import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Analytics — Intelligence Terminal | Tokenly',
  description: 'Core system intelligence. A/B behavioral vectors, consensus fluidity index, and oracle authority distribution analytics.',
};

export default function AnalyticsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
