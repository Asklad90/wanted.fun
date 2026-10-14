/**
 * Off-chain submissions API client.
 * All calls go through the Vite proxy at /api → http://localhost:3001
 */

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
  poster?: string
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

/** Post a new off-chain submission. */
export async function postSubmission(
  bountyId: string,
  submitter: string,
  content: string
): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch(`/api/bounties/${bountyId}/submissions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ submitter: submitter.toLowerCase(), content }),
  })
  // Read as text first: Vercel error pages (500/413) are not JSON.
  const text = await res.text()
  let data: { ok?: boolean; error?: string; detail?: string } = {}
  try { data = JSON.parse(text) as typeof data } catch { /* non-JSON response */ }
  if (!res.ok) {
    if (res.status === 413) return { ok: false, error: 'File too large to upload (max 3 MB).' }
    return { ok: false, error: data.error ?? `Server error (${res.status}). Please try again.` }
  }
  return { ok: true }
}

/** Toggle public/private visibility for a bounty's submissions. */
export async function setVisibility(
  bountyId: string,
  isPublic: boolean
): Promise<void> {
  await fetch(`/api/bounties/${bountyId}/visibility`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ is_public: isPublic }),
  })
}
