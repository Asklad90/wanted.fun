/**
 * Wallet-signature authentication helpers for Vercel API routes.
 *
 * Pattern: the client signs a deterministic message that includes
 *   - the action they are performing
 *   - the bounty ID (where applicable)
 *   - a timestamp (unix seconds, max staleness: AUTH_MAX_AGE_S)
 *
 * The server reconstructs the same message and recovers the signer
 * address using viem's verifyMessage. No nonce storage is needed
 * because the timestamp makes replays expire within AUTH_MAX_AGE_S.
 *
 * Message format (client signs this exact string):
 *   want.fun:{action}:{bountyId}:{timestamp}
 *
 * e.g. want.fun:submit:42:1715000000
 *      want.fun:visibility:42:1715000000
 *      want.fun:examples:42:1715000000
 */

import { verifyMessage } from 'viem'

/** Max age of a signed auth message before it is rejected (5 minutes). */
const AUTH_MAX_AGE_S = 5 * 60

export type AuthAction = 'submit' | 'visibility' | 'examples' | 'register'

/** Build the canonical message a wallet must sign. */
export function buildAuthMessage(
  action: AuthAction,
  bountyId: string,
  timestamp: number,
): string {
  return `want.fun:${action}:${bountyId}:${timestamp}`
}

export interface AuthPayload {
  /** Wallet address (will be lowercased and validated as 0x… 40-hex). */
  address: string
  /** Unix seconds — must be within AUTH_MAX_AGE_S of server time. */
  timestamp: number
  /** EIP-191 signature of buildAuthMessage(action, bountyId, timestamp). */
  signature: string
}

export interface AuthResult {
  ok: true
  address: string // lowercase, checksummed by viem recovery
  error?: never
}

export interface AuthError {
  ok: false
  error: string
  status: number
  address?: never
}

/**
 * Verify a signed auth payload.
 * Returns { ok: true, address } on success, or { ok: false, error, status } on failure.
 */
export async function verifyAuth(
  payload: AuthPayload,
  action: AuthAction,
  bountyId: string,
): Promise<AuthResult | AuthError> {
  const { address, timestamp, signature } = payload

  if (!address || !/^0x[0-9a-fA-F]{40}$/.test(address)) {
    return { ok: false, error: 'Invalid wallet address', status: 400 }
  }
  if (typeof timestamp !== 'number' || !Number.isFinite(timestamp)) {
    return { ok: false, error: 'Invalid timestamp', status: 400 }
  }
  if (typeof signature !== 'string' || !/^0x[0-9a-fA-F]+$/.test(signature)) {
    return { ok: false, error: 'Invalid signature format', status: 400 }
  }

  const nowS = Math.floor(Date.now() / 1000)
  if (Math.abs(nowS - timestamp) > AUTH_MAX_AGE_S) {
    return { ok: false, error: 'Signature expired — please try again', status: 401 }
  }

  const message = buildAuthMessage(action, bountyId, timestamp)

  let valid = false
  try {
    valid = await verifyMessage({
      address: address as `0x${string}`,
      message,
      signature: signature as `0x${string}`,
    })
  } catch {
    return { ok: false, error: 'Signature verification failed', status: 401 }
  }

  if (!valid) {
    return { ok: false, error: 'Signature does not match address', status: 401 }
  }

  return { ok: true, address: address.toLowerCase() }
}
