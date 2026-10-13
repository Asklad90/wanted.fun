import type { VercelRequest, VercelResponse } from '@vercel/node'
import { sql, ensureSchema } from '../../_db'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const bountyId = req.query.id as string
  if (!bountyId) return res.status(400).json({ error: 'Missing bounty id' })

  await ensureSchema()
  await sql`
    INSERT INTO bounties (id, is_public)
    VALUES (${bountyId}, FALSE)
    ON CONFLICT (id) DO NOTHING
  `
  return res.status(200).json({ ok: true })
}
