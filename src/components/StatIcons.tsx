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

// Real USDC mark: a flat #2775CA disc with the two open rings flanking a "$" — matches Circle's official USDC token icon.
export function UsdcCoinIcon({ size = 48, className = '' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" className={className} aria-hidden="true">
      {/* hard shadow, consistent with the rest of the site's icon set */}
      <circle cx="35" cy="35" r="27" fill="#111" />
      {/* coin */}
      <circle cx="32" cy="32" r="27" fill="#2775CA" stroke="#111" strokeWidth="3" />
      {/* two open rings flanking the dollar sign */}
      <path
        d="M29.22 16.24 C21.58 17.59 16 24.24 16 32 C16 39.76 21.58 46.41 29.22 47.76"
        stroke="#FFFDF0" strokeWidth="4.3" strokeLinecap="round" fill="none"
      />
      <path
        d="M34.78 16.24 C42.42 17.59 48 24.24 48 32 C48 39.76 42.42 46.41 34.78 47.76"
        stroke="#FFFDF0" strokeWidth="4.3" strokeLinecap="round" fill="none"
      />
      {/* dollar sign */}
      <path d="M32 14 V50" stroke="#FFFDF0" strokeWidth="4" strokeLinecap="round" />
      <path
        d="M39 25 C39 20.5 35.8 18 32 18 C27.5 18 24 20.3 24 24.3 C24 28.3 27.8 29.8 32 31 C36.2 32.2 40 33.8 40 38.3 C40 42.8 36.2 46 32 46 C27.8 46 24.5 43.3 24.5 39"
        stroke="#FFFDF0" strokeWidth="4" strokeLinecap="round" fill="none"
      />
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
