import type { VercelRequest, VercelResponse } from '@vercel/node'
import { pool, ensureSchema } from '../../_db.js'
import { verifyAuth, type AuthPayload } from '../../_auth.js'
import { createRateLimiter, getClientIp } from '../../_rate-limit.js'

const MAX_TEXT = 1000
// Vercel rejects request bodies over 4.5 MB, so cap base64 data URLs below that.
const MAX_BYTES = 4_300_000

// ── Rate limiters ─────────────────────────────────────────────────────────────
// GET: 60/min per IP (read-heavy)
const getLimiter = createRateLimiter({ windowMs: 60 * 1000, max: 60 })
// POST: 5 submissions per IP per 10-minute window
const postLimiter = createRateLimiter({ windowMs: 10 * 60 * 1000, max: 5 })
// POST: 3 submissions per wallet per 10-minute window (secondary guard)
const walletLimiter = createRateLimiter({ windowMs: 10 * 60 * 1000, max: 3 })

/**
 * Validate the real MIME type of a data URL by inspecting its magic bytes.
 * We decode the first 16 bytes from the base64 payload rather than trusting
 * the declared MIME in the prefix.
 */
function validateDataUrlMime(dataUrl: string): boolean {
  const ALLOWED_MIMES = new Set([
    'image/jpeg', 'image/png', 'image/gif', 'image/webp',
    'video/mp4', 'video/quicktime', 'video/webm',
  ])

  // Check declared MIME first (fast path)
  const prefixMatch = dataUrl.match(/^data:([^;,]+);base64,/)
  if (!prefixMatch) return false
  const declaredMime = prefixMatch[1].toLowerCase()
  if (!ALLOWED_MIMES.has(declaredMime)) return false

  // Verify actual magic bytes match the declared type
  const b64 = dataUrl.slice(prefixMatch[0].length, prefixMatch[0].length + 24)
  let bytes: Uint8Array
  try {
    const bin = atob(b64)
    bytes = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  } catch {
    return false
  }

  // JPEG: FF D8 FF
  if (bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF) return declaredMime === 'image/jpeg'
  // PNG: 89 50 4E 47
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47) return declaredMime === 'image/png'
  // GIF: 47 49 46
  if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) return declaredMime === 'image/gif'
  // WEBP: 52 49 46 46 ... 57 45 42 50
  if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
      bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50)
    return declaredMime === 'image/webp'
  // MP4: ftyp box at offset 4 (66 74 79 70)
  if (bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70)
    return declaredMime === 'video/mp4' || declaredMime === 'video/quicktime'
  // WebM: 1A 45 DF A3
  if (bytes[0] === 0x1A && bytes[1] === 0x45 && bytes[2] === 0xDF && bytes[3] === 0xA3)
    return declaredMime === 'video/webm'

  // Unknown magic — reject
  return false
}

