import type { VercelRequest, VercelResponse } from '@vercel/node'
import { pool, ensureSchema } from './_db.js'
import { ensurePoster } from './_poster.js'
import { createRateLimiter, getClientIp } from './_rate-limit.js'

const getLimiter = createRateLimiter({ windowMs: 60 * 1000, max: 60 })

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method === 'OPTIONS') return res.status(204).end()
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

    const ip = getClientIp(req.headers as Record<string, string | string[] | undefined>)
    if (getLimiter.isLimited(ip)) return res.status(429).json({ error: 'Too many requests' })

    const wallet = ((req.query.wallet as string) ?? '').toLowerCase()
    if (!wallet || !/^0x[0-9a-f]{40}$/.test(wallet))
      return res.status(400).json({ error: 'Invalid wallet address' })

    await ensureSchema()

    const { rows } = await pool.sql`
      SELECT DISTINCT s.bounty_id, b.poster
      FROM submissions s
      LEFT JOIN bounties b ON b.id = s.bounty_id
      WHERE s.submitter = ${wallet}
    `
    const found = rows as { bounty_id: string; poster: string | null }[]

    // Fill in any missing posters from the contract so we can drop the wallet's own bounties
    const unknown = found.filter(r => !r.poster).slice(0, 25)
    await Promise.all(
      unknown.map(async r => { r.poster = await ensurePoster(r.bounty_id) }),
    )

    // "My submissions" = work sent to OTHER people's bounties, never your own
    const bountyIds = found
      .filter(r => (r.poster ?? '').toLowerCase() !== wallet)
      .map(r => r.bounty_id)
      .sort((a, b) => Number(a) - Number(b))
    return res.status(200).json({ bountyIds })
  } catch (e) {
    console.error('submissions-by-wallet error:', e)
    return res.status(500).json({ error: 'Server error' })
  }
}
