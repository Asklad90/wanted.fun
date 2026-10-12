/**
 * Client for the Wanted.fun submissions backend (Supabase Edge Function `wanted-api`).
 *
 * Money lives on-chain in WantedEscrow. Submissions (notes, links, images, videos) live off-chain so
 * workers never pay gas. Everything is authenticated with free wallet signatures (personal_sign).
 *
 * The signed message formats MUST match supabase/functions/wanted-api/index.ts exactly.
 */
import { CHAIN_ID, CONTRACT_ADDRESS } from '../bounty-config'

export const API_URL =
  (import.meta.env.VITE_SUBMISSIONS_API_URL as string | undefined) ||
  'https://ezylfuchhqhbnuuqotxv.supabase.co/functions/v1/wanted-api'

// Optional: the backend works without a key. If you set VITE_SUPABASE_ANON_KEY it is sent as well.
const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

const MB = 1024 * 1024
export const LIMITS = { note: 1000, links: 5, files: 4, imageBytes: 5 * MB, videoBytes: 25 * MB }
export const ACCEPT = 'image/png,image/jpeg,image/webp,video/mp4,video/webm'
const EXT_TYPES: Record<string, string> = {
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', mp4: 'video/mp4', webm: 'video/webm',
}

const contract = CONTRACT_ADDRESS.toLowerCase()

export type SignFn = (message: string) => Promise<string>

export interface SubmissionFile { name: string; type: string; size: number; url: string | null }
export interface RemoteSubmission {
  id: string
  bountyId: number
  submitter: string
  note: string
  links: string[]
  createdAt: string
  files: SubmissionFile[]
}

// ---- message formats (identical to the backend) ----
const submitMessage = (bountyId: number, hash: string, signedAt: number) =>
  `Wanted.fun submission\nChain: ${CHAIN_ID}\nContract: ${contract}\nBounty: ${bountyId}\nContent hash: ${hash}\nSigned at: ${signedAt}`
const readMessage = (scope: string, signedAt: number) =>
  `Wanted.fun read access\nChain: ${CHAIN_ID}\nContract: ${contract}\nScope: ${scope}\nSigned at: ${signedAt}`

async function sha256Hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

