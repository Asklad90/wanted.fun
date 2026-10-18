/**
 * Resolve + persist a bounty's poster address from the escrow contract (source of truth).
 *
 * Why this exists: access control for submissions ("poster sees all, submitters
 * see only their own") depends on bounties.poster being filled in. It used to
 * be written only by /register, which could only reach the Arc *testnet* RPC — so on
 * mainnet the poster was never saved and the real poster was treated like any
 * other submitter (saw 1 of N submissions).
 */
import { createPublicClient, http } from 'viem'
import { pool } from './_db.js'

const GET_BOUNTY_POSTER_ABI = [
  {
    type: 'function',
    name: 'getBounty',
    inputs: [{ name: 'id', type: 'uint256' }],
    outputs: [
      {
        type: 'tuple',
        components: [
          { name: 'id', type: 'uint256' },
          { name: 'poster', type: 'address' },
          { name: 'title', type: 'bytes' },
          { name: 'description', type: 'bytes' },
          { name: 'rewardPerWinner', type: 'uint256' },
          { name: 'maxWinners', type: 'uint256' },
          { name: 'winnersApproved', type: 'uint256' },
          { name: 'deadline', type: 'uint64' },
          { name: 'escrowRemaining', type: 'uint256' },
          { name: 'reclaimedUnused', type: 'bool' },
          { name: 'cancelled', type: 'bool' },
        ],
      },
    ],
    stateMutability: 'view',
  },
] as const

const DEFAULT_RPC: Record<string, string> = {
  '5042': 'https://rpc.mainnet.arc.io', // Arc Mainnet
  '5042002': 'https://rpc.testnet.arc.io', // Arc Testnet
}

function getRpcUrl(): string {
  if (process.env.VITE_RPC_URL) return process.env.VITE_RPC_URL
  const chainId = process.env.VITE_CHAIN_ID ?? '5042002'
  const proxyBase = process.env.RPC_PROXY_BASE_URL
  const proxyToken = process.env.RPC_PROXY_TOKEN
  const proxyChains = (process.env.RPC_PROXY_CHAINS ?? '').split(',').map(s => s.trim())
  if (chainId === '5042002' && proxyBase && proxyToken && proxyChains.includes('Arc_Testnet')) {
    return `${proxyBase}/api/rpc/Arc_Testnet?_rpc_token=${proxyToken}`
  }
  return DEFAULT_RPC[chainId] ?? ''
}

/** Read the poster of a bounty straight from the contract. Returns null if unavailable. */
export async function readOnchainPoster(bountyId: string): Promise<string | null> {
  const contract = process.env.VITE_CONTRACT_ADDRESS ?? ''
  const rpcUrl = getRpcUrl()
  if (!rpcUrl || !/^0x[0-9a-fA-F]{40}$/.test(contract) || !/^\d+$/.test(bountyId)) return null
  try {
    const client = createPublicClient({ transport: http(rpcUrl) })
    const bounty = (await client.readContract({
      address: contract as `0x${string}`,
      abi: GET_BOUNTY_POSTER_ABI,
      functionName: 'getBounty',
      args: [BigInt(bountyId)],
    })) as { poster: string }
    const poster = bounty.poster.toLowerCase()
    return /^0x[0-9a-f]{40}$/.test(poster) && poster !== '0x0000000000000000000000000000000000000000'
      ? poster
      : null
  } catch (e) {
    console.error('readOnchainPoster failed:', e)
    return null
  }
}

// ── Bounty keys ─────────────────────────────────────────────────────────────
// Bounty ids are only unique per contract (every deployment/chain starts again at 1).
// Arc testnet keeps the original un-prefixed ids so existing rows stay as they were;
// every other chain/contract gets its own namespace so ids can never collide.
function namespace(): string {
  const chainId = process.env.VITE_CHAIN_ID ?? '5042002'
  if (chainId === '5042002') return ''
  const contract = (process.env.VITE_CONTRACT_ADDRESS ?? '').toLowerCase().replace(/^0x/, '').slice(0, 6)
  return `${chainId}-${contract}:`
}

/** Internal DB key for a bounty id as the client knows it. */
export function bountyKey(id: string): string {
  return namespace() + id
}

/** Inverse of bountyKey; null if the key belongs to another chain/contract. */
export function fromBountyKey(key: string): string | null {
  const ns = namespace()
  if (ns) return key.startsWith(ns) ? key.slice(ns.length) : null
  return key.includes(':') ? null : key
}

// ── Poster ──────────────────────────────────────────────────────────────────
// A bounty's poster never changes, so a positive lookup is cached for this instance.
const posterCache = new Map<string, string>()

/**
 * The bounty's poster (lowercase), taken from the escrow contract — the only source of truth.
 * Never falls back to a stored value (it can be stale, e.g. an id reused on another chain):
 * if the chain can't be read this returns null and the caller must fail closed.
 * bounties.poster is kept in sync for reference only; access control never reads it.
 */
export async function ensurePoster(bountyId: string): Promise<string | null> {
  const key = bountyKey(bountyId)
  const cached = posterCache.get(key)
  if (cached) return cached

  const onchain = await readOnchainPoster(bountyId)
  if (!onchain) return null
  posterCache.set(key, onchain)

  await pool.sql`
    INSERT INTO bounties (id, is_public, poster)
    VALUES (${key}, FALSE, ${onchain})
    ON CONFLICT (id) DO UPDATE SET poster = ${onchain}
  `
  return onchain
}
