/**
 * Shared Postgres client for Vercel serverless functions.
 * Uses @vercel/postgres which is natively bundled by Vercel.
 * Reads POSTGRES_URL or DATABASE_URL from environment automatically.
 */
import { createPool } from '@vercel/postgres'

// @vercel/postgres reads POSTGRES_URL by default; fall back to DATABASE_URL
const connectionString = process.env.POSTGRES_URL ?? process.env.DATABASE_URL

if (!connectionString) {
  throw new Error('No database connection string found. Set DATABASE_URL in environment variables.')
}

export const pool = createPool({ connectionString })

/** Ensure tables exist — called at cold start of each function. */
export async function ensureSchema(): Promise<void> {
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
}
