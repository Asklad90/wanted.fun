/**
 * Shared Postgres client for Vercel serverless functions.
 * Uses @vercel/postgres (bundled by Vercel).
 * Reads POSTGRES_URL or DATABASE_URL from environment.
 *
 * The pool is created lazily (not at import time) so a missing/invalid
 * connection string produces a readable JSON error from the handler
 * instead of crashing the whole function with an HTML 500 page.
 */
import { createPool, type VercelPool } from '@vercel/postgres'

/**
 * @vercel/postgres only accepts POOLED connection strings. Neon direct URLs
 * (host like ep-xxx.region.aws.neon.tech) are rejected, so if we see a direct
 * Neon host we switch to its pooled twin (ep-xxx-pooler...). Any other URL,
 * or one that is already pooled, is returned untouched.
 */
function toPooledUrl(raw: string): string {
  try {
    const url = new URL(raw)
    const isNeon = url.hostname.endsWith('.neon.tech')
    const alreadyPooled = url.hostname.includes('-pooler.')
    if (isNeon && !alreadyPooled) {
      const [first, ...rest] = url.hostname.split('.')
      url.hostname = [`${first}-pooler`, ...rest].join('.')
      return url.toString()
    }
  } catch {
    // not a parseable URL — let the driver report the problem
  }
  return raw
}

let _pool: VercelPool | null = null

export function getPool(): VercelPool {
  if (_pool) return _pool
  const raw = process.env.POSTGRES_URL ?? process.env.DATABASE_URL
  if (!raw) {
    throw new Error(
      'No database connection string found. Set POSTGRES_URL or DATABASE_URL in Vercel environment variables (Production) and redeploy.'
    )
  }
  _pool = createPool({ connectionString: toPooledUrl(raw) })
  return _pool
}

/** Same `pool.sql\`...\`` call shape the handlers already use. */
export const pool = {
  sql: ((strings: TemplateStringsArray, ...values: unknown[]) =>
    getPool().sql(strings, ...(values as never[]))) as VercelPool['sql'],
}

let schemaReady: Promise<void> | null = null

/** Ensure tables exist — runs once per cold start. */
export function ensureSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = (async () => {
      await pool.sql`
        CREATE TABLE IF NOT EXISTS bounties (
          id TEXT PRIMARY KEY,
          is_public BOOLEAN NOT NULL DEFAULT FALSE
        )
      `
      await pool.sql`
        CREATE TABLE IF NOT EXISTS submissions (
          id SERIAL PRIMARY KEY,
          bounty_id TEXT NOT NULL,
          submitter TEXT NOT NULL,
          content TEXT NOT NULL,
          created_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT,
          UNIQUE(bounty_id, submitter)
        )
      `
    })().catch((e) => {
      schemaReady = null // allow retry on next request
      throw e
    })
  }
  return schemaReady
}
