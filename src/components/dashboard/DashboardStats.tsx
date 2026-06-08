'use client';
import { StatCard } from '@/components/shared/StatCard';
import type { User } from '@/lib/types';

interface DashboardStatsProps {
  user: User;
  totalValue: number;
  openOrders: number;
}

export function DashboardStats({ user, totalValue, openOrders }: DashboardStatsProps) {
  const accuracy = user.total_reviews > 0
    ? ((user.accurate_reviews / user.total_reviews) * 100).toFixed(1)
    : '0.0';

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-[var(--border-dark)] border border-[var(--border-dark)]">
      <StatCard label="Points Balance" value={(user?.points || 0).toLocaleString()} sub="Available to stake" highlight />
      <StatCard label="RRS Score" value={(user?.rrs_score || 0).toFixed(1)} sub={`${accuracy}% accuracy`} />
      <StatCard label="Portfolio Value" value={`${(totalValue || 0).toLocaleString()} PTS`} sub={`${openOrders || 0} open orders`} />
      <StatCard label="Reviews" value={user?.total_reviews || 0} sub={`${user?.accurate_reviews || 0} accurate`} />
    </div>
  );
}
