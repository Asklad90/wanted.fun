import React from 'react'

interface WindowCardProps {
  title: string
  titleBarColor?: string
  children: React.ReactNode
  className?: string
  onClose?: () => void
  bodyClassName?: string
  headerRight?: React.ReactNode
}

export function WindowCard({
  title,
  titleBarColor = '#FF3E9A',
  children,
  className = '',
  onClose,
  bodyClassName = '',
  headerRight,
}: WindowCardProps) {
  return (
    <div
      className={`rounded-2xl border-[3px] border-[#111] shadow-hard animate-bounce-in bg-white overflow-hidden ${className}`}
    >
      {/* Retro OS Title bar */}
      <div
        className="flex items-center justify-between px-4 py-2.5 border-b-[3px] border-[#111] select-none"
        style={{
          backgroundColor: titleBarColor,
          boxShadow: 'inset 0 2px 0 rgba(255, 255, 255, 0.45)',
        }}
      >
        <div className="flex items-center gap-2 min-w-0 pr-2">
          <span className="w-2.5 h-2.5 rounded-full bg-[#111] shrink-0" aria-hidden="true" />
          <span
            className="font-mono-bold text-[11px] sm:text-[12px] uppercase tracking-wider text-[#111] truncate"
            style={{ letterSpacing: '0.08em' }}
          >
            {title}
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {headerRight}
          <div className="flex gap-1.5 shrink-0" aria-hidden={!onClose}>
            <span
              className="w-5 h-5 rounded-md border-[2px] border-[#111] bg-white text-[#111] text-[10px] flex items-center justify-center font-mono-bold leading-none shadow-[1.5px_1.5px_0_#111]"
            >
              −
            </span>
            <span
              className="w-5 h-5 rounded-md border-[2px] border-[#111] bg-white text-[#111] text-[9px] flex items-center justify-center font-mono-bold leading-none shadow-[1.5px_1.5px_0_#111]"
            >
              □
            </span>
            {onClose ? (
              <button
                type="button"
                onClick={onClose}
                aria-label="Close window"
                className="w-5 h-5 rounded-md border-[2px] border-[#111] bg-white hover:bg-[#FF6B57] hover:text-white text-[#111] text-[10px] flex items-center justify-center font-mono-bold leading-none shadow-[1.5px_1.5px_0_#111] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-colors cursor-pointer"
              >
                ✕
              </button>
            ) : (
              <span
                className="w-5 h-5 rounded-md border-[2px] border-[#111] bg-white text-[#111] text-[10px] flex items-center justify-center font-mono-bold leading-none shadow-[1.5px_1.5px_0_#111]"
              >
                ✕
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Body */}
      <div className={`p-4 sm:p-5 ${bodyClassName}`}>
        {children}
      </div>
    </div>
  )
}
