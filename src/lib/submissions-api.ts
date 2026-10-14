/**
 * Off-chain submissions API client.
 * All calls go through the Vite proxy at /api → http://localhost:3001
 *
 * Mutating calls (POST/PATCH) include a wallet-signed auth payload so the
 * server can verify the caller's identity without trusting the request body.
 */

import { getWalletClient } from '@wagmi/core'
import { config } from '../config'

// ── Auth helpers ─────────────────────────────────────────────────────────────

type AuthAction = 'submit' | 'visibility' | 'examples' | 'register'

function buildAuthMessage(action: AuthAction, bountyId: string, timestamp: number): string {
  return `want.fun:${action}:${bountyId}:${timestamp}`
}

async function signAuth(
  action: AuthAction,
  bountyId: string,
): Promise<{ address: string; timestamp: number; signature: string } | null> {
  try {
    const walletClient = await getWalletClient(config)
    if (!walletClient) return null
    const address = walletClient.account.address
    const timestamp = Math.floor(Date.now() / 1000)
    const message = buildAuthMessage(action, bountyId, timestamp)
    const signature = await walletClient.signMessage({ message })
    return { address: address.toLowerCase(), timestamp, signature }
  } catch {
    return null
  }
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface OffchainSubmission {
  id: number
  bounty_id: string
  submitter: string
  content: string
  created_at: number
}

export interface SubmissionsResponse {
  submissions: OffchainSubmission[]
  is_public: boolean
}

// ── API calls ─────────────────────────────────────────────────────────────────

/** Register a bounty so it has a row in the DB (idempotent). */
export async function registerBounty(bountyId: string): Promise<void> {
  await fetch(`/api/bounties/${bountyId}/register`, { method: 'POST' })
}

/**
 * Fetch submissions.
 * @param viewer  connected wallet address (lowercase) — sees own sub when private
 * @param poster  bounty poster address (lowercase) — sees all subs
 */
export async function fetchSubmissions(
  bountyId: string,
  viewer?: string,
  poster?: string,
): Promise<SubmissionsResponse> {
  const params = new URLSearchParams()
  if (viewer) params.set('viewer', viewer.toLowerCase())
  if (poster) params.set('poster', poster.toLowerCase())
  const res = await fetch(`/api/bounties/${bountyId}/submissions?${params}`)
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Failed to fetch submissions: ${res.status} ${body}`)
  }
  return res.json() as Promise<SubmissionsResponse>
}

/**
 * Post a new off-chain submission.
 * Signs a message with the connected wallet to prove identity.
 */
export async function postSubmission(
  bountyId: string,
  submitter: string,
  content: string,
): Promise<{ ok: boolean; error?: string }> {
  const auth = await signAuth('submit', bountyId)
  if (!auth) return { ok: false, error: 'Could not sign submission — please connect your wallet and try again.' }

  const res = await fetch(`/api/bounties/${bountyId}/submissions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      submitter: submitter.toLowerCase(),
      content,
      address: auth.address,
      timestamp: auth.timestamp,
      signature: auth.signature,
    }),
  })
  const text = await res.text()
  let data: { ok?: boolean; error?: string } = {}
  try { data = JSON.parse(text) as typeof data } catch { /* non-JSON response */ }
  if (!res.ok) {
    if (res.status === 413) return { ok: false, error: 'File too large to upload (max 3 MB).' }
    return { ok: false, error: data.error ?? `Server error (${res.status}). Please try again.` }
  }
  return { ok: true }
}

// ── Examples ──────────────────────────────────────────────────────────────────

export interface BountyExample {
  id: number
  bounty_id: string
  content: string
  sort_order: number
  created_at: number
}

/** Fetch poster-uploaded example attachments for a bounty. */
export async function fetchExamples(bountyId: string): Promise<BountyExample[]> {
  try {
    const res = await fetch(`/api/bounties/${bountyId}/examples`)
    if (!res.ok) return []
    const data = await res.json() as { examples: BountyExample[] }
    return data.examples ?? []
  } catch {
    return []
  }
}

/**
 * Save (replace) example attachments for a bounty.
 * Signs a message with the connected wallet to prove the caller is the poster.
 */
export async function saveExamples(
  bountyId: string,
  examples: string[],
): Promise<{ ok: boolean; error?: string }> {
  const auth = await signAuth('examples', bountyId)
  if (!auth) return { ok: false, error: 'Could not sign — please connect your wallet.' }

  const res = await fetch(`/api/bounties/${bountyId}/examples`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      examples,
      address: auth.address,
      timestamp: auth.timestamp,
      signature: auth.signature,
    }),
  })
  const text = await res.text()
  let data: { ok?: boolean; error?: string } = {}
  try { data = JSON.parse(text) as typeof data } catch { /* ignore */ }
  if (!res.ok) return { ok: false, error: data.error ?? `Server error (${res.status})` }
  return { ok: true }
}

/**
 * Toggle public/private visibility for a bounty's submissions.
 * Signs a message with the connected wallet to prove the caller is the poster.
 */
export async function setVisibility(
  bountyId: string,
  isPublic: boolean,
): Promise<void> {
  const auth = await signAuth('visibility', bountyId)
  if (!auth) {
    console.warn('setVisibility: could not sign — wallet not connected')
    return
  }
  await fetch(`/api/bounties/${bountyId}/visibility`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      is_public: isPublic,
      address: auth.address,
      timestamp: auth.timestamp,
      signature: auth.signature,
    }),
  })
}
