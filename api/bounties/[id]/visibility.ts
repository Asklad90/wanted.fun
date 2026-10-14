import type { VercelRequest, VercelResponse } from '@vercel/node'
import { pool, ensureSchema } from '../../_db.js'
import { verifyAuth, type AuthPayload } from '../../_auth.js'
import { createRateLimiter, getClientIp } from '../../_rate-limit.js'

// 10 visibility toggles per IP per 10-minute window
const limiter = createRateLimiter({ windowMs: 10 * 60 * 1000, max: 10 })

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method === 'OPTIONS') return res.status(204).end()
    if (req.method !== 'PATCH') return res.status(405).json({ error: 'Method not allowed' })

    const ip = getClientIp(req.headers as Record<string, string | string[] | undefined>)
    if (limiter.isLimited(ip)) return res.status(429).json({ error: 'Too many requests' })

    const bountyId = req.query.id as string
    if (!bountyId || typeof bountyId !== 'string' || bountyId.length > 200)
      return res.status(400).json({ error: 'Missing or invalid bounty id' })

    await ensureSchema()

    const body = (req.body ?? {}) as {
      is_public?: boolean
      address?: string
      timestamp?: number
      signature?: string
    }

    if (typeof body.is_public !== 'boolean')
      return res.status(400).json({ error: 'is_public must be a boolean' })

    // ── Signature auth ──────────────────────────────────────────────────────
    const authPayload: AuthPayload = {
      address: body.address ?? '',
      timestamp: body.timestamp ?? 0,
      signature: body.signature ?? '',
    }
    const auth = await verifyAuth(authPayload, 'visibility', bountyId)
    if (!auth.ok) return res.status(auth.status).json({ error: auth.error })

    // ── Creator-only check ──────────────────────────────────────────────────
    // Look up the stored poster address; if no poster was ever recorded we trust
    // the first caller (backwards-compat with existing bounties).
    const { rows } = await pool.sql`SELECT poster FROM bounties WHERE id = ${bountyId}`
    const storedPoster = (rows[0] as { poster: string | null } | undefined)?.poster?.toLowerCase()

    if (storedPoster && storedPoster !== auth.address) {
      return res.status(403).json({ error: 'Only the bounty creator can change visibility' })
    }

    const isPublic = body.is_public === true

    await pool.sql`
      INSERT INTO bounties (id, is_public, poster)
      VALUES (${bountyId}, ${isPublic}, ${auth.address})
      ON CONFLICT (id) DO UPDATE SET is_public = ${isPublic}
    `
    return res.status(200).json({ ok: true, is_public: isPublic })
  } catch (e) {
    console.error('visibility handler error:', e)
    return res.status(500).json({ error: 'Server error' })
  }
}
