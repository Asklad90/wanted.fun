/**
 * Shared in-memory rate limiter for Vercel serverless functions.
 *
 * Each Vercel function instance has its own process-local map.
 * This is intentionally a soft / spam-deterrent limit — for a hard cap
 * you would use an external store (Redis/Upstash). For a hackathon
 * bounty board this is sufficient.
 *
 * Usage:
 *   const limiter = createRateLimiter({ windowMs: 10 * 60 * 1000, max: 5 })
 *   if (limiter.isLimited(ip)) return res.status(429).json(...)
 */

export interface RateLimiterOptions {
  /** Rolling window length in milliseconds. */
  windowMs: number
  /** Max allowed hits per window per key. */
  max: number
}

interface Bucket {
  count: number
  resetAt: number
}

export interface RateLimiter {
  isLimited(key: string): boolean
  remaining(key: string): number
}

export function createRateLimiter(opts: RateLimiterOptions): RateLimiter {
  const { windowMs, max } = opts
  const buckets = new Map<string, Bucket>()

  function getOrCreate(key: string): Bucket {
    const now = Date.now()
    const existing = buckets.get(key)
    if (!existing || now > existing.resetAt) {
      const bucket: Bucket = { count: 0, resetAt: now + windowMs }
      buckets.set(key, bucket)
      return bucket
    }
    return existing
  }

  return {
    isLimited(key: string): boolean {
      const bucket = getOrCreate(key)
      bucket.count++
      return bucket.count > max
    },
    remaining(key: string): number {
      const now = Date.now()
      const existing = buckets.get(key)
      if (!existing || now > existing.resetAt) return max
      return Math.max(0, max - existing.count)
    },
  }
}

/** Extract the real client IP from a Vercel request. */
export function getClientIp(headers: Record<string, string | string[] | undefined>): string {
  const xff = headers['x-forwarded-for']
  if (Array.isArray(xff)) return xff[0].split(',')[0].trim()
  if (typeof xff === 'string') return xff.split(',')[0].trim()
  return 'unknown'
}
