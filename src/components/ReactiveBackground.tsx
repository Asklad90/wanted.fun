import React, { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

type GlyphType = 'dollar' | 'star' | 'bolt' | 'want' | 'usdc' | 'none'

interface Doodle {
  id: string
  position: string
  size: number
  bg: string
  rotate: number
  delay: number
  shape: 'circle' | 'square' | 'pill'
  glyph?: GlyphType
}

const MARGIN_DOODLES: Doodle[] = [
  // Left gutter
  { id: 'm-1', position: 'left-[1.2%] top-[7%]',   size: 46, bg: '#7FF3F0', rotate: 9,   delay: 0.2, shape: 'circle', glyph: 'dollar' },
  { id: 'm-2', position: 'left-[2.8%] top-[19%]',  size: 36, bg: '#FF3E9A', rotate: -12, delay: 1.4, shape: 'square', glyph: 'bolt' },
  { id: 'm-3', position: 'left-[1.2%] top-[31%]',  size: 56, bg: '#FFE600', rotate: -8,  delay: 0.0, shape: 'circle', glyph: 'star' },
  { id: 'm-4', position: 'left-[2.4%] top-[43%]',  size: 44, bg: '#FFE600', rotate: 14,  delay: 2.2, shape: 'pill',   glyph: 'want' },
  { id: 'm-5', position: 'left-[1.5%] top-[55%]',  size: 48, bg: '#C6F23A', rotate: 12,  delay: 1.2, shape: 'square', glyph: 'dollar' },
  { id: 'm-6', position: 'left-[3.0%] top-[67%]',  size: 38, bg: '#A78BFA', rotate: -10, delay: 0.8, shape: 'circle', glyph: 'star' },
  { id: 'm-7', position: 'left-[1.2%] top-[79%]',  size: 46, bg: '#7FF3F0', rotate: -14, delay: 2.4, shape: 'pill',   glyph: 'usdc' },
  { id: 'm-8', position: 'left-[2.4%] top-[90%]',  size: 40, bg: '#C6F23A', rotate: 10,  delay: 1.8, shape: 'square', glyph: 'star' },

  // Right gutter
  { id: 'm-9',  position: 'right-[2.6%] top-[8%]',  size: 40, bg: '#A78BFA', rotate: -9,  delay: 1.0, shape: 'square', glyph: 'star' },
  { id: 'm-10', position: 'right-[1.2%] top-[20%]', size: 52, bg: '#C6F23A', rotate: 10,  delay: 0.6, shape: 'square', glyph: 'bolt' },
  { id: 'm-11', position: 'right-[2.8%] top-[32%]', size: 42, bg: '#FF3E9A', rotate: 13,  delay: 2.0, shape: 'circle', glyph: 'dollar' },
  { id: 'm-12', position: 'right-[1.6%] top-[44%]', size: 56, bg: '#A78BFA', rotate: -6,  delay: 1.8, shape: 'circle', glyph: 'star' },
  { id: 'm-13', position: 'right-[2.4%] top-[56%]', size: 44, bg: '#FFE600', rotate: -11, delay: 0.4, shape: 'pill',   glyph: 'want' },
  { id: 'm-14', position: 'right-[1.2%] top-[68%]', size: 46, bg: '#FF3E9A', rotate: 14,  delay: 3.0, shape: 'pill',   glyph: 'usdc' },
  { id: 'm-15', position: 'right-[2.8%] top-[80%]', size: 38, bg: '#7FF3F0', rotate: 8,   delay: 1.3, shape: 'circle', glyph: 'dollar' },
  { id: 'm-16', position: 'right-[1.4%] top-[91%]', size: 42, bg: '#C6F23A', rotate: -13, delay: 0.9, shape: 'square', glyph: 'bolt' },
]

const EDGE_DOODLES: Doodle[] = [
  { id: 'e-1',  position: 'left-[-8px] top-[12%]',    size: 32, bg: '#FFE600', rotate: -10, delay: 0.0, shape: 'square', glyph: 'star' },
  { id: 'e-2',  position: 'right-[-8px] top-[18%]',   size: 34, bg: '#7FF3F0', rotate: 9,   delay: 0.8, shape: 'circle', glyph: 'dollar' },
  { id: 'e-3',  position: 'left-[-10px] top-[26%]',   size: 30, bg: '#C6F23A', rotate: 12,  delay: 1.6, shape: 'square', glyph: 'bolt' },
  { id: 'e-4',  position: 'right-[-10px] top-[34%]',  size: 34, bg: '#A78BFA', rotate: -8,  delay: 2.2, shape: 'circle', glyph: 'star' },
  { id: 'e-5',  position: 'left-[-8px] top-[44%]',    size: 32, bg: '#FF3E9A', rotate: -10, delay: 0.4, shape: 'circle', glyph: 'dollar' },
  { id: 'e-6',  position: 'right-[-8px] top-[52%]',   size: 34, bg: '#FFE600', rotate: 8,   delay: 1.2, shape: 'square', glyph: 'star' },
  { id: 'e-7',  position: 'left-[-10px] top-[62%]',   size: 30, bg: '#7FF3F0', rotate: 11,  delay: 1.9, shape: 'circle', glyph: 'bolt' },
  { id: 'e-8',  position: 'right-[-10px] top-[70%]',  size: 30, bg: '#C6F23A', rotate: -9,  delay: 0.6, shape: 'square', glyph: 'star' },
  { id: 'e-9',  position: 'left-[-8px] top-[80%]',    size: 34, bg: '#A78BFA', rotate: 10,  delay: 2.4, shape: 'circle', glyph: 'dollar' },
  { id: 'e-10', position: 'right-[-8px] top-[86%]',   size: 32, bg: '#FF3E9A', rotate: -12, delay: 1.0, shape: 'square', glyph: 'bolt' },
]

const MOBILE_DOODLES: Doodle[] = [
  { id: 'mb-1', position: 'left-[-8px] top-[16%]',    size: 26, bg: '#FFE600', rotate: -10, delay: 0.0, shape: 'square', glyph: 'star' },
  { id: 'mb-2', position: 'right-[-8px] top-[28%]',   size: 26, bg: '#7FF3F0', rotate: 9,   delay: 1.0, shape: 'circle', glyph: 'dollar' },
  { id: 'mb-3', position: 'left-[-8px] bottom-[22%]', size: 26, bg: '#FF3E9A', rotate: -9,  delay: 1.8, shape: 'circle', glyph: 'bolt' },
  { id: 'mb-4', position: 'right-[-8px] bottom-[10%]',size: 26, bg: '#C6F23A', rotate: 10,  delay: 0.6, shape: 'square', glyph: 'star' },
]

function DoodleGlyph({ glyph, size }: { glyph?: GlyphType; size: number }) {
  if (!glyph || glyph === 'none') return null
  if (glyph === 'want') {
    return <span className="font-mono-bold text-[10px] tracking-wider uppercase text-[#111]">WANT</span>
  }
  if (glyph === 'usdc') {
    return <span className="font-mono-bold text-[10px] tracking-wider uppercase text-[#111]">USDC</span>
  }
  if (glyph === 'dollar') {
    return <span className="font-heading font-black text-[#111]" style={{ fontSize: Math.round(size * 0.44) }}>$</span>
  }
  if (glyph === 'bolt') {
    const s = Math.max(12, Math.round(size * 0.42))
    return (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="#111" aria-hidden="true">
        <path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z" stroke="#111" strokeWidth="1.5" strokeLinejoin="round" />
      </svg>
    )
  }
  // Vector 4-point Neo-Brutalist star
  const s = Math.max(12, Math.round(size * 0.44))
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="#111" aria-hidden="true">
      <path d="M12 2L14.8 9.2L22 12L14.8 14.8L12 22L9.2 14.8L2 12L9.2 9.2L12 2Z" stroke="#111" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  )
}

