import React from 'react'

interface Doodle {
  position: string
  size: number
  bg: string
  rotate: number
  delay: string
  shape: 'circle' | 'square' | 'pill'
  label?: string
}

// Desktop-only — fills the wide empty gutters beside the content, top to bottom,
// with a mix of insets so it reads as scattered rather than a single lined-up column.
// Only kicks in on genuinely wide screens (1536px+), where this much side gutter exists.
const MARGIN_DOODLES: Doodle[] = [
  // Left gutter, top to bottom
  { position: 'left-[1.2%] top-[6%]',   size: 44, bg: '#7FF3F0', rotate: 9,   delay: '0.2s', shape: 'circle', label: '$' },
  { position: 'left-[2.8%] top-[18%]',  size: 34, bg: '#FF3E9A', rotate: -12, delay: '1.4s', shape: 'square' },
  { position: 'left-[1.2%] top-[30%]',  size: 58, bg: '#FF3E9A', rotate: -8,  delay: '0s',   shape: 'circle', label: '$' },
  { position: 'left-[2.4%] top-[42%]',  size: 42, bg: '#FFE600', rotate: 14,  delay: '2.2s', shape: 'pill',   label: 'WANT' },
  { position: 'left-[1.6%] top-[54%]',  size: 50, bg: '#FFE600', rotate: 12,  delay: '1.2s', shape: 'square' },
  { position: 'left-[3%] top-[66%]',    size: 36, bg: '#A78BFA', rotate: -10, delay: '0.8s', shape: 'circle' },
  { position: 'left-[1.2%] top-[78%]',  size: 46, bg: '#7FF3F0', rotate: -14, delay: '2.4s', shape: 'pill',   label: 'USDC' },
  { position: 'left-[2.4%] top-[90%]',  size: 38, bg: '#C6F23A', rotate: 10,  delay: '1.8s', shape: 'square', label: '★' },

  // Right gutter, top to bottom
  { position: 'right-[2.6%] top-[8%]',  size: 38, bg: '#A78BFA', rotate: -9,  delay: '1s',   shape: 'square', label: '★' },
  { position: 'right-[1.2%] top-[20%]', size: 52, bg: '#C6F23A', rotate: 10,  delay: '0.6s', shape: 'square', label: '★' },
  { position: 'right-[2.8%] top-[32%]', size: 40, bg: '#FF3E9A', rotate: 13,  delay: '2s',   shape: 'circle', label: '$' },
  { position: 'right-[1.6%] top-[44%]', size: 58, bg: '#A78BFA', rotate: -6,  delay: '1.8s', shape: 'circle' },
  { position: 'right-[2.4%] top-[56%]', size: 44, bg: '#FFE600', rotate: -11, delay: '0.4s', shape: 'pill',   label: 'WANT' },
  { position: 'right-[1.2%] top-[68%]', size: 46, bg: '#FF3E9A', rotate: 14,  delay: '3s',   shape: 'pill',   label: 'WANT' },
  { position: 'right-[2.8%] top-[80%]', size: 36, bg: '#7FF3F0', rotate: 8,   delay: '1.3s', shape: 'circle', label: '$' },
  { position: 'right-[1.4%] top-[92%]', size: 42, bg: '#C6F23A', rotate: -13, delay: '0.9s', shape: 'square' },
]

// Smaller stickers spread down both edges — these have NO breakpoint restriction, so
// this is the set that actually shows on medium-width screens (including a phone's
// "desktop site" view, which usually lands around 980–1024px, well under 2xl).
// Tucked right at the edge so they sit in the dotted background gutter, not on content.
const EDGE_DOODLES: Doodle[] = [
  { position: 'left-[-8px] top-[11%]',   size: 30, bg: '#FFE600', rotate: -10, delay: '0s',    shape: 'square', label: '★' },
  { position: 'right-[-8px] top-[17%]',  size: 32, bg: '#7FF3F0', rotate: 9,   delay: '0.8s',  shape: 'circle', label: '$' },
  { position: 'left-[-10px] top-[22%]',  size: 28, bg: '#C6F23A', rotate: 12,  delay: '1.6s',  shape: 'square' },
  { position: 'right-[-10px] top-[30%]', size: 34, bg: '#A78BFA', rotate: -8,  delay: '2.2s',  shape: 'circle' },
  { position: 'left-[-8px] top-[40%]',   size: 32, bg: '#FF3E9A', rotate: -10, delay: '0.4s',  shape: 'circle', label: '$' },
  { position: 'right-[-8px] top-[48%]',  size: 34, bg: '#FFE600', rotate: 8,   delay: '1.2s',  shape: 'square', label: '★' },
  { position: 'left-[-10px] top-[58%]',  size: 30, bg: '#7FF3F0', rotate: 11,  delay: '1.9s',  shape: 'circle' },
  { position: 'right-[-10px] top-[66%]', size: 28, bg: '#C6F23A', rotate: -9,  delay: '0.6s',  shape: 'square', label: '★' },
  { position: 'left-[-8px] top-[76%]',   size: 34, bg: '#A78BFA', rotate: 10,  delay: '2.4s',  shape: 'circle', label: '$' },
  { position: 'right-[-8px] top-[84%]',  size: 30, bg: '#FF3E9A', rotate: -12, delay: '1s',    shape: 'square' },
  { position: 'left-[-10px] bottom-[6%]',  size: 32, bg: '#FFE600', rotate: 9,   delay: '0.3s', shape: 'circle', label: '$' },
  { position: 'right-[-10px] bottom-[2%]', size: 34, bg: '#7FF3F0', rotate: -8,  delay: '1.5s', shape: 'square', label: '★' },
]

