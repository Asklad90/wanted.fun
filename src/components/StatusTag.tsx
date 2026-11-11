type Status = 'OPEN' | 'FULL' | 'EXPIRED' | 'CANCELLED'

const STATUS_STYLES: Record<Status, { bg: string; text: string; label: string }> = {
  OPEN:      { bg: '#C6F23A', text: '#111111', label: 'OPEN' },
  FULL:      { bg: '#FF3E9A', text: '#FFFFFF', label: 'FULL' },
  EXPIRED:   { bg: '#E5E4D7', text: '#111111', label: 'ENDED' },
  CANCELLED: { bg: '#FFE600', text: '#111111', label: 'CANCELLED' },
}

export function StatusTag({ status }: { status: Status }) {
  const { bg, text, label } = STATUS_STYLES[status]
  return (
    <span
      className="font-mono-bold text-[10px] sm:text-[11px] uppercase tracking-wider px-2.5 py-0.5 rounded-full border-[2px] border-[#111] shadow-[2px_2px_0_#111] inline-flex items-center gap-1.5 shrink-0 select-none"
      style={{ backgroundColor: bg, color: text }}
    >
      {status === 'OPEN' && (
        <span className="w-2 h-2 rounded-full bg-[#111] animate-pulse shrink-0" aria-hidden="true" />
      )}
      {status === 'FULL' && (
        <svg className="w-3 h-3 shrink-0" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path d="M3.5 8.5L6.5 11.5L12.5 4.5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
      {status === 'EXPIRED' && (
        <span className="w-1.5 h-1.5 rounded-full bg-[#111]/60 shrink-0" aria-hidden="true" />
      )}
      {status === 'CANCELLED' && (
        <svg className="w-2.5 h-2.5 shrink-0" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
        </svg>
      )}
      <span>{label}</span>
    </span>
  )
}
