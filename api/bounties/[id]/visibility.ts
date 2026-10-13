import type { VercelRequest, VercelResponse } from '@vercel/node'
import { pool, ensureSchema } from '../../_db'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'PATCH') return res.status(405).json({ error: 'Method not allowed' })

  const bountyId = req.query.id as string
  if (!bountyId) return res.status(400).json({ error: 'Missing bounty id' })

  const body = req.body as { is_public?: boolean }
  const isPublic = body.is_public === true

  await ensureSchema()

  await pool.sql`
    INSERT INTO bounties (id, is_public)
    VALUES (${bountyId}, ${isPublic})
    ON CONFLICT (id) DO UPDATE SET is_public = ${isPublic}
  `
  return res.status(200).json({ ok: true, is_public: isPublic })
}
