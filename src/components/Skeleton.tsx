/**
 * Skeleton shimmer primitives — matches the site's retro border/card aesthetic.
 * Use <SkeletonCard> for full bounty card placeholders and <SkeletonLine> for
 * inline text placeholders.
 */

// ─── Base shimmer block ───────────────────────────────────────────────────────
interface SkeletonProps {
  className?: string
  style?: React.CSSProperties
}

export function Skeleton({ className = '', style }: SkeletonProps) {
  return (
    <div
      className={`skeleton-shimmer rounded ${className}`}
      style={style}
    />
  )
}

// ─── Text line ────────────────────────────────────────────────────────────────
export function SkeletonLine({ width = '100%', height = '12px', className = '' }: {
  width?: string
  height?: string
  className?: string
}) {
  return <Skeleton className={`rounded-full ${className}`} style={{ width, height }} />
}

// ─── Full bounty card placeholder — mirrors BountyCard layout ────────────────
export function SkeletonBountyCard() {
  return (
    <div className="border-[3px] border-[#111]/20 rounded-lg overflow-hidden shadow-hard-sm">
      {/* Title bar */}
      <div className="h-9 border-b-[3px] border-[#111]/20 px-3 flex items-center gap-2">
        <SkeletonLine width="120px" height="10px" />
        <div className="ml-auto flex gap-1.5">
          {[0,1,2].map(i => <Skeleton key={i} className="w-4 h-4 rounded-sm" />)}
        </div>
      </div>
      {/* Body */}
      <div className="p-4 flex flex-col gap-3 bg-[#FFFDF0]/60">
        {/* Status + time */}
        <div className="flex items-center justify-between">
          <SkeletonLine width="56px" height="20px" className="rounded-full" />
          <SkeletonLine width="60px" height="10px" />
        </div>
        {/* Title */}
        <div className="flex flex-col gap-1.5">
          <SkeletonLine width="85%" height="14px" />
          <SkeletonLine width="60%" height="14px" />
        </div>
        {/* Big reward number */}
        <SkeletonLine width="100px" height="36px" className="rounded-md" />
        {/* Locked pill */}
        <SkeletonLine width="130px" height="20px" className="rounded-full" />
        {/* Progress bar */}
        <div className="flex flex-col gap-1">
          <SkeletonLine width="70px" height="9px" />
          <Skeleton className="w-full h-2 rounded-full" />
        </div>
        {/* Submission count */}
        <SkeletonLine width="80px" height="10px" />
      </div>
    </div>
  )
}

// ─── Submission row placeholder ───────────────────────────────────────────────
export function SkeletonSubmissionRow() {
  return (
    <div className="border-[2px] border-[#111]/20 rounded-lg p-3 flex flex-col gap-2 bg-[#FFFDF0]/60">
      <div className="flex items-center justify-between">
        <SkeletonLine width="100px" height="10px" />
        <SkeletonLine width="60px" height="10px" />
      </div>
      <SkeletonLine width="90%" height="10px" />
      <SkeletonLine width="70%" height="10px" />
    </div>
  )
}

// ─── Profile bounty row placeholder ──────────────────────────────────────────
export function SkeletonBountyRow() {
  return (
    <div className="px-5 sm:px-6 py-4 flex items-center justify-between gap-4">
      <div className="flex flex-col gap-2 flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <SkeletonLine width="42px" height="14px" />
          <SkeletonLine width="54px" height="16px" className="rounded-full" />
        </div>
        <SkeletonLine width="58%" height="15px" />
        <SkeletonLine width="32%" height="11px" />
      </div>
      <div className="flex flex-col items-end gap-1.5 shrink-0">
        <SkeletonLine width="78px" height="16px" />
        <SkeletonLine width="44px" height="10px" />
      </div>
    </div>
  )
}
