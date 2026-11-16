import type { VercelRequest, VercelResponse } from '@vercel/node'
import { pool, ensureSchema } from './_db.js'
import { createRateLimiter, getClientIp } from './_rate-limit.js'
import {
  scanLiveGuaranteedBounties,
  LEGACY_EXTERNAL_BOUNTY_IDS,
  isGenericHomepageUrl,
  type ScannedExternalBounty,
} from './_x-scanner.js'

const getLimiter = createRateLimiter({ windowMs: 60 * 1000, max: 60 })
const syncLimiter = createRateLimiter({ windowMs: 5 * 60 * 1000, max: 10 })

function hasDatabaseUrl(): boolean {
  return Boolean(
    process.env.PREVIEW_POSTGRES_URL ||
    process.env.POSTGRES_URL ||
    process.env.DATABASE_URL
  )
}

async function purgeStaleExternalRows(): Promise<void> {
  const legacySet = new Set<string>(LEGACY_EXTERNAL_BOUNTY_IDS)
  const { rows } = await pool.sql`SELECT id, tweet_url, participation_url FROM external_bounties`
  for (const r of rows) {
    const id = String(r.id ?? '')
    const tweetUrl = String(r.tweet_url ?? '')
    const partUrl = String(r.participation_url ?? '')
    const isBareXProfile = /^https?:\/\/(?:x\.com|twitter\.com)\/[A-Za-z0-9_]+\/?$/i.test(tweetUrl)
    if (legacySet.has(id) || isBareXProfile || isGenericHomepageUrl(partUrl)) {
      await pool.sql`DELETE FROM external_bounties WHERE id = ${id}`
    }
  }
}

async function upsertScannedBounties(bounties: ScannedExternalBounty[]): Promise<void> {
  for (const b of bounties) {
    await pool.sql`
      INSERT INTO external_bounties (
        id, tweet_id, title, description, reward_usdc, reward_label,
        max_winners, deadline, poster_handle, poster_name, verified_source,
        tweet_url, participation_url, category, requirements_summary, created_at
      ) VALUES (
        ${b.id}, ${b.tweet_id}, ${b.title}, ${b.description}, ${b.reward_usdc}, ${b.reward_label},
        ${b.max_winners}, ${b.deadline}, ${b.poster_handle}, ${b.poster_name}, ${b.verified_source},
        ${b.tweet_url}, ${b.participation_url}, ${b.category}, ${b.requirements_summary}, ${b.created_at}
      )
      ON CONFLICT (id) DO UPDATE SET
        title = EXCLUDED.title,
        description = EXCLUDED.description,
        reward_usdc = EXCLUDED.reward_usdc,
        reward_label = EXCLUDED.reward_label,
        max_winners = EXCLUDED.max_winners,
        deadline = EXCLUDED.deadline,
        poster_handle = EXCLUDED.poster_handle,
        poster_name = EXCLUDED.poster_name,
        verified_source = EXCLUDED.verified_source,
        tweet_url = EXCLUDED.tweet_url,
        participation_url = EXCLUDED.participation_url,
        category = EXCLUDED.category,
        requirements_summary = EXCLUDED.requirements_summary
    `
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') return res.status(204).end()

  const ip = getClientIp(req.headers as Record<string, string | string[] | undefined>)

  try {
    // Fallback when running without Postgres env vars
    if (!hasDatabaseUrl()) {
      const { bounties, source } = await scanLiveGuaranteedBounties()
      const singleId = typeof req.query.id === 'string' ? req.query.id : undefined
      if (singleId) {
        const found = bounties.find(b => b.id === singleId) ?? null
        if (!found) return res.status(404).json({ error: 'External bounty not found' })
        return res.status(200).json({ bounty: found })
      }
      return res.status(200).json({ bounties, source, synced_at: Math.floor(Date.now() / 1000) })
    }

    await ensureSchema()
    const nowSec = Math.floor(Date.now() / 1000)
    const hideCutoff = nowSec - 3 * 24 * 60 * 60 // Keep ended bounties visible for 3 days as ENDED

    // POST /api/external-bounties (or GET with ?sync=1 or x-vercel-cron header)
    const isCronHeader = Boolean(req.headers['x-vercel-cron'])
    const isSyncRequest = req.method === 'POST' || req.query.sync === '1' || isCronHeader
    if (isSyncRequest) {
      if (syncLimiter.isLimited(ip)) {
        return res.status(429).json({ error: 'Sync rate limit reached. Try again in a few minutes.' })
      }
      await purgeStaleExternalRows()
      const { bounties: scanned, source } = await scanLiveGuaranteedBounties()
      await upsertScannedBounties(scanned)

      const { rows } = await pool.sql`
        SELECT * FROM external_bounties
        WHERE deadline > ${hideCutoff}
        ORDER BY (deadline > ${nowSec}) DESC, reward_usdc DESC, deadline ASC
        LIMIT 24
      `
      return res.status(200).json({
        ok: true,
        source,
        bounties: rows,
        synced_at: nowSec,
      })
    }

    if (req.method !== 'GET') {
      return res.status(405).json({ error: 'Method not allowed' })
    }

    if (getLimiter.isLimited(ip)) {
      return res.status(429).json({ error: 'Too many requests' })
    }

    const singleId = typeof req.query.id === 'string' ? req.query.id : undefined
    if (singleId) {
      let { rows } = await pool.sql`
        SELECT * FROM external_bounties WHERE id = ${singleId} LIMIT 1
      `
      if (rows.length === 0) {
        const { bounties: scanned } = await scanLiveGuaranteedBounties()
        await upsertScannedBounties(scanned)
        const retry = await pool.sql`
          SELECT * FROM external_bounties WHERE id = ${singleId} LIMIT 1
        `
        rows = retry.rows
      }
      if (rows.length === 0) {
        return res.status(404).json({ error: 'External bounty not found' })
      }
      return res.status(200).json({ bounty: rows[0] })
    }

    await purgeStaleExternalRows()

    let { rows } = await pool.sql`
      SELECT * FROM external_bounties
      WHERE deadline > ${hideCutoff}
      ORDER BY (deadline > ${nowSec}) DESC, reward_usdc DESC, deadline ASC
      LIMIT 24
    `

    const liveRowsCount = rows.filter(r => Number(r.deadline) > nowSec).length

    // Auto-seed / refresh if fewer than 10 live external bounties are currently active
    if (liveRowsCount < 10) {
      const { bounties: scanned } = await scanLiveGuaranteedBounties()
      await upsertScannedBounties(scanned)
      const refreshed = await pool.sql`
        SELECT * FROM external_bounties
        WHERE deadline > ${hideCutoff}
        ORDER BY (deadline > ${nowSec}) DESC, reward_usdc DESC, deadline ASC
        LIMIT 24
      `
      rows = refreshed.rows
    }

    return res.status(200).json({
      bounties: rows,
      synced_at: nowSec,
    })
  } catch (e) {
    console.error('external-bounties handler error:', e)
    // Graceful fallback so the UI still receives live curated bounties even if DB has a transient issue
    const { bounties, source } = await scanLiveGuaranteedBounties()
    return res.status(200).json({ bounties, source, fallback: true })
  }
}
