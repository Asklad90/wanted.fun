import type { VercelRequest, VercelResponse } from '@vercel/node'
import { ensureSchema } from '../../_db.js'
import { ensurePoster } from '../../_poster.js'
import { createRateLimiter, getClientIp } from '../../_rate-limit.js'

// 20 register calls per IP per 10-minute window (idempotent, but cap spam)
const limiter = createRateLimiter({ windowMs: 10 * 60 * 1000, max: 20 })

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const ip = getClientIp(req.headers as Record<string, string | string[] | undefined>)
  if (limiter.isLimited(ip)) return res.status(429).json({ error: 'Too many requests' })

  try {
    const bountyId = req.query.id as string
    if (!bountyId || typeof bountyId !== 'string' || bountyId.length > 200)
      return res.status(400).json({ error: 'Missing or invalid bounty id' })

    await ensureSchema()

    // The contract is the source of truth for the poster — the client's claim is ignored.
    await ensurePoster(bountyId)

    return res.status(200).json({ ok: true })
  } catch (e) {
    console.error('register handler error:', e)
    return res.status(500).json({ error: 'Server error' })
  }
}
