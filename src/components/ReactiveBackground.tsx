import React, { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

interface Doodle {
  id: string
  position: string
  size: number
  bg: string
  rotate: number
  delay: string
  shape: 'circle' | 'square' | 'pill'
  label?: string
}

const MARGIN_DOODLES: Doodle[] = [
  { id: 'm-1', position: 'left-[1.2%] top-[6%]',   size: 44, bg: '#7FF3F0', rotate: 9,   delay: '0.2s', shape: 'circle', label: '$' },
  { id: 'm-2', position: 'left-[2.8%] top-[18%]',  size: 34, bg: '#FF3E9A', rotate: -12, delay: '1.4s', shape: 'square' },
  { id: 'm-3', position: 'left-[1.2%] top-[30%]',  size: 58, bg: '#FF3E9A', rotate: -8,  delay: '0s',   shape: 'circle', label: '$' },
  { id: 'm-4', position: 'left-[2.4%] top-[42%]',  size: 42, bg: '#FFE600', rotate: 14,  delay: '2.2s', shape: 'pill',   label: 'WANT' },
  { id: 'm-5', position: 'left-[1.6%] top-[54%]',  size: 50, bg: '#FFE600', rotate: 12,  delay: '1.2s', shape: 'square' },
  { id: 'm-6', position: 'left-[3%] top-[66%]',    size: 36, bg: '#A78BFA', rotate: -10, delay: '0.8s', shape: 'circle' },
  { id: 'm-7', position: 'left-[1.2%] top-[78%]',  size: 46, bg: '#7FF3F0', rotate: -14, delay: '2.4s', shape: 'pill',   label: 'USDC' },
  { id: 'm-8', position: 'left-[2.4%] top-[90%]',  size: 38, bg: '#C6F23A', rotate: 10,  delay: '1.8s', shape: 'square', label: '★' },

  { id: 'm-9',  position: 'right-[2.6%] top-[8%]',  size: 38, bg: '#A78BFA', rotate: -9,  delay: '1s',   shape: 'square', label: '★' },
  { id: 'm-10', position: 'right-[1.2%] top-[20%]', size: 52, bg: '#C6F23A', rotate: 10,  delay: '0.6s', shape: 'square', label: '★' },
  { id: 'm-11', position: 'right-[2.8%] top-[32%]', size: 40, bg: '#FF3E9A', rotate: 13,  delay: '2s',   shape: 'circle', label: '$' },
  { id: 'm-12', position: 'right-[1.6%] top-[44%]', size: 58, bg: '#A78BFA', rotate: -6,  delay: '1.8s', shape: 'circle' },
  { id: 'm-13', position: 'right-[2.4%] top-[56%]', size: 44, bg: '#FFE600', rotate: -11, delay: '0.4s', shape: 'pill',   label: 'WANT' },
  { id: 'm-14', position: 'right-[1.2%] top-[68%]', size: 46, bg: '#FF3E9A', rotate: 14,  delay: '3s',   shape: 'pill',   label: 'WANT' },
  { id: 'm-15', position: 'right-[2.8%] top-[80%]', size: 36, bg: '#7FF3F0', rotate: 8,   delay: '1.3s', shape: 'circle', label: '$' },
  { id: 'm-16', position: 'right-[1.4%] top-[92%]', size: 42, bg: '#C6F23A', rotate: -13, delay: '0.9s', shape: 'square' },
]

const EDGE_DOODLES: Doodle[] = [
  { id: 'e-1',  position: 'left-[-8px] top-[11%]',    size: 30, bg: '#FFE600', rotate: -10, delay: '0s',    shape: 'square', label: '★' },
  { id: 'e-2',  position: 'right-[-8px] top-[17%]',   size: 32, bg: '#7FF3F0', rotate: 9,   delay: '0.8s',  shape: 'circle', label: '$' },
  { id: 'e-3',  position: 'left-[-10px] top-[22%]',   size: 28, bg: '#C6F23A', rotate: 12,  delay: '1.6s',  shape: 'square' },
  { id: 'e-4',  position: 'right-[-10px] top-[30%]',  size: 34, bg: '#A78BFA', rotate: -8,  delay: '2.2s',  shape: 'circle' },
  { id: 'e-5',  position: 'left-[-8px] top-[40%]',    size: 32, bg: '#FF3E9A', rotate: -10, delay: '0.4s',  shape: 'circle', label: '$' },
  { id: 'e-6',  position: 'right-[-8px] top-[48%]',   size: 34, bg: '#FFE600', rotate: 8,   delay: '1.2s',  shape: 'square', label: '★' },
  { id: 'e-7',  position: 'left-[-10px] top-[58%]',   size: 30, bg: '#7FF3F0', rotate: 11,  delay: '1.9s',  shape: 'circle' },
  { id: 'e-8',  position: 'right-[-10px] top-[66%]',  size: 28, bg: '#C6F23A', rotate: -9,  delay: '0.6s',  shape: 'square', label: '★' },
  { id: 'e-9',  position: 'left-[-8px] top-[76%]',    size: 34, bg: '#A78BFA', rotate: 10,  delay: '2.4s',  shape: 'circle', label: '$' },
  { id: 'e-10', position: 'right-[-8px] top-[84%]',   size: 30, bg: '#FF3E9A', rotate: -12, delay: '1s',    shape: 'square' },
  { id: 'e-11', position: 'left-[-10px] bottom-[6%]', size: 32, bg: '#FFE600', rotate: 9,   delay: '0.3s',  shape: 'circle', label: '$' },
  { id: 'e-12', position: 'right-[-10px] bottom-[2%]',size: 34, bg: '#7FF3F0', rotate: -8,  delay: '1.5s',  shape: 'square', label: '★' },
]

const MOBILE_DOODLES: Doodle[] = [
  { id: 'mb-1', position: 'left-[-8px] top-[15%]',    size: 26, bg: '#FFE600', rotate: -10, delay: '0s',   shape: 'square', label: '★' },
  { id: 'mb-2', position: 'right-[-8px] top-[26%]',   size: 24, bg: '#7FF3F0', rotate: 9,   delay: '1s',   shape: 'circle', label: '$' },
  { id: 'mb-3', position: 'left-[-8px] bottom-[20%]', size: 24, bg: '#FF3E9A', rotate: -9,  delay: '1.8s', shape: 'circle', label: '$' },
  { id: 'mb-4', position: 'right-[-8px] bottom-[8%]', size: 26, bg: '#C6F23A', rotate: 10,  delay: '0.6s', shape: 'square', label: '★' },
]

interface ClickRipple {
  id: number
  x: number
  y: number
}

function InteractiveDoodleShape({ d, mousePos }: { d: Doodle; mousePos: { x: number; y: number } }) {
  const [clicked, setClicked] = useState(false)
  const elRef = useRef<HTMLButtonElement>(null)
  const [offset, setOffset] = useState({ x: 0, y: 0 })

  const width = d.shape === 'pill' ? Math.round(d.size * 1.6) : d.size
  const height = d.shape === 'pill' ? Math.round(d.size * 0.55) : d.size
  const borderRadius = d.shape === 'circle' ? '50%' : d.shape === 'pill' ? '999px' : '12px'

  // Magnetic avoidance / proximity reaction
  useEffect(() => {
    if (!elRef.current) return
    const rect = elRef.current.getBoundingClientRect()
    const centerX = rect.left + rect.width / 2
    const centerY = rect.top + rect.height / 2
    const dx = mousePos.x - centerX
    const dy = mousePos.y - centerY
    const dist = Math.sqrt(dx * dx + dy * dy)

    const threshold = 130
    if (dist < threshold && dist > 0) {
      // Repel slightly away from cursor (max 10px)
      const force = (1 - dist / threshold) * 10
      setOffset({
        x: -(dx / dist) * force,
        y: -(dy / dist) * force,
      })
    } else {
      setOffset({ x: 0, y: 0 })
    }
  }, [mousePos])

  const handleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    setClicked(true)
    setTimeout(() => setClicked(false), 700)
  }, [])

  return (
    <motion.button
      ref={elRef}
      type="button"
      onClick={handleClick}
      aria-label={`Sticker ${d.label || d.shape}`}
      className={`absolute ${d.position} pointer-events-auto select-none cursor-pointer flex items-center justify-center border-[3px] border-[#111] font-mono-bold text-[#111] z-10`}
      style={{
        width,
        height,
        backgroundColor: d.bg,
        borderRadius,
        boxShadow: '4px 4px 0 #111',
        fontSize: d.shape === 'pill' ? 11 : Math.round(d.size * 0.4),
      }}
      animate={{
        x: offset.x,
        y: offset.y,
        rotate: clicked ? [d.rotate, d.rotate + 180, d.rotate + 360] : d.rotate,
        scale: clicked ? [1, 1.3, 0.88, 1.1, 1] : 1,
      }}
      whileHover={{
        scale: 1.15,
        boxShadow: '6px 6px 0 #111',
        transition: { type: 'spring', stiffness: 400, damping: 15 },
      }}
      whileTap={{
        scale: 0.85,
        boxShadow: '1px 1px 0 #111',
      }}
      transition={{
        type: 'spring',
        stiffness: 300,
        damping: 20,
      }}
    >
      {d.label}
    </motion.button>
  )
}

