import { Skeleton } from '@/components/shared/Skeleton';

/** Reusable skeleton loading component for pages */
export function SkeletonCard({ className = '' }: { className?: string }) {
  return (
    <div className={`bg-[#050505] border border-[var(--border-dark)] p-6 ${className}`}>
      <Skeleton height="10px" width="96px" className="mb-4" />
      <Skeleton height="24px" width="128px" className="mb-3" />
      <Skeleton height="8px" width="100%" className="mb-2" />
      <Skeleton height="8px" width="75%" />
    </div>
  );
}

export function SkeletonTable({ rows = 5 }: { rows?: number }) {
  return (
    <div className="bg-[#050505] border border-[var(--border-dark)]">
      <div className="px-6 py-4 border-b border-[var(--border-dark)] bg-[#0A0A0A]">
        <Skeleton height="12px" width="160px" />
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-6 px-6 py-5 border-b border-[var(--border-dark)]">
          <Skeleton height="12px" width="112px" />
          <Skeleton height="12px" width="64px" />
          <Skeleton height="12px" width="80px" />
          <Skeleton height="12px" width="48px" className="ml-auto" />
        </div>
      ))}
    </div>
  );
}

export function SkeletonGrid({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-[#050505] border border-[var(--border-dark)] p-6">
          <Skeleton height="8px" width="64px" className="mb-4" />
          <Skeleton height="20px" width="75%" className="mb-3" />
          <Skeleton height="8px" width="96px" className="mb-6" />
          <div className="pt-4 border-t border-[var(--border-dark)] flex justify-between">
            <Skeleton height="20px" width="80px" />
            <Skeleton height="20px" width="64px" />
          </div>
          <Skeleton height="2px" width="100%" className="mt-4 mb-6" />
          <Skeleton height="32px" width="100%" />
        </div>
      ))}
    </div>
  );
}

export function PageLoadingSkeleton() {
  return (
    <div className="min-h-screen bg-[var(--bg-primary)] pt-12 pb-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-8">
        {/* Header skeleton */}
        <div className="border-b border-[var(--border-dark)] pb-6 mb-8">
          <Skeleton height="8px" width="128px" className="mb-4" />
          <Skeleton height="32px" width="256px" className="mb-3" />
          <Skeleton height="10px" width="384px" />
        </div>
        {/* Content skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
        <SkeletonTable />
      </div>
    </div>
  );
}
