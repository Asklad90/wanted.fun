import React from 'react'

interface WindowCardProps {
  title: string
  titleBarColor?: string
  children: React.ReactNode
  className?: string
  onClose?: () => void
  bodyClassName?: string
  showStarBadge?: boolean
  showGlassSweep?: boolean
  sweepDelay?: number
}

export function WindowCard({
  title,
  titleBarColor = '#4EFA96',
  children,
  className = '',
  onClose,
  bodyClassName = '',
  showStarBadge = true,
  showGlassSweep = false,
  sweepDelay = 0,
}: WindowCardProps) {
  return (
    <div
      className={`relative rounded-2xl border-[3px] border-[#111] shadow-hard animate-bounce-in bg-white overflow-hidden ${className}`}
    >
      {/* Optional continuous glowing glass beam sweep */}
      {showGlassSweep && (
        <div className="bounty-glass-shine" aria-hidden="true">
          <div
            className="bounty-glass-beam"
            style={sweepDelay ? { animationDelay: `${sweepDelay}s` } : undefined}
          />
        </div>
      )}

      {/* Title bar */}
      <div
        className="flex items-center justify-between px-3 py-2 border-b-[3px] border-[#111] select-none"
        style={{ backgroundColor: titleBarColor }}
      >
        <div className="flex items-center gap-2 min-w-0 pr-2">
          {showStarBadge && (
            <div className="w-5 h-5 rounded-full bg-[#111] flex items-center justify-center shrink-0 shadow-xs">
              <svg className="w-3 h-3 text-[#C6F23A] fill-current" viewBox="0 0 24 24">
                <path d="M12 0L14.59 9.41L24 12L14.59 14.59L12 24L9.41 14.59L0 12L9.41 9.41L12 0Z" />
              </svg>
            </div>
          )}
          <span
            className="font-mono-bold text-[11px] sm:text-[12px] uppercase tracking-wider text-[#111] truncate"
            style={{ letterSpacing: '0.06em' }}
          >
            {title}
          </span>
        </div>

        {/* Retro window control buttons */}
        <div className="flex gap-1.5 shrink-0">
          <button
            type="button"
            tabIndex={-1}
            aria-hidden="true"
            className="w-4 h-4 rounded-sm border-2 border-[#111] bg-white hover:bg-white/90 text-[8px] flex items-center justify-center font-mono-bold leading-none cursor-default"
          >
            −
          </button>
          <button
            type="button"
            tabIndex={-1}
            aria-hidden="true"
            className="w-4 h-4 rounded-sm border-2 border-[#111] bg-white hover:bg-white/90 text-[8px] flex items-center justify-center font-mono-bold leading-none cursor-default"
          >
            □
          </button>
          <button
            type="button"
            tabIndex={-1}
            onClick={e => {
              if (onClose) {
                e.stopPropagation()
                onClose()
              }
            }}
            className="w-4 h-4 rounded-sm border-2 border-[#111] bg-white hover:bg-[#FF6B57] text-[8px] flex items-center justify-center font-mono-bold leading-none"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Body */}
      <div className={`p-4 ${bodyClassName}`}>
        {children}
      </div>
    </div>
  )
}
