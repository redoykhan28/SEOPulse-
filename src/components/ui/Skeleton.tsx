import { cn } from "@/lib/utils";

// ─── Base shimmer animation ───────────────────────────────────────────────────
function Shimmer({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "animate-pulse bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 dark:from-white/5 dark:via-white/10 dark:to-white/5 rounded",
        className
      )}
    />
  );
}

// ─── Dashboard Stats Card Skeleton ────────────────────────────────────────────
export function StatCardSkeleton() {
  return (
    <div className="bg-white dark:bg-[#111111] border border-gray-200 dark:border-white/10 rounded-xl p-5">
      <div className="flex items-center gap-4">
        <Shimmer className="w-12 h-12 rounded-xl" />
        <div className="flex-1">
          <Shimmer className="h-3.5 w-24 mb-2" />
          <Shimmer className="h-7 w-16" />
        </div>
      </div>
    </div>
  );
}

// ─── Dashboard/Websites Table Row Skeleton ────────────────────────────────────
export function TableRowSkeleton() {
  return (
    <tr className="border-b border-gray-100 dark:border-white/5">
      <td className="px-6 py-4">
        <div className="flex items-center gap-3">
          <Shimmer className="h-8 w-8 rounded-lg flex-shrink-0" />
          <div>
            <Shimmer className="h-3.5 w-32 mb-1.5" />
            <Shimmer className="h-2.5 w-48" />
          </div>
        </div>
      </td>
      <td className="px-6 py-4"><Shimmer className="h-5 w-10 rounded-full" /></td>
      <td className="px-6 py-4"><Shimmer className="h-5 w-16 rounded" /></td>
      <td className="px-6 py-4"><Shimmer className="h-4 w-20" /></td>
      <td className="px-6 py-4 text-right">
        <div className="flex items-center justify-end gap-2">
          <Shimmer className="h-7 w-7 rounded-lg" />
          <Shimmer className="h-7 w-24 rounded-lg" />
          <Shimmer className="h-7 w-7 rounded-lg" />
        </div>
      </td>
    </tr>
  );
}

// ─── Website Details Score Card Skeleton ─────────────────────────────────────
export function ScoreCardSkeleton() {
  return (
    <div className="bg-white dark:bg-[#111111] border border-gray-200 dark:border-white/10 rounded-xl p-6">
      <Shimmer className="h-4 w-40 mb-4" />
      <Shimmer className="h-16 w-28 mb-6" />
      <Shimmer className="h-3.5 w-52" />
    </div>
  );
}

// ─── Website Details Issue Card Skeleton ─────────────────────────────────────
export function IssueCardSkeleton() {
  return (
    <div className="border border-gray-100 dark:border-white/10 rounded-xl overflow-hidden">
      <div className="flex items-center gap-3 px-5 py-4 bg-white dark:bg-[#111111]">
        <Shimmer className="w-8 h-8 rounded-full flex-shrink-0" />
        <div className="flex-1">
          <Shimmer className="h-4 w-40 mb-1.5" />
          <Shimmer className="h-3 w-56" />
        </div>
        <Shimmer className="h-5 w-16 rounded-full" />
        <Shimmer className="h-4 w-4" />
      </div>
    </div>
  );
}

// ─── Entire Dashboard loading skeleton ───────────────────────────────────────
export function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      {/* Header shimmer */}
      <div className="flex items-center justify-between">
        <div>
          <Shimmer className="h-8 w-36 mb-2" />
          <Shimmer className="h-4 w-64" />
        </div>
        <div className="flex gap-3">
          <Shimmer className="h-9 w-24 rounded-lg" />
          <Shimmer className="h-9 w-32 rounded-lg" />
        </div>
      </div>
      {/* Stat cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => <StatCardSkeleton key={i} />)}
      </div>
      {/* Table */}
      <div className="bg-white dark:bg-[#111111] border border-gray-200 dark:border-white/10 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-white/10">
          <Shimmer className="h-5 w-44" />
        </div>
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-100 dark:border-white/5">
              {["Website","SEO Score","Frequency","Last Scan","Actions"].map(h => (
                <th key={h} className="px-6 py-3 text-left">
                  <Shimmer className="h-3 w-16" />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 3 }).map((_, i) => <TableRowSkeleton key={i} />)}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Website Details full skeleton ───────────────────────────────────────────
export function WebsiteDetailsSkeleton() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Shimmer className="h-9 w-9 rounded-lg" />
          <div>
            <Shimmer className="h-7 w-48 mb-2" />
            <Shimmer className="h-4 w-64" />
          </div>
        </div>
        <div className="flex gap-3">
          <Shimmer className="h-9 w-36 rounded-lg" />
          <Shimmer className="h-9 w-32 rounded-lg" />
          <Shimmer className="h-9 w-9 rounded-lg" />
        </div>
      </div>
      {/* Score Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <ScoreCardSkeleton />
        <div className="col-span-2 grid grid-cols-2 gap-4">
          <ScoreCardSkeleton />
          <ScoreCardSkeleton />
        </div>
      </div>
      {/* Report section */}
      <div className="bg-white dark:bg-[#111111] border border-gray-200 dark:border-white/10 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-white/10 flex items-center justify-between">
          <Shimmer className="h-5 w-48" />
          <Shimmer className="h-8 w-56 rounded-lg" />
        </div>
        <div className="p-4 space-y-2">
          {Array.from({ length: 5 }).map((_, i) => <IssueCardSkeleton key={i} />)}
        </div>
      </div>
    </div>
  );
}