interface ClickRipple {
  id: number
  x: number
  y: number
}

function InteractiveDoodle({
  d,
  registerNode,
}: {
  d: Doodle
  registerNode: (id: string, el: HTMLButtonElement | null, baseRotate: number) => void
}) {
  const [spinning, setSpinning] = useState(false)
  const width = d.shape === 'pill' ? Math.round(d.size * 1.65) : d.size
  const height = d.shape === 'pill' ? Math.round(d.size * 0.58) : d.size
  const borderRadius = d.shape === 'circle' ? '9999px' : d.shape === 'pill' ? '9999px' : '11px'

  const handleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    setSpinning(true)
    window.setTimeout(() => setSpinning(false), 620)
  }, [])

  return (
    <button
      ref={el => registerNode(d.id, el, d.rotate)}
      type="button"
      onClick={handleClick}
      tabIndex={-1}
      aria-hidden="true"
      className={`absolute ${d.position} pointer-events-auto select-none cursor-pointer flex items-center justify-center border-[3px] border-[#111] text-[#111] transition-shadow duration-150 hover:shadow-[6px_6px_0_#111] active:shadow-[1px_1px_0_#111]`}
      style={{
        width,
        height,
        backgroundColor: d.bg,
        borderRadius,
        boxShadow: 'inset 0 2px 0 rgba(255,255,255,0.55), 4px 4px 0 #111',
        transform: `rotate(${d.rotate}deg)`,
        willChange: 'transform',
      }}
    >
      <span
        className="flex items-center justify-center w-full h-full transition-transform duration-500"
        style={{
          transform: spinning ? 'rotate(360deg) scale(1.22)' : 'none',
        }}
      >
        <DoodleGlyph glyph={d.glyph} size={d.size} />
      </span>
    </button>
  )
}

