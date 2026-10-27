/** Chunky neobrutalist icons for the stats row, side card and prize amounts */

interface IconProps { size?: number; className?: string }

export function NotepadIcon({ size = 48, className = '' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" className={className} aria-hidden="true">
      {/* hard shadow */}
      <rect x="19" y="13" width="34" height="44" rx="4" fill="#111" />
      {/* paper */}
      <rect x="14" y="10" width="34" height="44" rx="4" fill="#FFFDF0" stroke="#111" strokeWidth="3" />
      {/* highlighted first line */}
      <rect x="20" y="23" width="22" height="7" rx="2" fill="#FFE600" />
      {/* text lines */}
      <path d="M21 26.5 H41" stroke="#111" strokeWidth="3" strokeLinecap="round" />
      <path d="M21 36 H41" stroke="#111" strokeWidth="3" strokeLinecap="round" />
      <path d="M21 44 H33" stroke="#111" strokeWidth="3" strokeLinecap="round" />
      {/* clip */}
      <rect x="22" y="5" width="18" height="10" rx="3" fill="#A78BFA" stroke="#111" strokeWidth="3" />
    </svg>
  )
}

// Official USDC mark, measured from Circle's real asset (bracket arcs are exactly
// 147° with 33° gaps, ring sits at ~0.70 of the circle's radius) — flat, no outline.
// Kept identical to Icons.tsx's CoinIcon so every USDC mark on the site matches.
export function UsdcCoinIcon({ size = 48, className = '' }: IconProps) {
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

const CUP = 'M18 8 H42 V24 C42 33 37 38 30 38 C23 38 18 33 18 24 Z'
const HANDLE_L = 'M18 12 H10 C8 12 7 13 7 15 V18 C7 23 11 27 18 28'
const HANDLE_R = 'M42 12 H50 C52 12 53 13 53 15 V18 C53 23 49 27 42 28'

export function TrophyBigIcon({ size = 48, className = '' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" className={className} aria-hidden="true">
      {/* hard shadow */}
      <g transform="translate(3 3)" fill="#111" stroke="#111" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round">
        <path d={CUP} />
        <path d={HANDLE_L} fill="none" strokeWidth="7" />
        <path d={HANDLE_R} fill="none" strokeWidth="7" />
        <rect x="27" y="38" width="6" height="8" />
        <rect x="19" y="46" width="22" height="7" rx="1.5" />
      </g>
      {/* handles: dark outline + gold core */}
      <path d={HANDLE_L} fill="none" stroke="#111" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
      <path d={HANDLE_L} fill="none" stroke="#FFE600" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d={HANDLE_R} fill="none" stroke="#111" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
      <path d={HANDLE_R} fill="none" stroke="#FFE600" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      {/* stem + base */}
      <rect x="27" y="38" width="6" height="8" fill="#FFE600" stroke="#111" strokeWidth="3" strokeLinejoin="round" />
      <rect x="19" y="46" width="22" height="7" rx="1.5" fill="#FF3E9A" stroke="#111" strokeWidth="3" strokeLinejoin="round" />
      {/* cup */}
      <path d={CUP} fill="#FFE600" stroke="#111" strokeWidth="3" strokeLinejoin="round" />
      {/* star */}
      <path
        d="M30 13 L32.2 18 L37.5 18.5 L33.5 22 L34.8 27.2 L30 24.5 L25.2 27.2 L26.5 22 L22.5 18.5 L27.8 18 Z"
        fill="#FFFDF0" stroke="#111" strokeWidth="1.5" strokeLinejoin="round"
      />
      {/* shine */}
      <path d="M22.5 12 V20" stroke="#fff" strokeOpacity="0.65" strokeWidth="3" strokeLinecap="round" />
    </svg>
  )
}
