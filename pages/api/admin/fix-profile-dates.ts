import type { VercelRequest, VercelResponse } from '@vercel/node';
import { pool, ensureSchema } from '../../../api/_db.js';

/**
 * One‑off admin endpoint to back‑fill stale `created_at` timestamps in the `profiles` table.
 *
 * It selects every profile where the stored `created_at` appears to be a recent default value
 * (i.e., less than 24 h old). For each such address we recompute the earliest activity from
 * `submissions` and `bounties` and update the row.
 *
 * Protect this endpoint with a secret token supplied via the `ADMIN_TOKEN` environment variable.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const token = req.headers['x-admin-token'] as string | undefined;
    if (!process.env.ADMIN_TOKEN || token !== process.env.ADMIN_TOKEN) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    await ensureSchema();
    const nowSec = Math.floor(Date.now() / 1000);

    // Find profiles that look stale – created within the last 24 h (or any future‑dated value).
    const { rows: staleProfiles } = await pool.sql`
      SELECT address, created_at FROM profiles
      WHERE created_at IS NULL OR (now() - to_timestamp(created_at)) < interval '24 hours'
    `;

    let updatedCount = 0;
    for (const p of staleProfiles) {
      const address = (p.address as string).toLowerCase();

      const { rows: subRows } = await pool.sql`
        SELECT MIN(created_at) as earliest FROM submissions WHERE LOWER(submitter) = ${address}
      `;
      const { rows: bountyRows } = await pool.sql`
        SELECT MIN(created_at) as earliest FROM bounties WHERE LOWER(poster) = ${address}
      `;
      const subEarliest = subRows[0]?.earliest ? Number(subRows[0].earliest) : null;
      const bountyEarliest = bountyRows[0]?.earliest ? Number(bountyRows[0].earliest) : null;
      const candidates = [subEarliest, bountyEarliest].filter((x): x is number => typeof x === 'number' && x > 0);
      const earliestTs = candidates.length > 0 ? Math.min(...candidates) : nowSec;

      await pool.sql`
        UPDATE profiles SET created_at = ${earliestTs}, updated_at = ${nowSec} WHERE address = ${address}
      `;
      updatedCount++;
    }

    return res.status(200).json({ ok: true, updated: updatedCount });
  } catch (e) {
    console.error('admin fix-profile-dates error:', e);
    return res.status(500).json({ error: 'Server error' });
  }
}