export function ReactiveBackground() {
  const [ripples, setRipples] = useState<ClickRipple[]>([])
  const auraPrimaryRef = useRef<HTMLDivElement>(null)
  const auraSecondaryRef = useRef<HTMLDivElement>(null)
  const dotHighlightRef = useRef<HTMLDivElement>(null)

  const nodesRef = useRef<Map<string, { el: HTMLButtonElement; baseRotate: number; delay: number }>>(new Map())

  const registerNode = useCallback((id: string, el: HTMLButtonElement | null, baseRotate: number) => {
    if (el) {
      const found = [...MARGIN_DOODLES, ...EDGE_DOODLES, ...MOBILE_DOODLES].find(item => item.id === id)
      nodesRef.current.set(id, { el, baseRotate, delay: found?.delay ?? 0 })
    } else {
      nodesRef.current.delete(id)
    }
  }, [])

  useEffect(() => {
    const prefersReducedMotion =
      typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

    if (prefersReducedMotion) return

    const target = { x: window.innerWidth * 0.5, y: window.innerHeight * 0.35 }
    const current = { x: target.x, y: target.y }
    let lastPointerTime = 0
    let rafId: number | null = null

    const onPointerMove = (e: PointerEvent) => {
      target.x = e.clientX
      target.y = e.clientY
      lastPointerTime = performance.now()
    }

    const onClick = (e: MouseEvent) => {
      // Only spawn background ripple if not clicking inside an input/textarea
      const tag = (e.target as HTMLElement | null)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      const id = Date.now() + Math.random()
      setRipples(prev => [...prev.slice(-3), { id, x: e.clientX, y: e.clientY }])
      window.setTimeout(() => {
        setRipples(prev => prev.filter(r => r.id !== id))
      }, 650)
    }

    window.addEventListener('pointermove', onPointerMove, { passive: true })
    window.addEventListener('click', onClick, { passive: true })

    const tick = (now: number) => {
      const isIdle = now - lastPointerTime > 2400
      if (isIdle) {
        const t = now * 0.00045
        const vw = window.innerWidth
        const vh = window.innerHeight
        target.x = vw * 0.5 + Math.cos(t) * (vw * 0.28)
        target.y = vh * 0.42 + Math.sin(t * 1.4) * (vh * 0.2)
      }

      // Smooth lerp (zero React re-renders!)
      current.x += (target.x - current.x) * 0.085
      current.y += (target.y - current.y) * 0.085

      if (auraPrimaryRef.current) {
        auraPrimaryRef.current.style.transform = `translate3d(${current.x - 320}px, ${current.y - 320}px, 0)`
      }
      if (auraSecondaryRef.current) {
        auraSecondaryRef.current.style.transform = `translate3d(${current.x - 190}px, ${current.y - 190}px, 0)`
      }
      if (dotHighlightRef.current) {
        dotHighlightRef.current.style.maskImage = `radial-gradient(280px circle at ${current.x}px ${current.y}px, #000 0%, transparent 100%)`
        dotHighlightRef.current.style.webkitMaskImage = `radial-gradient(280px circle at ${current.x}px ${current.y}px, #000 0%, transparent 100%)`
      }

      // Update floating + magnetic proximity on visible sticker nodes directly
      const floatSec = now * 0.001
      nodesRef.current.forEach(({ el, baseRotate, delay }) => {
        const rect = el.getBoundingClientRect()
        if (rect.width === 0 && rect.height === 0) return // hidden by breakpoint

        const floatY = Math.sin(floatSec * 1.3 + delay) * -7
        const cx = rect.left + rect.width * 0.5
        const cy = rect.top + rect.height * 0.5
        const dx = current.x - cx
        const dy = current.y - cy
        const distSq = dx * dx + dy * dy
        const radius = 150

        let repelX = 0
        let repelY = 0
        let extraRot = 0
        if (distSq < radius * radius && distSq > 1) {
          const dist = Math.sqrt(distSq)
          const force = (1 - dist / radius) * 14
          repelX = -(dx / dist) * force
          repelY = -(dy / dist) * force
          extraRot = (repelX * 0.6)
        }

        el.style.transform = `translate3d(${repelX.toFixed(1)}px, ${(floatY + repelY).toFixed(1)}px, 0) rotate(${(baseRotate + extraRot).toFixed(1)}deg)`
      })

      rafId = requestAnimationFrame(tick)
    }

    rafId = requestAnimationFrame(tick)

    return () => {
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('click', onClick)
      if (rafId !== null) cancelAnimationFrame(rafId)
    }
  }, [])

  return (
    <>
      {/* ── Ambient Top Wash & Cursor-Reactive Grid Illumination ── */}
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        {/* Top subtle warm-cyan architectural wash */}
        <div
          className="absolute inset-x-0 top-0 h-[420px] opacity-60"
          style={{
            background:
              'radial-gradient(ellipse 80% 50% at 50% -10%, rgba(127, 243, 240, 0.22), rgba(255, 230, 0, 0.08) 55%, transparent 100%)',
          }}
        />

        {/* Primary soft Neo-Brutalist spotlight following cursor */}
        <div
          ref={auraPrimaryRef}
          className="absolute top-0 left-0 w-[640px] h-[640px] rounded-full pointer-events-none will-change-transform"
          style={{
            background:
              'radial-gradient(circle, rgba(127, 243, 240, 0.22) 0%, rgba(255, 230, 0, 0.12) 38%, rgba(167, 139, 250, 0.06) 65%, transparent 78%)',
          }}
        />

        {/* Secondary inner warm core */}
        <div
          ref={auraSecondaryRef}
          className="absolute top-0 left-0 w-[380px] h-[380px] rounded-full pointer-events-none will-change-transform"
          style={{
            background:
              'radial-gradient(circle, rgba(255, 62, 154, 0.09) 0%, rgba(255, 230, 0, 0.08) 50%, transparent 75%)',
          }}
        />

        {/* Cursor-revealed high-contrast accented dot matrix */}
        <div
          ref={dotHighlightRef}
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: 'radial-gradient(#FF3E9A 2.5px, transparent 2.5px)',
            backgroundSize: '28px 28px',
            opacity: 0.35,
          }}
        />
      </div>

      {/* ── Tactile Click Ripples ── */}
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-40 overflow-hidden">
        <AnimatePresence>
          {ripples.map(r => (
            <motion.div
              key={r.id}
              initial={{ width: 8, height: 8, opacity: 0.85 }}
              animate={{ width: 110, height: 110, opacity: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
              className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full border-[2.5px] border-[#111] pointer-events-none"
              style={{
                left: `${r.x}px`,
                top: `${r.y}px`,
                boxShadow: '0 0 0 3px rgba(255, 230, 0, 0.55)',
              }}
            />
          ))}
        </AnimatePresence>
      </div>

      {/* ── Wide Desktop Gutter Stickers (1536px+) ── */}
      <div aria-hidden="true" className="fixed inset-0 -z-10 hidden 2xl:block overflow-hidden pointer-events-none">
        {MARGIN_DOODLES.map(d => (
          <InteractiveDoodle key={d.id} d={d} registerNode={registerNode} />
        ))}
      </div>

      {/* ── Desktop Edge Stickers (900px+) ── */}
      <div aria-hidden="true" className="fixed inset-0 -z-10 hidden desk:block overflow-hidden pointer-events-none">
        {EDGE_DOODLES.map(d => (
          <InteractiveDoodle key={d.id} d={d} registerNode={registerNode} />
        ))}
      </div>

      {/* ── Mobile Edge Stickers (<900px) ── */}
      <div aria-hidden="true" className="fixed inset-0 -z-10 block desk:hidden overflow-hidden pointer-events-none">
        {MOBILE_DOODLES.map(d => (
          <InteractiveDoodle key={d.id} d={d} registerNode={registerNode} />
        ))}
      </div>
    </>
  )
}
