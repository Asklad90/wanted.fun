import type { VercelRequest, VercelResponse } from '@vercel/node'
import { pool, ensureSchema } from '../../_db.js'
import { verifyAuth, type AuthPayload } from '../../_auth.js'
import { createRateLimiter, getClientIp } from '../../_rate-limit.js'

const MAX_EXAMPLES = 5
const MAX_BYTES = 4_300_000

// GET: 60 per IP per minute
const getLimiter = createRateLimiter({ windowMs: 60 * 1000, max: 60 })
// POST: 10 uploads per IP per 10-minute window
const postLimiter = createRateLimiter({ windowMs: 10 * 60 * 1000, max: 10 })

const ALLOWED_MIMES = new Set([
  'image/jpeg', 'image/png', 'image/gif', 'image/webp',
  'video/mp4', 'video/quicktime', 'video/webm',
])

function validateDataUrlMime(dataUrl: string): boolean {
  const prefixMatch = dataUrl.match(/^data:([^;,]+);base64,/)
  if (!prefixMatch) return false
  const declaredMime = prefixMatch[1].toLowerCase()
  if (!ALLOWED_MIMES.has(declaredMime)) return false

  const b64 = dataUrl.slice(prefixMatch[0].length, prefixMatch[0].length + 24)
  let bytes: Uint8Array
  try {
    const bin = atob(b64)
    bytes = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  } catch {
    return false
  }

  if (bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF) return declaredMime === 'image/jpeg'
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47) return declaredMime === 'image/png'
  if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) return declaredMime === 'image/gif'
  if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
      bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50)
    return declaredMime === 'image/webp'
  if (bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70)
    return declaredMime === 'video/mp4' || declaredMime === 'video/quicktime'
  if (bytes[0] === 0x1A && bytes[1] === 0x45 && bytes[2] === 0xDF && bytes[3] === 0xA3)
    return declaredMime === 'video/webm'

  return false
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method === 'OPTIONS') return res.status(204).end()

    const bountyId = req.query.id as string
    if (!bountyId || typeof bountyId !== 'string' || bountyId.length > 200)
      return res.status(400).json({ error: 'Missing or invalid bounty id' })

    await ensureSchema()

    const ip = getClientIp(req.headers as Record<string, string | string[] | undefined>)

    // ── GET — fetch examples (public) ────────────────────────────────────────
    if (req.method === 'GET') {
      if (getLimiter.isLimited(ip)) return res.status(429).json({ error: 'Too many requests' })
      const { rows } = await pool.sql`
        SELECT id, bounty_id, content, sort_order, created_at
        FROM bounty_examples
        WHERE bounty_id = ${bountyId}
        ORDER BY sort_order ASC, created_at ASC
      `
      return res.status(200).json({ examples: rows })
    }

    // ── POST — save examples (creator only) ──────────────────────────────────
    if (req.method === 'POST') {
      if (postLimiter.isLimited(ip)) return res.status(429).json({ error: 'Too many requests' })

      const body = req.body as {
        examples?: string[]
        address?: string
        timestamp?: number
        signature?: string
      }

      // ── Signature auth ────────────────────────────────────────────────────
      const authPayload: AuthPayload = {
        address: body.address ?? '',
        timestamp: body.timestamp ?? 0,
        signature: body.signature ?? '',
      }
      const auth = await verifyAuth(authPayload, 'examples', bountyId)
      if (!auth.ok) return res.status(auth.status).json({ error: auth.error })

      // ── Creator-only check ────────────────────────────────────────────────
      const { rows: bRows } = await pool.sql`SELECT poster FROM bounties WHERE id = ${bountyId}`
      const storedPoster = (bRows[0] as { poster: string | null } | undefined)?.poster?.toLowerCase()
      if (storedPoster && storedPoster !== auth.address) {
        return res.status(403).json({ error: 'Only the bounty creator can update examples' })
      }

      const examples = body.examples ?? []
      if (!Array.isArray(examples))
        return res.status(400).json({ error: 'examples must be an array' })
      if (examples.length > MAX_EXAMPLES)
        return res.status(400).json({ error: `Max ${MAX_EXAMPLES} examples allowed` })

      for (const ex of examples) {
        if (typeof ex !== 'string')
          return res.status(400).json({ error: 'Each example must be a string' })
        if (ex.length > MAX_BYTES)
          return res.status(400).json({ error: 'Example too large (max 3 MB)' })
        if (!validateDataUrlMime(ex))
          return res.status(400).json({ error: 'Example file type not allowed. Use JPEG, PNG, GIF, WEBP, MP4, MOV, or WEBM.' })
      }

      // Replace — delete existing then insert new
      await pool.sql`DELETE FROM bounty_examples WHERE bounty_id = ${bountyId}`
      for (let i = 0; i < examples.length; i++) {
        await pool.sql`
          INSERT INTO bounty_examples (bounty_id, content, sort_order)
          VALUES (${bountyId}, ${examples[i]}, ${i})
        `
      }
      return res.status(200).json({ ok: true })
    }

    return res.status(405).json({ error: 'Method not allowed' })
  } catch (e) {
    console.error('examples handler error:', e)
    return res.status(500).json({ error: 'Server error' })
  }
}
