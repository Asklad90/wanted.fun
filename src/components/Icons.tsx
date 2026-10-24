/** Pixel-style flat inline SVG icons */

interface IconProps { size?: number; className?: string }

export function FolderIcon({ size = 20, className = '' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" className={className}>
      {/* tab */}
      <path d="M2 6h5l1.5 1.5H18V16H2V6z" fill="#60A5FA" stroke="#111" strokeWidth="1.5" strokeLinejoin="round"/>
      {/* subtle shine line */}
      <path d="M3 9h14" stroke="#fff" strokeWidth="1" strokeOpacity="0.4"/>
    </svg>
  )
}

export function CoinIcon({ size = 20, className = '' }: IconProps) {
  // Official USDC mark, measured from Circle's real asset (bracket arcs are exactly
  // 147° with 33° gaps, ring sits at ~0.70 of the circle's radius) — flat, no outline.
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" className={className} aria-hidden="true">
      <circle cx="32" cy="32" r="27" fill="#2775CA" />
      <path d="M37.40 13.78 C45.46 16.17 51 23.59 51 32 C51 40.41 45.46 47.83 37.40 50.22" stroke="#FFFDF0" strokeWidth="3" strokeLinecap="round" fill="none" />
      <path d="M26.60 13.78 C18.54 16.17 13 23.59 13 32 C13 40.41 18.54 47.83 26.60 50.22" stroke="#FFFDF0" strokeWidth="3" strokeLinecap="round" fill="none" />
      <path d="M32 19 V45" stroke="#FFFDF0" strokeWidth="3" strokeLinecap="round" />
      <path d="M37.5 26.8 C37.5 24.6 35.3 23.2 32 23.2 C29.2 23.2 27 24.4 27 26.6 C27 28.8 29.3 29.7 32 30.4 C34.7 31.1 37 32 37 34.4 C37 36.8 34.7 38.8 32 38.8 C29.3 38.8 27.2 37.3 27 35.1" stroke="#FFFDF0" strokeWidth="3" strokeLinecap="round" fill="none" />
    </svg>
  )
}

export function LockIcon({ size = 20, className = '' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" className={className}>
      <rect x="4" y="9" width="12" height="9" rx="2" fill="currentColor" stroke="#111" strokeWidth="1.5"/>
      <path d="M7 9V6a3 3 0 016 0v3" stroke="#111" strokeWidth="1.5" strokeLinecap="round"/>
      <circle cx="10" cy="14" r="1.5" fill="#111"/>
    </svg>
  )
}

export function TrophyIcon({ size = 20, className = '' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" className={className}>
      {/* cup body — gold */}
      <path d="M5 3h10v7a5 5 0 01-10 0V3z" fill="#F59E0B" stroke="#111" strokeWidth="1.5"/>
      {/* shine on cup */}
      <path d="M7 5h2" stroke="#FDE68A" strokeWidth="1.2" strokeLinecap="round"/>
      {/* handles */}
      <path d="M3 4H5M17 4h-2" stroke="#111" strokeWidth="1.5" strokeLinecap="round"/>
      {/* stem + base */}
      <path d="M10 15v2M7 18h6" stroke="#111" strokeWidth="1.5" strokeLinecap="round"/>
      {/* base plate — gold */}
      <rect x="7" y="17" width="6" height="1.5" rx="0.5" fill="#F59E0B" stroke="#111" strokeWidth="1"/>
    </svg>
  )
}

export function ClockIcon({ size = 20, className = '' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" className={className}>
      <circle cx="10" cy="10" r="8" fill="currentColor" stroke="#111" strokeWidth="1.5"/>
      <path d="M10 6v4l3 2" stroke="#111" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

export function WalletIcon({ size = 20, className = '' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" className={className}>
      <rect x="2" y="5" width="16" height="12" rx="2" fill="#C6F23A" stroke="#111" strokeWidth="1.5"/>
      <path d="M2 9h16" stroke="#111" strokeWidth="1.5"/>
      <rect x="12" y="11" width="4" height="4" rx="1" fill="#111"/>
    </svg>
  )
}

export function CheckCircleIcon({ size = 20, className = '' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" className={className}>
      <circle cx="10" cy="10" r="8" fill="#7FF3F0" stroke="#111" strokeWidth="1.5"/>
      <path d="M6.5 10.3l2.2 2.2 4.8-4.8" stroke="#111" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

export function ArrowRightIcon({ size = 16, className = '' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}
