import type { VercelRequest, VercelResponse } from '@vercel/node'
import { pool, ensureSchema } from '../../_db.js'
import { createRateLimiter, getClientIp } from '../../_rate-limit.js'

// 20 register calls per IP per 10-minute window (idempotent, but cap spam)
const limiter = createRateLimiter({ windowMs: 10 * 60 * 1000, max: 20 })

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Method guard
  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  // Rate limit
  const ip = getClientIp(req.headers as Record<string, string | string[] | undefined>)
  if (limiter.isLimited(ip)) return res.status(429).json({ error: 'Too many requests' })

  try {
    const bountyId = req.query.id as string
    if (!bountyId || typeof bountyId !== 'string' || bountyId.length > 200)
      return res.status(400).json({ error: 'Missing or invalid bounty id' })

    const body = req.body as { poster?: string } | undefined
    const poster = ((body?.poster ?? '') as string).toLowerCase()
    const validPoster = /^0x[0-9a-f]{40}$/.test(poster) ? poster : null

    await ensureSchema()

    if (validPoster) {
      // Upsert: create row if missing, backfill poster if it was NULL
      await pool.sql`
        INSERT INTO bounties (id, is_public, poster)
        VALUES (${bountyId}, FALSE, ${validPoster})
        ON CONFLICT (id) DO UPDATE SET poster = COALESCE(bounties.poster, ${validPoster})
      `
    } else {
      await pool.sql`
        INSERT INTO bounties (id, is_public)
        VALUES (${bountyId}, FALSE)
        ON CONFLICT (id) DO NOTHING
      `
    }
    return res.status(200).json({ ok: true })
  } catch (e) {
    console.error('register handler error:', e)
    return res.status(500).json({ error: 'Server error' })
  }
}
