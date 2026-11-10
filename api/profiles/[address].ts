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
        SELECT bio, avatar_variant, twitter, github, website, created_at FROM profiles WHERE address = ${address}
      `
      let row = rows[0] as {
        bio: string | null
        avatar_variant: number
        twitter: string | null
        github: string | null
        website: string | null
        created_at: number | string | null
      } | undefined

      if (!row) {
        // If profile row doesn't exist yet, find earliest activity on Want.fun (or fallback to now)
        const { rows: subRows } = await pool.sql`
          SELECT MIN(created_at) as earliest FROM submissions WHERE LOWER(submitter) = ${address}
        `
        const { rows: bountyRows } = await pool.sql`
          SELECT MIN(created_at) as earliest FROM bounties WHERE LOWER(poster) = ${address}
        `
        const subEarliest = subRows[0]?.earliest ? Number(subRows[0].earliest) : null
        const bountyEarliest = bountyRows[0]?.earliest ? Number(bountyRows[0].earliest) : null
        const candidates = [subEarliest, bountyEarliest].filter((x): x is number => typeof x === 'number' && x > 0)
        const earliestTs = candidates.length > 0 ? Math.min(...candidates) : Math.floor(Date.now() / 1000)

        await pool.sql`
          INSERT INTO profiles (address, created_at, updated_at)
          VALUES (${address}, ${earliestTs}, ${earliestTs})
          ON CONFLICT (address) DO NOTHING
        `

        row = {
          bio: '',
          avatar_variant: 0,
          twitter: '',
          github: '',
          website: '',
          created_at: earliestTs,
        }
      }

      // If we have an existing profile but its created_at looks like a default recent timestamp (e.g., within the last day),
      // recalculate based on earliest activity and update the row.
      const nowSec = Math.floor(Date.now() / 1000);
      const isStale = row.created_at && typeof row.created_at === 'number' && (nowSec - Number(row.created_at) < 86400);
      if (isStale) {
        const { rows: subRows } = await pool.sql`SELECT MIN(created_at) as earliest FROM submissions WHERE LOWER(submitter) = ${address}`;
        const { rows: bountyRows } = await pool.sql`SELECT MIN(created_at) as earliest FROM bounties WHERE LOWER(poster) = ${address}`;
        const subEarliest = subRows[0]?.earliest ? Number(subRows[0].earliest) : null;
        const bountyEarliest = bountyRows[0]?.earliest ? Number(bountyRows[0].earliest) : null;
        const candidates = [subEarliest, bountyEarliest].filter((x): x is number => typeof x === 'number' && x > 0);
        const earliestTs = candidates.length > 0 ? Math.min(...candidates) : nowSec;
        await pool.sql`UPDATE profiles SET created_at = ${earliestTs}, updated_at = ${nowSec} WHERE address = ${address}`;
        row.created_at = earliestTs;
      }

      return res.status(200).json({
        bio: row.bio ?? '',
        avatar_variant: row.avatar_variant ?? 0,
        twitter: row.twitter ?? '',
        github: row.github ?? '',
        website: row.website ?? '',
        created_at: row.created_at ? Number(row.created_at) : Math.floor(Date.now() / 1000),
      })
    }

    if (req.method === 'PATCH') {
      const ip = getClientIp(req.headers as Record<string, string | string[] | undefined>)
      if (patchLimiter.isLimited(ip)) return res.status(429).json({ error: 'Too many requests' })

      const body = (req.body ?? {}) as {
        bio?: string
        avatar_variant?: number
        twitter?: string
        github?: string
        website?: string
        address?: string
        timestamp?: number
        signature?: string
      }

      // If cryptographic signature is provided, verify it (backward-compatible)
      if (body.signature && body.timestamp && body.address) {
        const authPayload: AuthPayload = {
          address: body.address,
          timestamp: body.timestamp,
          signature: body.signature,
        }
        const auth = await verifyAuth(authPayload, 'profile', 'profile')
        if (!auth.ok) return res.status(auth.status).json({ error: auth.error })
        if (auth.address !== address) return res.status(403).json({ error: 'You can only edit your own profile' })
      }

      let bio = typeof body.bio === 'string' ? body.bio.replace(/\s+/g, ' ').trim() : ''
      if (bio.length > MAX_BIO_LEN) bio = bio.slice(0, MAX_BIO_LEN)

      let avatarVariant = typeof body.avatar_variant === 'number' ? Math.trunc(body.avatar_variant) : 0
      if (!Number.isFinite(avatarVariant) || avatarVariant < 0 || avatarVariant > MAX_AVATAR_VARIANT) avatarVariant = 0

      // Clean social handles: strip leading @ or url prefixes if pasted
      let twitter = typeof body.twitter === 'string' ? body.twitter.trim().replace(/^@/, '').replace(/^(https?:\/\/)?(www\.)?(twitter|x)\.com\//, '').replace(/[/?#].*$/, '').trim() : ''
      if (twitter.length > 50) twitter = twitter.slice(0, 50)

      let github = typeof body.github === 'string' ? body.github.trim().replace(/^@/, '').replace(/^(https?:\/\/)?(www\.)?github\.com\//, '').replace(/[/?#].*$/, '').trim() : ''
      if (github.length > 50) github = github.slice(0, 50)

      let website = typeof body.website === 'string' ? body.website.trim() : ''
      if (website.length > 120) website = website.slice(0, 120)

      const now = Math.floor(Date.now() / 1000)
      const { rows: updatedRows } = await pool.sql`
        INSERT INTO profiles (address, bio, avatar_variant, twitter, github, website, created_at, updated_at)
        VALUES (${address}, ${bio}, ${avatarVariant}, ${twitter}, ${github}, ${website}, ${now}, ${now})
        ON CONFLICT (address) DO UPDATE SET
          bio = ${bio},
          avatar_variant = ${avatarVariant},
          twitter = ${twitter},
          github = ${github},
          website = ${website},
          updated_at = ${now}
        RETURNING created_at
      `
      const createdAt = updatedRows[0]?.created_at ? Number(updatedRows[0].created_at) : now
      return res.status(200).json({ ok: true, bio, avatar_variant: avatarVariant, twitter, github, website, created_at: createdAt })
    }

    return res.status(405).json({ error: 'Method not allowed' })
  } catch (e) {
    console.error('profile handler error:', e)
    return res.status(500).json({ error: 'Server error' })
  }
}
