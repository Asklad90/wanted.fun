type Status = 'OPEN' | 'FULL' | 'EXPIRED' | 'CANCELLED'

const STATUS_STYLES: Record<Status, { bg: string; label: string }> = {
  OPEN:      { bg: '#C6F23A', label: 'OPEN' },
  FULL:      { bg: '#FF3E9A', label: 'FULL' },
  EXPIRED:   { bg: '#CCCCCC', label: 'EXPIRED' },
  CANCELLED: { bg: '#FFE600', label: 'CANCELLED' },
}

export function StatusTag({ status }: { status: Status }) {
  const { bg, label } = STATUS_STYLES[status]
  return (
    <span
      className="font-mono-bold text-[10px] sm:text-[11px] uppercase tracking-wider px-2.5 py-0.5 rounded-full border-2 border-[#111] inline-flex items-center gap-1 shrink-0 text-[#111]"
      style={{ backgroundColor: bg }}
    >
      {status === 'OPEN' && (
        <svg className="w-3 h-3 fill-current shrink-0" viewBox="0 0 24 24">
          <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
        </svg>
      )}
      {label}
    </span>
  )
}
