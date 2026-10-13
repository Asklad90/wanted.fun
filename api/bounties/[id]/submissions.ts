import type { VercelRequest, VercelResponse } from '@vercel/node'
import { pool, ensureSchema } from '../../_db.js'

const MAX_TEXT = 1000
// Vercel rejects request bodies over 4.5 MB, so cap the base64 data URL below that.
const MAX_BYTES = 4_300_000

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method === 'OPTIONS') return res.status(204).end()

    const bountyId = req.query.id as string
    if (!bountyId) return res.status(400).json({ error: 'Missing bounty id' })

    await ensureSchema()

    // ── GET — fetch submissions ─────────────────────────────────────────────
    if (req.method === 'GET') {
      const viewer = ((req.query.viewer as string) ?? '').toLowerCase()
      const poster = ((req.query.poster as string) ?? '').toLowerCase()

      const { rows: bountyRows } = await pool.sql`
        SELECT id, is_public FROM bounties WHERE id = ${bountyId}
      `
      const bountyRow = bountyRows[0] as { id: string; is_public: boolean } | undefined
      const isPublic = bountyRow?.is_public === true
      const isPublicOrPoster = isPublic || (!!poster && viewer === poster)

      if (isPublicOrPoster) {
        const { rows: subs } = await pool.sql`
          SELECT id, bounty_id, submitter, content, created_at
          FROM submissions
          WHERE bounty_id = ${bountyId}
          ORDER BY created_at ASC
        `
        return res.status(200).json({ submissions: subs, is_public: isPublic })
      }

      if (viewer) {
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
      const body = req.body as { submitter?: string; content?: string }
      const submitter = (body.submitter ?? '').toLowerCase()
      const content = (body.content ?? '').trim()

      if (!submitter || !/^0x[0-9a-f]{40}$/i.test(submitter))
        return res.status(400).json({ error: 'Invalid submitter address' })
      if (!content)
        return res.status(400).json({ error: 'Content is required' })

      const isDataUrl = content.startsWith('data:')
      if (!isDataUrl && content.length > MAX_TEXT)
        return res.status(400).json({ error: 'Content too long (max 1000 chars)' })
      if (isDataUrl && content.length > MAX_BYTES)
        return res.status(400).json({ error: 'File too large (max 3 MB)' })

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
    return res.status(500).json({ error: 'Server error', detail: String(e) })
  }
}