interface StripDoodle {
  leftPct: number
  size: number
  bg: string
  rotate: number
  delay: string
  shape: 'circle' | 'square' | 'pill'
  label?: string
}

// A handful of stickers scattered across the gap between two page sections.
// These scroll WITH the page (not fixed), so they only show in the real empty
// band between cards — never behind a card's own solid background.
const STRIP_ITEMS: StripDoodle[] = [
  { leftPct: 8,  size: 28, bg: '#FFE600', rotate: -9,  delay: '0s',   shape: 'square', label: '★' },
  { leftPct: 28, size: 24, bg: '#7FF3F0', rotate: 11,  delay: '0.7s', shape: 'circle', label: '$' },
  { leftPct: 50, size: 22, bg: '#FF3E9A', rotate: -12, delay: '1.4s', shape: 'circle' },
  { leftPct: 72, size: 26, bg: '#C6F23A', rotate: 8,   delay: '0.4s', shape: 'square' },
  { leftPct: 92, size: 30, bg: '#A78BFA', rotate: -8,  delay: '2s',   shape: 'circle', label: '$' },
]

export function DoodleStrip() {
  return (
    <div aria-hidden="true" className="hidden desk:block relative h-0 pointer-events-none">
      {STRIP_ITEMS.map((d, i) => {
        const width = d.shape === 'pill' ? Math.round(d.size * 1.6) : d.size
        const height = d.shape === 'pill' ? Math.round(d.size * 0.55) : d.size
        const borderRadius = d.shape === 'circle' ? '50%' : d.shape === 'pill' ? '999px' : '12px'
        return (
          // Outer div: static positioning only (centers the sticker on its left%).
          // Inner div: the animated one — keeping these separate means the floaty
          // keyframes (which fully own `transform`) can't wipe out the centering offset.
          <div key={i} className="absolute" style={{ left: `${d.leftPct}%`, top: 0, transform: 'translate(-50%, -50%)' }}>
            <div
              className="animate-floaty flex items-center justify-center border-[3px] border-[#111] font-mono-bold text-[#111]"
              style={{
                width,
                height,
                backgroundColor: d.bg,
                borderRadius,
                boxShadow: '4px 4px 0 #111',
                fontSize: d.shape === 'pill' ? 10 : Math.round(d.size * 0.4),
                animationDelay: d.delay,
                '--r': `${d.rotate}deg`,
              } as React.CSSProperties}
            >
              {d.label}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function DoodleShape({ d }: { d: Doodle }) {
  const width = d.shape === 'pill' ? Math.round(d.size * 1.6) : d.size
  const height = d.shape === 'pill' ? Math.round(d.size * 0.55) : d.size
  const borderRadius = d.shape === 'circle' ? '50%' : d.shape === 'pill' ? '999px' : '12px'
  return (
    <div
      className={`absolute ${d.position} animate-floaty flex items-center justify-center border-[3px] border-[#111] font-mono-bold text-[#111]`}
      style={{
        width,
        height,
        backgroundColor: d.bg,
        borderRadius,
        boxShadow: '4px 4px 0 #111',
        fontSize: d.shape === 'pill' ? 11 : Math.round(d.size * 0.4),
        animationDelay: d.delay,
        '--r': `${d.rotate}deg`,
      } as React.CSSProperties}
    >
      {d.label}
    </div>
  )
}

export function Doodles() {
  return (
    <>
      {/* Side-margin stickers — wide screens only, where there's real empty space beside the content */}
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 hidden 2xl:block overflow-hidden">
        {MARGIN_DOODLES.map((d, i) => <DoodleShape key={`margin-${i}`} d={d} />)}
      </div>

      {/* Edge stickers — every screen size, phones and mid-width "desktop view" alike */}
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        {EDGE_DOODLES.map((d, i) => <DoodleShape key={`edge-${i}`} d={d} />)}
      </div>
    </>
  )
}
