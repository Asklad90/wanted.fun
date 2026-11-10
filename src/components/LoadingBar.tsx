interface LoadingBarProps {
  current: number
  max: number
  label?: string
  color?: string
}

export function LoadingBar({
  current,
  max,
  label,
  color = '#FF2E93',
}: LoadingBarProps) {
  const pct = max === 0 ? 0 : Math.min(100, (current / max) * 100)
  const segments = Array.from({ length: max }, (_, i) => i < current)

  return (
    <div>
      {label && (
        <div className="font-mono-bold text-[10px] uppercase tracking-wider text-[#111] mb-1.5" style={{ letterSpacing: '0.06em' }}>
          {label}
        </div>
      )}
      {max <= 10 ? (
        // Segmented rounded pill capsules
        <div className="flex gap-1.5">
          {segments.map((filled, i) => (
            <div
              key={i}
              className="h-3.5 sm:h-4 flex-1 border-2 border-[#111] rounded-full transition-all"
              style={{ backgroundColor: filled ? color : '#FFFFFF' }}
            />
          ))}
        </div>
      ) : (
        // Continuous pill bar
        <div className="h-3.5 sm:h-4 w-full border-2 border-[#111] rounded-full bg-white overflow-hidden p-0.5">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${pct}%`, backgroundColor: color }}
          />
        </div>
      )}
    </div>
  )
}
