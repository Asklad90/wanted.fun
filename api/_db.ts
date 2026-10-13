/**
 * Shared Neon Postgres client for Vercel serverless functions.
 * DATABASE_URL is set in Vercel environment variables (and locally in .env).
 */
import { neon } from '@neondatabase/serverless'

const sql = neon(process.env.DATABASE_URL!)

/** Ensure tables exist — called at cold start of each function. */
export async function ensureSchema(): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS bounties (
      id TEXT PRIMARY KEY,
      is_public BOOLEAN NOT NULL DEFAULT FALSE
    )
  `
  await sql`
    CREATE TABLE IF NOT EXISTS submissions (
      id SERIAL PRIMARY KEY,
      bounty_id TEXT NOT NULL,
      submitter TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT,
      UNIQUE(bounty_id, submitter)
    )
  `
}

export { sql }