/** Block javascript: and data: URI schemes in text content. */
function hasDangerousLink(text: string): boolean {
  return /javascript\s*:/i.test(text) || /data\s*:\s*text\/html/i.test(text)
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method === 'OPTIONS') return res.status(204).end()

    const bountyId = req.query.id as string
    if (!bountyId || typeof bountyId !== 'string' || bountyId.length > 200)
      return res.status(400).json({ error: 'Missing or invalid bounty id' })

    await ensureSchema()

    // ── GET — fetch submissions (or just count) ────────────────────────────
    if (req.method === 'GET') {
      const ip = getClientIp(req.headers as Record<string, string | string[] | undefined>)
      if (getLimiter.isLimited(ip)) return res.status(429).json({ error: 'Too many requests' })

      // ?count=1 — always-public total count, no content exposed
      if (req.query.count === '1') {
        const { rows } = await pool.sql`
          SELECT COUNT(*)::int AS count FROM submissions WHERE bounty_id = ${bountyId}
        `
        const count = (rows[0] as { count: number } | undefined)?.count ?? 0
        return res.status(200).json({ count })
      }

      const viewer = ((req.query.viewer as string) ?? '').toLowerCase()
      const poster = ((req.query.poster as string) ?? '').toLowerCase()

      // Validate addresses if provided
      if (viewer && !/^0x[0-9a-f]{40}$/.test(viewer))
        return res.status(400).json({ error: 'Invalid viewer address' })
      if (poster && !/^0x[0-9a-f]{40}$/.test(poster))
        return res.status(400).json({ error: 'Invalid poster address' })

      const { rows: bountyRows } = await pool.sql`
        SELECT id, is_public, poster FROM bounties WHERE id = ${bountyId}
      `
      const bountyRow = bountyRows[0] as { id: string; is_public: boolean; poster: string | null } | undefined
      const isPublic = bountyRow?.is_public === true
      // Poster sees all — but we also cross-check that the poster param matches DB record
      const dbPoster = (bountyRow?.poster ?? '').toLowerCase()
      const callerIsPoster = !!poster && !!dbPoster && viewer === poster && poster === dbPoster

      if (isPublic || callerIsPoster) {
        const { rows: subs } = await pool.sql`
          SELECT id, bounty_id, submitter, content, created_at
          FROM submissions
          WHERE bounty_id = ${bountyId}
          ORDER BY created_at ASC
        `
        return res.status(200).json({ submissions: subs, is_public: isPublic })
      }

      // Private bounty — submitter can only see their own
      if (viewer && /^0x[0-9a-f]{40}$/.test(viewer)) {
        const { rows: subs } = await pool.sql`
          SELECT id, bounty_id, submitter, content, created_at
          FROM submissions
          WHERE bounty_id = ${bountyId} AND submitter = ${viewer}
        `
        return res.status(200).json({ submissions: subs, is_public: false })
      }

      return res.status(200).json({ submissions: [], is_public: false })
    }

    // ── POST — create submission ────────────────────────────────────────────
    if (req.method === 'POST') {
      const ip = getClientIp(req.headers as Record<string, string | string[] | undefined>)
      if (postLimiter.isLimited(ip))
        return res.status(429).json({ error: 'Too many submissions. Please wait a few minutes and try again.' })

      const body = req.body as {
        submitter?: string
        content?: string
        timestamp?: number
        signature?: string
      }

      const submitter = (body.submitter ?? '').toLowerCase()
      const content = (body.content ?? '').trim()

      if (!submitter || !/^0x[0-9a-f]{40}$/i.test(submitter))
        return res.status(400).json({ error: 'Invalid submitter address' })
      if (!content)
        return res.status(400).json({ error: 'Content is required' })

      // Per-wallet rate limit
      if (walletLimiter.isLimited(submitter))
        return res.status(429).json({ error: 'Too many submissions from this wallet. Please wait.' })

      // ── Signature auth ────────────────────────────────────────────────────
      const authPayload: AuthPayload = {
        address: submitter,
        timestamp: body.timestamp ?? 0,
        signature: body.signature ?? '',
      }
      const auth = await verifyAuth(authPayload, 'submit', bountyId)
      if (!auth.ok) return res.status(auth.status).json({ error: auth.error })

      // ── Content validation ────────────────────────────────────────────────
      const isDataUrl = content.startsWith('data:')

      if (isDataUrl) {
        if (content.length > MAX_BYTES)
          return res.status(400).json({ error: 'File too large (max 3 MB)' })
        if (!validateDataUrlMime(content))
          return res.status(400).json({ error: 'File type not allowed. Use JPEG, PNG, GIF, WEBP, MP4, MOV, or WEBM.' })
      } else {
        if (content.length > MAX_TEXT)
          return res.status(400).json({ error: 'Content too long (max 1000 chars)' })
        if (hasDangerousLink(content))
          return res.status(400).json({ error: 'Content contains disallowed links' })
      }

      // Ensure bounty row exists
      await pool.sql`
        INSERT INTO bounties (id, is_public)
        VALUES (${bountyId}, FALSE)
        ON CONFLICT (id) DO NOTHING
      `

      // Check duplicate
      const { rows: existing } = await pool.sql`
        SELECT id FROM submissions
        WHERE bounty_id = ${bountyId} AND submitter = ${submitter}
      `
      if (existing.length > 0)
        return res.status(409).json({ error: 'Already submitted to this bounty' })

      await pool.sql`
        INSERT INTO submissions (bounty_id, submitter, content)
        VALUES (${bountyId}, ${submitter}, ${content})
      `
      return res.status(201).json({ ok: true })
    }

    return res.status(405).json({ error: 'Method not allowed' })
  } catch (e) {
    console.error('submissions handler error:', e)
    return res.status(500).json({ error: 'Server error' })
  }
}