export function ReactiveBackground() {
  const [ripples, setRipples] = useState<ClickRipple[]>([])
  const [mousePos, setMousePos] = useState({ x: -1000, y: -1000 })
  const [smoothPos, setSmoothPos] = useState({ x: -1000, y: -1000 })
  const targetPosRef = useRef({ x: -1000, y: -1000 })
  const lastMoveTimeRef = useRef<number>(Date.now())
  const rafRef = useRef<number | null>(null)

  // Track pointer movements
  useEffect(() => {
    const handlePointerMove = (e: PointerEvent) => {
      targetPosRef.current = { x: e.clientX, y: e.clientY }
      lastMoveTimeRef.current = Date.now()
    }

    const handleClick = (e: MouseEvent) => {
      const id = Date.now() + Math.random()
      setRipples(prev => [...prev.slice(-3), { id, x: e.clientX, y: e.clientY }])
      setTimeout(() => {
        setRipples(prev => prev.filter(r => r.id !== id))
      }, 750)
    }

    window.addEventListener('pointermove', handlePointerMove, { passive: true })
    window.addEventListener('click', handleClick, { passive: true })

    // Smooth RAF loop for continuous smooth aura tracking & ambient drift
    let angle = 0
    const loop = () => {
      const now = Date.now()
      const isIdle = now - lastMoveTimeRef.current > 2000

      if (isIdle) {
        // Subtle ambient drifting figure-eight when idle or on mobile
        angle += 0.012
        const viewportW = typeof window !== 'undefined' ? window.innerWidth : 1200
        const viewportH = typeof window !== 'undefined' ? window.innerHeight : 800
        const ambientX = viewportW / 2 + Math.cos(angle) * (viewportW * 0.32)
        const ambientY = viewportH / 2 + Math.sin(angle * 1.5) * (viewportH * 0.22)
        targetPosRef.current = { x: ambientX, y: ambientY }
      }

      setSmoothPos(prev => {
        const dx = targetPosRef.current.x - prev.x
        const dy = targetPosRef.current.y - prev.y
        const nextX = prev.x === -1000 ? targetPosRef.current.x : prev.x + dx * 0.08
        const nextY = prev.y === -1000 ? targetPosRef.current.y : prev.y + dy * 0.08
        return { x: nextX, y: nextY }
      })

      rafRef.current = requestAnimationFrame(loop)
    }

    rafRef.current = requestAnimationFrame(loop)

    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('click', handleClick)
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [])

  // Periodically throttle mousePos updates to doodle buttons for performance
  useEffect(() => {
    setMousePos(smoothPos)
  }, [smoothPos])

  return (
    <>
      {/* ── Reactive Cursor Spotlight Aura (sits above cream paper, behind content) ── */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
      >
        {/* Soft interactive radial bloom tracking cursor */}
        <div
          className="absolute w-[600px] h-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full transition-opacity duration-300 pointer-events-none"
          style={{
            left: `${smoothPos.x}px`,
            top: `${smoothPos.y}px`,
            background: 'radial-gradient(circle, rgba(127, 243, 240, 0.16) 0%, rgba(255, 230, 0, 0.08) 40%, rgba(255, 62, 154, 0.04) 65%, transparent 75%)',
            mixBlendMode: 'multiply',
          }}
        />

        {/* Crisp reactive dot grid highlight ring */}
        <div
          className="absolute w-[340px] h-[340px] -translate-x-1/2 -translate-y-1/2 rounded-full pointer-events-none opacity-40"
          style={{
            left: `${smoothPos.x}px`,
            top: `${smoothPos.y}px`,
            background: 'radial-gradient(circle, rgba(167, 139, 250, 0.25) 0%, transparent 70%)',
          }}
        />
      </div>

      {/* ── Interactive Click / Tap Shockwave Ripples ── */}
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-30 overflow-hidden">
        <AnimatePresence>
          {ripples.map(r => (
            <motion.div
              key={r.id}
              initial={{ width: 0, height: 0, opacity: 0.9, scale: 0 }}
              animate={{ width: 140, height: 140, opacity: 0, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.65, ease: 'easeOut' }}
              className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-[#FFE600] pointer-events-none"
              style={{
                left: `${r.x}px`,
                top: `${r.y}px`,
                boxShadow: '0 0 12px 2px rgba(255, 230, 0, 0.6), inset 0 0 8px rgba(127, 243, 240, 0.4)',
              }}
            />
          ))}
        </AnimatePresence>
      </div>

      {/* ── Interactive Stickers & Doodles (Desktop Gutters 1536px+) ── */}
      <div aria-hidden="true" className="fixed inset-0 -z-10 hidden 2xl:block overflow-hidden pointer-events-none">
        {MARGIN_DOODLES.map(d => (
          <InteractiveDoodleShape key={d.id} d={d} mousePos={mousePos} />
        ))}
      </div>

      {/* ── Interactive Stickers & Doodles (Desktop Edges 900px+) ── */}
      <div aria-hidden="true" className="fixed inset-0 -z-10 hidden desk:block overflow-hidden pointer-events-none">
        {EDGE_DOODLES.map(d => (
          <InteractiveDoodleShape key={d.id} d={d} mousePos={mousePos} />
        ))}
      </div>

      {/* ── Interactive Stickers & Doodles (Mobile < 900px) ── */}
      <div aria-hidden="true" className="fixed inset-0 -z-10 block desk:hidden overflow-hidden pointer-events-none">
        {MOBILE_DOODLES.map(d => (
          <InteractiveDoodleShape key={d.id} d={d} mousePos={mousePos} />
        ))}
      </div>
    </>
  )
}
