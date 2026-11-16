/**
 * Wanted.fun off-chain submissions server
 * Bun HTTP server on port 3001 — SQLite (WAL mode) for crash-safe storage.
 * Submissions are stored here; only approveWinner goes onchain.
 */

import { Database } from 'bun:sqlite'
import path from 'path'
import {
  scanLiveGuaranteedBounties,
  LEGACY_EXTERNAL_BOUNTY_IDS,
  isGenericHomepageUrl,
  type ScannedExternalBounty,
} from '../api/_x-scanner'

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
  CREATE TABLE IF NOT EXISTS bounty_examples (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    bounty_id TEXT NOT NULL,
    content TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
  );
  CREATE TABLE IF NOT EXISTS external_bounties (
    id TEXT PRIMARY KEY,
    tweet_id TEXT UNIQUE NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    reward_usdc INTEGER NOT NULL,
    reward_label TEXT NOT NULL DEFAULT 'USDC',
    max_winners INTEGER NOT NULL DEFAULT 1,
    deadline INTEGER NOT NULL,
    poster_handle TEXT NOT NULL,
    poster_name TEXT NOT NULL,
    verified_source TEXT NOT NULL,
    tweet_url TEXT NOT NULL,
    participation_url TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'dev',
    requirements_summary TEXT NOT NULL DEFAULT '',
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
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
const stmtGetExamples = db.prepare<
  { id: number; bounty_id: string; content: string; sort_order: number; created_at: number },
  [string]
>('SELECT * FROM bounty_examples WHERE bounty_id = ? ORDER BY sort_order ASC, created_at ASC')
const stmtDeleteExamples = db.prepare('DELETE FROM bounty_examples WHERE bounty_id = ?')
const stmtInsertExample = db.prepare(
  'INSERT INTO bounty_examples (bounty_id, content, sort_order) VALUES (?, ?, ?)'
)
const stmtUpsertExternalBounty = db.prepare(`
  INSERT INTO external_bounties (
    id, tweet_id, title, description, reward_usdc, reward_label,
    max_winners, deadline, poster_handle, poster_name, verified_source,
    tweet_url, participation_url, category, requirements_summary, created_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT(id) DO UPDATE SET
    title = excluded.title,
    description = excluded.description,
    reward_usdc = excluded.reward_usdc,
    reward_label = excluded.reward_label,
    max_winners = excluded.max_winners,
    deadline = excluded.deadline,
    poster_handle = excluded.poster_handle,
    poster_name = excluded.poster_name,
    verified_source = excluded.verified_source,
    tweet_url = excluded.tweet_url,
    participation_url = excluded.participation_url,
    category = excluded.category,
    requirements_summary = excluded.requirements_summary
`)
const stmtGetActiveExternalBounties = db.prepare<ScannedExternalBounty, [number, number]>(
  'SELECT * FROM external_bounties WHERE deadline > ? ORDER BY (deadline > ?) DESC, reward_usdc DESC, deadline ASC LIMIT 24'
)
const stmtGetSingleExternalBounty = db.prepare<ScannedExternalBounty, [string]>(
  'SELECT * FROM external_bounties WHERE id = ? LIMIT 1'
)

function purgeStaleExternalBountiesSqlite() {
  const legacySet = new Set<string>(LEGACY_EXTERNAL_BOUNTY_IDS)
  const rows = db.prepare<{ id: string; tweet_url: string; participation_url: string }, []>(
    'SELECT id, tweet_url, participation_url FROM external_bounties'
  ).all()
  const del = db.prepare('DELETE FROM external_bounties WHERE id = ?')
  for (const r of rows) {
    const isBareXProfile = /^https?:\/\/(?:x\.com|twitter\.com)\/[A-Za-z0-9_]+\/?$/i.test(r.tweet_url || '')
    if (legacySet.has(r.id) || isBareXProfile || isGenericHomepageUrl(r.participation_url || '')) {
      del.run(r.id)
    }
  }
}

function saveExternalBountiesToSqlite(bounties: ScannedExternalBounty[]) {
  for (const b of bounties) {
    stmtUpsertExternalBounty.run(
      b.id,
      b.tweet_id,
      b.title,
      b.description,
      b.reward_usdc,
      b.reward_label,
      b.max_winners,
      b.deadline,
      b.poster_handle,
      b.poster_name,
      b.verified_source,
      b.tweet_url,
      b.participation_url,
      b.category,
      b.requirements_summary,
      b.created_at,
    )
  }
}

// ── CORS headers ─────────────────────────────────────────────────────────────
// In local dev the frontend is on the same Vite dev server (proxied), so
// we only need CORS for direct curl / local testing; in production, Vercel
// sets the header. Here we restrict to localhost origins only.
const ALLOWED_ORIGINS = new Set([
  'http://localhost:5173',
  'http://localhost:3000',
  'http://127.0.0.1:5173',
])

function cors(res: Response, origin?: string): Response {
  const allowed = origin && ALLOWED_ORIGINS.has(origin) ? origin : 'http://localhost:5173'
  res.headers.set('Access-Control-Allow-Origin', allowed)
  res.headers.set('Access-Control-Allow-Methods', 'GET,POST,PATCH,OPTIONS')
  res.headers.set('Access-Control-Allow-Headers', 'Content-Type')
  res.headers.set('Vary', 'Origin')
  return res
}

function json(data: unknown, status = 200, origin?: string): Response {
  return cors(Response.json(data, { status }), origin)
}

function err(msg: string, status = 400, origin?: string): Response {
  return json({ error: msg }, status, origin)
}

// ── Rate limiters ──────────────────────────────────────────────────────────
interface Bucket { count: number; resetAt: number }
const buckets = new Map<string, Bucket>()

function isRateLimited(key: string, max: number, windowMs: number): boolean {
  const now = Date.now()
  const existing = buckets.get(key)
  if (!existing || now > existing.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    return false
  }
  existing.count++
  return existing.count > max
}

function clientIp(req: Request): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown'
}

