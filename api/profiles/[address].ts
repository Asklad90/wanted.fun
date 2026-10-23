import type { VercelRequest, VercelResponse } from '@vercel/node'
import { pool, ensureSchema } from '../_db.js'
import { verifyAuth, type AuthPayload } from '../_auth.js'
import { createRateLimiter, getClientIp } from '../_rate-limit.js'

const MAX_BIO_LEN = 160
const MAX_AVATAR_VARIANT = 11

// GET: 120 reads per IP per minute (every profile view hits this)
const getLimiter = createRateLimiter({ windowMs: 60 * 1000, max: 120 })
// PATCH: 20 edits per IP per 10-minute window
const patchLimiter = createRateLimiter({ windowMs: 10 * 60 * 1000, max: 20 })

function isValidAddress(addr: string): boolean {
  return /^0x[0-9a-fA-F]{40}$/.test(addr)
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method === 'OPTIONS') return res.status(204).end()

    const addressParam = (req.query.address as string | undefined) ?? ''
    if (!isValidAddress(addressParam)) return res.status(400).json({ error: 'Invalid wallet address' })
    const address = addressParam.toLowerCase()

    await ensureSchema()

    if (req.method === 'GET') {
      const ip = getClientIp(req.headers as Record<string, string | string[] | undefined>)
      if (getLimiter.isLimited(ip)) return res.status(429).json({ error: 'Too many requests' })

      const { rows } = await pool.sql`
        SELECT bio, avatar_variant FROM profiles WHERE address = ${address}
      `
      const row = rows[0] as { bio: string | null; avatar_variant: number } | undefined
      return res.status(200).json({
        bio: row?.bio ?? '',
        avatar_variant: row?.avatar_variant ?? 0,
      })
    }

    if (req.method === 'PATCH') {
      const ip = getClientIp(req.headers as Record<string, string | string[] | undefined>)
      if (patchLimiter.isLimited(ip)) return res.status(429).json({ error: 'Too many requests' })

      const body = (req.body ?? {}) as {
        bio?: string
        avatar_variant?: number
        address?: string
        timestamp?: number
        signature?: string
      }

      const authPayload: AuthPayload = {
        address: body.address ?? '',
        timestamp: body.timestamp ?? 0,
        signature: body.signature ?? '',
      }
      const auth = await verifyAuth(authPayload, 'profile', 'profile')
      if (!auth.ok) return res.status(auth.status).json({ error: auth.error })

      // You can only edit your own profile
      if (auth.address !== address) return res.status(403).json({ error: 'You can only edit your own profile' })

      let bio = typeof body.bio === 'string' ? body.bio.replace(/\s+/g, ' ').trim() : ''
      if (bio.length > MAX_BIO_LEN) bio = bio.slice(0, MAX_BIO_LEN)

      let avatarVariant = typeof body.avatar_variant === 'number' ? Math.trunc(body.avatar_variant) : 0
      if (!Number.isFinite(avatarVariant) || avatarVariant < 0 || avatarVariant > MAX_AVATAR_VARIANT) avatarVariant = 0

      await pool.sql`
        INSERT INTO profiles (address, bio, avatar_variant)
        VALUES (${address}, ${bio}, ${avatarVariant})
        ON CONFLICT (address) DO UPDATE SET bio = ${bio}, avatar_variant = ${avatarVariant}, updated_at = EXTRACT(EPOCH FROM NOW())::BIGINT
      `
      return res.status(200).json({ ok: true, bio, avatar_variant: avatarVariant })
    }

    return res.status(405).json({ error: 'Method not allowed' })
  } catch (e) {
    console.error('profile handler error:', e)
    return res.status(500).json({ error: 'Server error' })
  }
}
