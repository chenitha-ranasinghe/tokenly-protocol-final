import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Leaderboard — Global Rankings | Tokenly',
  description: 'See the top-ranked protocol nodes. Leaderboard ranked by verified Node Reputation Score (RRS) and Proof of Fidelity.',
};

export default function LeaderboardLayout({ children }: { children: React.ReactNode }) {
  return children;
}