// ── Router ────────────────────────────────────────────────────────────────────
const server = Bun.serve({
  port: 3001,
  async fetch(req) {
    const url = new URL(req.url)
    const { pathname } = url
    const origin = req.headers.get('origin') ?? undefined
    const ip = clientIp(req)

    // Preflight
    if (req.method === 'OPTIONS') {
      return cors(new Response(null, { status: 204 }), origin)
    }

    // POST /api/bounties/:id/register — register a bounty (ensure row exists)
    const registerMatch = pathname.match(/^\/api\/bounties\/([^/]+)\/register$/)
    if (registerMatch && req.method === 'POST') {
      if (isRateLimited(`reg:${ip}`, 20, 10 * 60 * 1000)) return err('Too many requests', 429, origin)
      const bountyId = registerMatch[1]
      if (!bountyId || bountyId.length > 200) return err('Invalid bounty id', 400, origin)
      stmtUpsertBounty.run(bountyId)
      return json({ ok: true }, 200, origin)
    }

    if (registerMatch) return err('Method not allowed', 405, origin)

    // GET /api/bounties/:id/submissions?viewer=0x...
    const subsMatch = pathname.match(/^\/api\/bounties\/([^/]+)\/submissions$/)
    if (subsMatch && req.method === 'GET') {
      if (isRateLimited(`sget:${ip}`, 60, 60 * 1000)) return err('Too many requests', 429, origin)
      const bountyId = subsMatch[1]
      const viewer = (url.searchParams.get('viewer') ?? '').toLowerCase()
      const poster = (url.searchParams.get('poster') ?? '').toLowerCase()

      if (viewer && !/^0x[0-9a-f]{40}$/.test(viewer)) return err('Invalid viewer address', 400, origin)
      if (poster && !/^0x[0-9a-f]{40}$/.test(poster)) return err('Invalid poster address', 400, origin)

      const bountyRow = stmtGetBounty.get(bountyId)
      const isPublic = bountyRow?.is_public === 1
      // Poster must match DB record (if recorded) — otherwise fall back to param comparison
      const isPublicOrPoster = isPublic || (poster && viewer === poster)

      if (isPublicOrPoster) {
        const subs = stmtGetAllSubs.all(bountyId)
        return json({ submissions: subs, is_public: isPublic }, 200, origin)
      }
      if (viewer) {
        const own = stmtGetOwnSub.get(bountyId, viewer)
        return json({ submissions: own ? [own] : [], is_public: false }, 200, origin)
      }
      return json({ submissions: [], is_public: false }, 200, origin)
    }

    // POST /api/bounties/:id/submissions — submit work
    if (subsMatch && req.method === 'POST') {
      if (isRateLimited(`spost:${ip}`, 5, 10 * 60 * 1000))
        return err('Too many submissions. Please wait a few minutes and try again.', 429, origin)

      const bountyId = subsMatch[1]
      let body: { submitter?: string; content?: string }
      try { body = await req.json() } catch { return err('Invalid JSON', 400, origin) }

      const submitter = (body.submitter ?? '').toLowerCase()
      const content = (body.content ?? '').trim()

      if (!submitter || !/^0x[0-9a-f]{40}$/i.test(submitter)) return err('Invalid submitter address', 400, origin)
      if (!content) return err('Content is required', 400, origin)

      // Per-wallet rate limit
      if (isRateLimited(`sw:${submitter}`, 3, 10 * 60 * 1000))
        return err('Too many submissions from this wallet. Please wait.', 429, origin)

      const MAX_BYTES = 4_300_000
      const isDataUrl = content.startsWith('data:')
      if (!isDataUrl && content.length > 1000) return err('Content too long (max 1000 chars)', 400, origin)
      if (isDataUrl && content.length > MAX_BYTES) return err('File too large (max 3 MB)', 400, origin)
      if (!isDataUrl && /javascript\s*:/i.test(content)) return err('Content contains disallowed links', 400, origin)

      stmtUpsertBounty.run(bountyId)
      const existing = stmtGetOwnSub.get(bountyId, submitter)
      if (existing) return err('Already submitted to this bounty', 409, origin)

      stmtInsertSubmission.run(bountyId, submitter, content)
      return json({ ok: true }, 201, origin)
    }

    if (subsMatch) return err('Method not allowed', 405, origin)

    // GET/POST /api/bounties/:id/examples — poster example attachments
    const examplesMatch = pathname.match(/^\/api\/bounties\/([^/]+)\/examples$/)
    if (examplesMatch && req.method === 'GET') {
      if (isRateLimited(`eget:${ip}`, 60, 60 * 1000)) return err('Too many requests', 429, origin)
      const bountyId = examplesMatch[1]
      const examples = stmtGetExamples.all(bountyId)
      return json({ examples }, 200, origin)
    }
    if (examplesMatch && req.method === 'POST') {
      if (isRateLimited(`epost:${ip}`, 10, 10 * 60 * 1000)) return err('Too many requests', 429, origin)
      const bountyId = examplesMatch[1]
      let body: { examples?: string[] }
      try { body = await req.json() } catch { return err('Invalid JSON', 400, origin) }
      const examples = body.examples ?? []
      if (!Array.isArray(examples)) return err('examples must be an array', 400, origin)
      if (examples.length > 5) return err('Max 5 examples allowed', 400, origin)
      const MAX_EX = 4_300_000
      for (const ex of examples) {
        if (typeof ex !== 'string' || ex.length > MAX_EX) return err('Example too large (max 3 MB)', 400, origin)
      }
      stmtDeleteExamples.run(bountyId)
      for (let i = 0; i < examples.length; i++) stmtInsertExample.run(bountyId, examples[i], i)
      return json({ ok: true }, 200, origin)
    }

    if (examplesMatch) return err('Method not allowed', 405, origin)

    // PATCH /api/bounties/:id/visibility — poster toggles public/private
    const visMatch = pathname.match(/^\/api\/bounties\/([^/]+)\/visibility$/)
    if (visMatch && req.method === 'PATCH') {
      if (isRateLimited(`vis:${ip}`, 10, 10 * 60 * 1000)) return err('Too many requests', 429, origin)
      const bountyId = visMatch[1]
      let body: { is_public?: boolean }
      try { body = await req.json() } catch { return err('Invalid JSON', 400, origin) }
      if (typeof body.is_public !== 'boolean') return err('is_public must be a boolean', 400, origin)
      const val = body.is_public ? 1 : 0
      stmtUpsertBounty.run(bountyId)
      stmtSetVisibility.run(val, bountyId)
      return json({ ok: true, is_public: val === 1 }, 200, origin)
    }

    if (visMatch) return err('Method not allowed', 405, origin)

    // GET / POST /api/external-bounties — live external bounties scanner & feed
    if (pathname === '/api/external-bounties') {
      const nowSec = Math.floor(Date.now() / 1000)
      const hideCutoff = nowSec - 3 * 24 * 60 * 60
      const isSync = req.method === 'POST' || url.searchParams.get('sync') === '1'
      if (isSync) {
        if (isRateLimited(`extsync:${ip}`, 10, 5 * 60 * 1000)) return err('Too many sync requests', 429, origin)
        purgeStaleExternalBountiesSqlite()
        const { bounties: scanned, source } = await scanLiveGuaranteedBounties()
        saveExternalBountiesToSqlite(scanned)
        const active = stmtGetActiveExternalBounties.all(hideCutoff, nowSec)
        return json({ ok: true, source, bounties: active, synced_at: nowSec }, 200, origin)
      }

      if (req.method === 'GET') {
        if (isRateLimited(`extget:${ip}`, 60, 60 * 1000)) return err('Too many requests', 429, origin)
        purgeStaleExternalBountiesSqlite()
        const singleId = url.searchParams.get('id')
        if (singleId) {
          let row = stmtGetSingleExternalBounty.get(singleId)
          if (!row) {
            const { bounties: scanned } = await scanLiveGuaranteedBounties()
            saveExternalBountiesToSqlite(scanned)
            row = stmtGetSingleExternalBounty.get(singleId)
          }
          if (!row) return err('External bounty not found', 404, origin)
          return json({ bounty: row }, 200, origin)
        }

        let active = stmtGetActiveExternalBounties.all(hideCutoff, nowSec)
        const liveCount = active.filter(b => Number(b.deadline) > nowSec).length
        if (liveCount < 10) {
          const { bounties: scanned } = await scanLiveGuaranteedBounties()
          saveExternalBountiesToSqlite(scanned)
          active = stmtGetActiveExternalBounties.all(hideCutoff, nowSec)
        }
        return json({ bounties: active, synced_at: nowSec }, 200, origin)
      }
      return err('Method not allowed', 405, origin)
    }

    // Health check
    if (pathname === '/api/health' && req.method === 'GET') {
      return json({ ok: true }, 200, origin)
    }

    return json({ error: 'Not found' }, 404, origin)
  },
})

console.log(`Submissions server running on http://localhost:${server.port}`)
