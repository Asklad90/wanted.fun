/**
 * Wanted.fun off-chain submissions server
 * Bun HTTP server on port 3001 — SQLite (WAL mode) for crash-safe storage.
 * Submissions are stored here; only approveWinner goes onchain.
 */

import { Database } from 'bun:sqlite'
import path from 'path'

const DB_PATH = path.join(import.meta.dir, '..', 'data', 'submissions.db')

// Ensure data dir exists
import { mkdirSync } from 'fs'
mkdirSync(path.dirname(DB_PATH), { recursive: true })

const db = new Database(DB_PATH, { create: true })
db.exec('PRAGMA journal_mode=WAL')
db.exec('PRAGMA foreign_keys=ON')

// ── Schema ────────────────────────────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS bounties (
    id TEXT PRIMARY KEY,
    is_public INTEGER NOT NULL DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS submissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    bounty_id TEXT NOT NULL,
    submitter TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    UNIQUE(bounty_id, submitter)
  );
`)

// ── Prepared statements ───────────────────────────────────────────────────────
const stmtGetBounty = db.prepare<{ id: string; is_public: number }, [string]>(
  'SELECT id, is_public FROM bounties WHERE id = ?'
)
const stmtUpsertBounty = db.prepare(
  'INSERT INTO bounties (id, is_public) VALUES (?, 0) ON CONFLICT(id) DO NOTHING'
)
const stmtSetVisibility = db.prepare(
  'UPDATE bounties SET is_public = ? WHERE id = ?'
)
const stmtInsertSubmission = db.prepare(
  'INSERT OR IGNORE INTO submissions (bounty_id, submitter, content) VALUES (?, ?, ?)'
)
const stmtGetAllSubs = db.prepare<
  { id: number; bounty_id: string; submitter: string; content: string; created_at: number },
  [string]
>('SELECT * FROM submissions WHERE bounty_id = ? ORDER BY created_at ASC')
const stmtGetOwnSub = db.prepare<
  { id: number; bounty_id: string; submitter: string; content: string; created_at: number },
  [string, string]
>('SELECT * FROM submissions WHERE bounty_id = ? AND submitter = ?')

// ── CORS headers ──────────────────────────────────────────────────────────────
function cors(res: Response): Response {
  res.headers.set('Access-Control-Allow-Origin', '*')
  res.headers.set('Access-Control-Allow-Methods', 'GET,POST,PATCH,OPTIONS')
  res.headers.set('Access-Control-Allow-Headers', 'Content-Type')
  return res
}

function json(data: unknown, status = 200): Response {
  return cors(Response.json(data, { status }))
}

function err(msg: string, status = 400): Response {
  return json({ error: msg }, status)
}

// ── Router ────────────────────────────────────────────────────────────────────
const server = Bun.serve({
  port: 3001,
  async fetch(req) {
    const url = new URL(req.url)
    const { pathname } = url

    // Preflight
    if (req.method === 'OPTIONS') {
      return cors(new Response(null, { status: 204 }))
    }

    // POST /api/bounties/:id/register — register a bounty (ensure row exists)
    const registerMatch = pathname.match(/^\/api\/bounties\/([^/]+)\/register$/)
    if (registerMatch && req.method === 'POST') {
      const bountyId = registerMatch[1]
      stmtUpsertBounty.run(bountyId)
      return json({ ok: true })
    }

    // GET /api/bounties/:id/submissions?viewer=0x...
    const subsMatch = pathname.match(/^\/api\/bounties\/([^/]+)\/submissions$/)
    if (subsMatch && req.method === 'GET') {
      const bountyId = subsMatch[1]
      const viewer = (url.searchParams.get('viewer') ?? '').toLowerCase()
      // poster param lets the poster see all
      const poster = (url.searchParams.get('poster') ?? '').toLowerCase()

      const bountyRow = stmtGetBounty.get(bountyId)
      const isPublic = bountyRow?.is_public === 1
      const isPublicOrPoster = isPublic || (poster && viewer === poster)

      if (isPublicOrPoster) {
        const subs = stmtGetAllSubs.all(bountyId)
        return json({ submissions: subs, is_public: isPublic })
      }
      // Private: only own submission
      if (viewer) {
        const own = stmtGetOwnSub.get(bountyId, viewer)
        return json({ submissions: own ? [own] : [], is_public: false })
      }
      return json({ submissions: [], is_public: false })
    }

    // POST /api/bounties/:id/submissions — submit work
    if (subsMatch && req.method === 'POST') {
      const bountyId = subsMatch[1]
      let body: { submitter?: string; content?: string }
      try { body = await req.json() } catch { return err('Invalid JSON') }

      const submitter = (body.submitter ?? '').toLowerCase()
      const content = (body.content ?? '').trim()

      if (!submitter || !/^0x[0-9a-f]{40}$/i.test(submitter)) return err('Invalid submitter address')
      if (!content) return err('Content is required')
      // Allow up to 5 MB for base64-encoded file uploads; text capped at 1000 chars
      const MAX_BYTES = 5 * 1024 * 1024
      const isDataUrl = content.startsWith('data:')
      if (!isDataUrl && content.length > 1000) return err('Content too long (max 1000 chars)')
      if (isDataUrl && content.length > MAX_BYTES) return err('File too large (max 5 MB)')

      // Ensure bounty row exists
      stmtUpsertBounty.run(bountyId)

      // Check for duplicate
      const existing = stmtGetOwnSub.get(bountyId, submitter)
      if (existing) return err('Already submitted to this bounty', 409)

      stmtInsertSubmission.run(bountyId, submitter, content)
      return json({ ok: true }, 201)
    }

    // PATCH /api/bounties/:id/visibility — poster toggles public/private
    const visMatch = pathname.match(/^\/api\/bounties\/([^/]+)\/visibility$/)
    if (visMatch && req.method === 'PATCH') {
      const bountyId = visMatch[1]
      let body: { is_public?: boolean }
      try { body = await req.json() } catch { return err('Invalid JSON') }
      const val = body.is_public ? 1 : 0
      stmtUpsertBounty.run(bountyId)
      stmtSetVisibility.run(val, bountyId)
      return json({ ok: true, is_public: val === 1 })
    }

    // Health check
    if (pathname === '/api/health' && req.method === 'GET') {
      return json({ ok: true })
    }

    return json({ error: 'Not found' }, 404)
  },
})

console.log(`Submissions server running on http://localhost:${server.port}`)