async function call<T>(body: Record<string, unknown>): Promise<T> {
  let res: Response
  try {
    res = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(ANON_KEY ? { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` } : {}),
      },
      body: JSON.stringify({ chainId: CHAIN_ID, contract, ...body }),
    })
  } catch {
    throw new Error('Network error. Check your connection and try again.')
  }
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error((data as { error?: string })?.error ?? 'Request failed.')
  return data as T
}

/** Normalise a picked file so it always has a proper MIME type (some phones leave it empty). */
export function normaliseFile(file: File): File {
  if (file.type) return file
  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
  const type = EXT_TYPES[ext]
  return type ? new File([file], file.name, { type }) : file
}

/** Returns an error message if the file is not allowed, otherwise null. */
export function checkFile(file: File): string | null {
  const isImage = ['image/png', 'image/jpeg', 'image/webp'].includes(file.type)
  const isVideo = ['video/mp4', 'video/webm'].includes(file.type)
  if (!isImage && !isVideo) return `${file.name}: only png, jpg, webp images and mp4, webm videos are allowed.`
  const max = isImage ? LIMITS.imageBytes : LIMITS.videoBytes
  if (file.size > max) return `${file.name} is too big (max ${max / MB} MB for ${isImage ? 'images' : 'videos'}). Paste a link for bigger files.`
  if (file.size === 0) return `${file.name} is empty.`
  return null
}

async function uploadTo(signedUrl: string, file: File, authHeaders: Record<string, string>): Promise<void> {
  const body = new FormData()
  body.append('cacheControl', '3600')
  body.append('', file)
  let res: Response
  try {
    res = await fetch(signedUrl, {
      method: 'PUT',
      body,
      headers: { ...authHeaders, 'x-upsert': 'false' },
    })
  } catch {
    throw new Error('File upload failed (network). Try again or paste a link instead.')
  }
  if (!res.ok) throw new Error('File upload failed. Try again or paste a link instead.')
}

export interface SendArgs { bountyId: bigint; submitter: string; note: string; links: string[]; files: File[] }

/** Free submission: sign a message (no gas), save the work, upload files, finalize. */
export async function sendSubmission(args: SendArgs, sign: SignFn, onStep?: (s: string) => void): Promise<void> {
  const note = args.note.trim()
  const links = args.links.map((l) => l.trim()).filter(Boolean)
  const files = args.files.map(normaliseFile)
  if (!note && !links.length && !files.length) throw new Error('Add a note, a link or a file first.')
  if (note.length > LIMITS.note) throw new Error(`Note is too long (max ${LIMITS.note} characters).`)
  if (links.length > LIMITS.links) throw new Error(`Too many links (max ${LIMITS.links}).`)
  if (files.length > LIMITS.files) throw new Error(`Too many files (max ${LIMITS.files}).`)
  for (const l of links) {
    let u: URL
    try { u = new URL(l) } catch { throw new Error(`"${l}" is not a valid link.`) }
    if (u.protocol !== 'https:') throw new Error('Links must start with https://')
  }
  for (const f of files) {
    const err = checkFile(f)
    if (err) throw new Error(err)
  }

  const bountyId = Number(args.bountyId)
  const meta = files.map((f) => ({ name: f.name, type: f.type, size: f.size }))
  const hash = await sha256Hex(JSON.stringify({ note, links, files: meta.map((f) => ({ type: f.type, size: f.size })) }))
  const signedAt = Math.floor(Date.now() / 1000)

  onStep?.('Approve the signature in your wallet (free, no gas)...')
  const signature = await sign(submitMessage(bountyId, hash, signedAt))

  onStep?.('Saving your submission...')
  const prep = await call<{ submissionId: string; uploads: { type: string; signedUrl: string }[]; uploadHeaders: Record<string, string> }>({
    action: 'prepare', bountyId, submitter: args.submitter, note, links, files: meta, signedAt, signature,
  })
  for (let i = 0; i < files.length; i++) {
    onStep?.(`Uploading file ${i + 1} of ${files.length}...`)
    await uploadTo(prep.uploads[i].signedUrl, files[i], prep.uploadHeaders ?? {})
  }
  onStep?.('Finishing up...')
  await call({ action: 'finalize', bountyId, submitter: args.submitter, submissionId: prep.submissionId })
}

// ---- private reads (poster sees everything, workers only their own) ----
const authKey = (scope: string, who: string) => `wf:auth:${CHAIN_ID}:${contract}:${scope}:${who.toLowerCase()}`

export function hasCachedAuth(scope: string, who: string): boolean {
  try {
    const c = JSON.parse(sessionStorage.getItem(authKey(scope, who)) ?? 'null')
    return !!c && Date.now() / 1000 - c.signedAt < 3000
  } catch { return false }
}

async function readAuth(scope: string, who: string, sign: SignFn, fresh = false) {
  const key = authKey(scope, who)
  if (!fresh && hasCachedAuth(scope, who)) return JSON.parse(sessionStorage.getItem(key)!) as { signedAt: number; signature: string }
  const signedAt = Math.floor(Date.now() / 1000)
  const signature = await sign(readMessage(scope, signedAt))
  const auth = { signedAt, signature }
  try { sessionStorage.setItem(key, JSON.stringify(auth)) } catch { /* private mode: fine */ }
  return auth
}

async function authedCall<T>(scope: string, who: string, sign: SignFn, body: Record<string, unknown>): Promise<T> {
  try {
    return await call<T>({ ...body, requester: who, ...(await readAuth(scope, who, sign)) })
  } catch (e) {
    if (e instanceof Error && /expired|signature/i.test(e.message)) {
      return await call<T>({ ...body, requester: who, ...(await readAuth(scope, who, sign, true)) })
    }
    throw e
  }
}

export function listSubmissions(bountyId: number, who: string, sign: SignFn) {
  return authedCall<{ role: 'poster' | 'worker'; submissions: RemoteSubmission[] }>(
    `bounty:${bountyId}`, who, sign, { action: 'list', bountyId },
  )
}

export function mySubmissions(who: string, sign: SignFn) {
  return authedCall<{ submissions: { id: string; bountyId: number; createdAt: string }[] }>(
    'mine', who, sign, { action: 'mine' },
  )
}

/** Public: how many submissions each bounty has (no signature needed). */
export async function fetchCounts(bountyIds: number[]): Promise<Record<string, number>> {
  if (!bountyIds.length) return {}
  try {
    const r = await call<{ counts: Record<string, number> }>({ action: 'counts', bountyIds: bountyIds.slice(0, 100) })
    return r.counts
  } catch { return {} }
}
