import React, { useEffect, useState, useRef } from 'react'

interface AnimatedCounterProps {
  value: number | string
  prefix?: string
  suffix?: string
  decimals?: number
  className?: string
  duration?: number
}

// Ease out expo for snappier, arcade-like count up
function easeOutExpo(x: number): number {
  return x === 1 ? 1 : 1 - Math.pow(2, -10 * x)
}

export function AnimatedCounter({
  value,
  prefix = '',
  suffix = '',
  decimals = 0,
  className = '',
  duration = 1000,
}: AnimatedCounterProps) {
  // Extract number from string if needed (e.g. "$1,420.50" -> 1420.50)
  const numericTarget = typeof value === 'number'
    ? value
    : parseFloat(String(value).replace(/[^0-9.-]+/g, '')) || 0

  const [displayValue, setDisplayValue] = useState<number>(numericTarget)
  const prevTargetRef = useRef<number>(numericTarget)
  const startTimeRef = useRef<number | null>(null)
  const frameRef = useRef<number | null>(null)

  useEffect(() => {
    // Respect reduced motion
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setDisplayValue(numericTarget)
      prevTargetRef.current = numericTarget
      return
    }

    const startVal = prevTargetRef.current
    const endVal = numericTarget
    if (startVal === endVal) {
      setDisplayValue(endVal)
      return
    }

    startTimeRef.current = null

    const step = (timestamp: number) => {
      if (!startTimeRef.current) startTimeRef.current = timestamp
      const elapsed = timestamp - startTimeRef.current
      const progress = Math.min(elapsed / duration, 1)
      const easedProgress = easeOutExpo(progress)

      const current = startVal + (endVal - startVal) * easedProgress
      setDisplayValue(current)

      if (progress < 1) {
        frameRef.current = requestAnimationFrame(step)
      } else {
        setDisplayValue(endVal)
        prevTargetRef.current = endVal
      }
    }

    frameRef.current = requestAnimationFrame(step)

    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current)
    }
  }, [numericTarget, duration])

  const formattedNumber = displayValue.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })

  return (
    <span className={className}>
      {prefix}{formattedNumber}{suffix}
    </span>
  )
}
