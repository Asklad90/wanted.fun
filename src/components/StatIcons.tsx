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

// Real USDC mark: a flat #2775CA disc with a white "$" — matches Circle's official USDC token icon.
export function UsdcCoinIcon({ size = 48, className = '' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" className={className} aria-hidden="true">
      {/* hard shadow, consistent with the rest of the site's icon set */}
      <circle cx="34" cy="34" r="25" fill="#111" />
      {/* coin */}
      <circle cx="30" cy="30" r="25" fill="#2775CA" stroke="#111" strokeWidth="3" />
      {/* dollar sign with the flared top/bottom strokes from the real USDC mark */}
      <path
        d="M30 13.5 V46.5"
        stroke="#FFFDF0" strokeWidth="3.4" strokeLinecap="round"
      />
      <path
        d="M23 36.5 C23 40.5 26.5 42.5 30.5 42.5 C35 42.5 38 40.3 38 37 C38 33.7 35 32.3 30 31 C25 29.7 22.5 28 22.5 24.8 C22.5 21.6 25.5 19.3 30 19.3 C33.7 19.3 36.8 21 37.5 24.3"
        stroke="#FFFDF0" strokeWidth="3.4" strokeLinecap="round" fill="none"
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
