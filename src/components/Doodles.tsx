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

// Wide-margin stickers — only fit once the page has real empty gutters beside the content.
const MARGIN_DOODLES: Doodle[] = [
  { position: 'left-[1.2%] top-[14%]',  size: 58, bg: '#FF3E9A', rotate: -8,  delay: '0s',   shape: 'circle', label: '$' },
  { position: 'left-[1.6%] top-[46%]',  size: 50, bg: '#FFE600', rotate: 12,  delay: '1.2s', shape: 'square' },
  { position: 'left-[1.2%] top-[76%]',  size: 46, bg: '#7FF3F0', rotate: -14, delay: '2.4s', shape: 'pill',   label: 'USDC' },
  { position: 'right-[1.2%] top-[22%]', size: 52, bg: '#C6F23A', rotate: 10,  delay: '0.6s', shape: 'square', label: '★' },
  { position: 'right-[1.6%] top-[54%]', size: 58, bg: '#A78BFA', rotate: -6,  delay: '1.8s', shape: 'circle' },
  { position: 'right-[1.2%] top-[82%]', size: 46, bg: '#FF3E9A', rotate: 14,  delay: '3s',   shape: 'pill',   label: 'WANT' },
]

// A couple of small corner stickers that work at any viewport width, mobile included —
// kept to just two so they stay a light touch rather than clutter.
const CORNER_DOODLES: Doodle[] = [
  { position: 'left-[-10px] bottom-[18%] sm:bottom-[14%]',  size: 34, bg: '#FFE600', rotate: -10, delay: '0.4s', shape: 'square', label: '★' },
  { position: 'right-[-10px] bottom-[10%] sm:bottom-[8%]',  size: 38, bg: '#7FF3F0', rotate: 8,   delay: '1.6s', shape: 'circle', label: '$' },
]

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

      {/* A light touch of the same stickers, tucked in the corners — every screen size, phones included */}
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        {CORNER_DOODLES.map((d, i) => <DoodleShape key={`corner-${i}`} d={d} />)}
      </div>
    </>
  )
}
