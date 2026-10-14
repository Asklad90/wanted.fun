import type { VercelRequest, VercelResponse } from '@vercel/node'
import { pool, ensureSchema } from '../../_db.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method === 'OPTIONS') return res.status(204).end()
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

    const bountyId = req.query.id as string
    if (!bountyId) return res.status(400).json({ error: 'Missing bounty id' })

    await ensureSchema()
    await pool.sql`
      INSERT INTO bounties (id, is_public)
      VALUES (${bountyId}, FALSE)
      ON CONFLICT (id) DO NOTHING
    `
    return res.status(200).json({ ok: true })
  } catch (e) {
    console.error('register handler error:', e)
    return res.status(500).json({ error: 'Server error', detail: String(e) })
  }
}
