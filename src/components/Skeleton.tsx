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
    <div className="relative border-[3px] border-[#111] rounded-2xl overflow-hidden shadow-hard bg-white">
      {/* Light sweep effect */}
      <div className="bounty-glass-shine" aria-hidden="true">
        <div className="bounty-glass-beam" />
      </div>

      {/* Title bar */}
      <div className="h-9 border-b-[3px] border-[#111] px-3 flex items-center gap-2 bg-[#EAFCDA]">
        <div className="w-5 h-5 rounded-full bg-[#111] flex items-center justify-center shrink-0">
          <div className="w-2.5 h-2.5 rounded-full bg-[#C6F23A] animate-pulse" />
        </div>
        <SkeletonLine width="120px" height="11px" />
        <div className="ml-auto flex gap-1.5">
          {[0, 1, 2].map(i => (
            <div key={i} className="w-4 h-4 rounded-sm border-2 border-[#111] bg-white/70" />
          ))}
        </div>
      </div>

      {/* Body */}
      <div className="p-4 flex flex-col gap-3">
        {/* Status + time */}
        <div className="flex items-center justify-between">
          <SkeletonLine width="64px" height="22px" className="rounded-full" />
          <SkeletonLine width="70px" height="12px" />
        </div>

        {/* Title + Accent line */}
        <div className="flex flex-col gap-1.5">
          <SkeletonLine width="75%" height="22px" />
          <div className="w-16 h-1.5 bg-[#C6F23A]/50 rounded-full mt-0.5" />
        </div>

        {/* Description line */}
        <SkeletonLine width="90%" height="12px" />

        {/* 2x2 stat grid */}
        <div className="grid grid-cols-2 gap-2">
          {[0, 1, 2, 3].map(i => (
            <div key={i} className="border-2 border-[#111]/30 rounded-xl p-2.5 bg-[#FFFDF0] flex flex-col gap-2 min-h-[72px]">
              <SkeletonLine width="20px" height="16px" />
              <SkeletonLine width="70px" height="18px" />
              <SkeletonLine width="50px" height="9px" />
            </div>
          ))}
        </div>

        {/* Escrow placeholder */}
        <div className="border-2 border-[#111]/30 rounded-xl p-2.5 bg-[#EAFCDA]/40 flex flex-col gap-2">
          <SkeletonLine width="60px" height="10px" />
          <div className="grid grid-cols-2 gap-2">
            <SkeletonLine width="80px" height="14px" />
            <SkeletonLine width="80px" height="14px" />
          </div>
        </div>

        {/* Winners progress bar */}
        <div className="flex flex-col gap-1.5">
          <SkeletonLine width="75px" height="10px" />
          <div className="flex gap-1.5">
            {[0, 1, 2].map(i => (
              <div key={i} className="h-3.5 flex-1 border-2 border-[#111]/20 rounded-full bg-[#FFFDF0]" />
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="pt-2 border-t border-[#111]/10 flex items-center justify-between">
          <SkeletonLine width="110px" height="11px" />
        </div>
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
    <div className="border-[3px] border-[#111]/20 rounded-lg p-3 bg-[#FFFDF0]/60 flex items-center justify-between gap-2 h-14">
      <div className="flex flex-col gap-1.5 flex-1">
        <SkeletonLine width="60%" height="11px" />
        <SkeletonLine width="40%" height="9px" />
      </div>
      <SkeletonLine width="48px" height="20px" className="rounded-full shrink-0" />
    </div>
  )
}
