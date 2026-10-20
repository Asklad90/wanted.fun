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

// Decorative stickers that live in the empty side margins on very wide screens.
const DOODLES: Doodle[] = [
  { position: 'left-[1.2%] top-[14%]',  size: 58, bg: '#FF3E9A', rotate: -8,  delay: '0s',   shape: 'circle', label: '$' },
  { position: 'left-[1.6%] top-[46%]',  size: 50, bg: '#FFE600', rotate: 12,  delay: '1.2s', shape: 'square' },
  { position: 'left-[1.2%] top-[76%]',  size: 46, bg: '#7FF3F0', rotate: -14, delay: '2.4s', shape: 'pill',   label: 'USDC' },
  { position: 'right-[1.2%] top-[22%]', size: 52, bg: '#C6F23A', rotate: 10,  delay: '0.6s', shape: 'square', label: '★' },
  { position: 'right-[1.6%] top-[54%]', size: 58, bg: '#A78BFA', rotate: -6,  delay: '1.8s', shape: 'circle' },
  { position: 'right-[1.2%] top-[82%]', size: 46, bg: '#FF3E9A', rotate: 14,  delay: '3s',   shape: 'pill',   label: 'WANT' },
]

export function Doodles() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 -z-10 hidden 2xl:block overflow-hidden"
    >
      {DOODLES.map((d, i) => {
        const width = d.shape === 'pill' ? Math.round(d.size * 1.6) : d.size
        const height = d.shape === 'pill' ? Math.round(d.size * 0.55) : d.size
        const borderRadius = d.shape === 'circle' ? '50%' : d.shape === 'pill' ? '999px' : '12px'
        return (
          <div
            key={i}
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
      })}
    </div>
  )
}
