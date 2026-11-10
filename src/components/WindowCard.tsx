import React from 'react'

interface WindowCardProps {
  title: string
  titleBarColor?: string
  children: React.ReactNode
  className?: string
  onClose?: () => void
  bodyClassName?: string
}

export function WindowCard({
  title,
  titleBarColor = '#FF3E9A',
  children,
  className = '',
  onClose,
  bodyClassName = '',
}: WindowCardProps) {
  return (
    <div
      className={`rounded-2xl border-[3px] border-[#111] shadow-hard animate-bounce-in bg-white overflow-hidden ${className}`}
    >
      {/* Title bar */}
      <div
        className="flex items-center justify-between px-3.5 py-2.5 border-b-[3px] border-[#111] select-none"
        style={{ backgroundColor: titleBarColor }}
      >
        <span
          className="font-mono-bold text-[11px] sm:text-[12px] uppercase tracking-wider text-[#111] truncate pr-2"
          style={{ letterSpacing: '0.08em' }}
        >
          {title}
        </span>
        <div className="flex gap-1.5 shrink-0">
          <button
            type="button"
            tabIndex={-1}
            className="w-5 h-5 rounded-md border-2 border-[#111] bg-white hover:bg-white/90 text-[10px] flex items-center justify-center font-mono-bold leading-none cursor-default"
          >
            −
          </button>
          <button
            type="button"
            tabIndex={-1}
            className="w-5 h-5 rounded-md border-2 border-[#111] bg-white hover:bg-white/90 text-[9px] flex items-center justify-center font-mono-bold leading-none cursor-default"
          >
            □
          </button>
          <button
            type="button"
            tabIndex={-1}
            onClick={onClose}
            className="w-5 h-5 rounded-md border-2 border-[#111] bg-white hover:bg-[#FF6B57] text-[10px] flex items-center justify-center font-mono-bold leading-none cursor-pointer"
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
