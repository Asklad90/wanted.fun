import type { VercelRequest, VercelResponse } from '@vercel/node'
import { pool, ensureSchema } from './_db.js'
import { ensurePoster, fromBountyKey } from './_poster.js'
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
      SELECT DISTINCT bounty_id FROM submissions WHERE submitter = ${wallet}
    `
    // Only bounties of the current chain/contract, back as the ids the client knows
    const ids = (rows as { bounty_id: string }[])
      .map(r => fromBountyKey(r.bounty_id))
      .filter((id): id is string => id !== null)
      .slice(0, 50)

    // "My submissions" = work sent to OTHER people's bounties, never your own
    // (poster comes from the contract; if it can't be read we can't tell, so keep it listed)
    const posters = await Promise.all(ids.map(id => ensurePoster(id)))
    const bountyIds = ids
      .filter((_, i) => posters[i] !== wallet)
      .sort((x, y) => Number(x) - Number(y))
    return res.status(200).json({ bountyIds })
  } catch (e) {
    console.error('submissions-by-wallet error:', e)
    return res.status(500).json({ error: 'Server error' })
  }
}
