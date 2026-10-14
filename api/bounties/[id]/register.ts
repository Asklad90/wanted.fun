import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createPublicClient, http } from 'viem'
import { pool, ensureSchema } from '../../_db.js'
import { createRateLimiter, getClientIp } from '../../_rate-limit.js'

// 20 register calls per IP per 10-minute window (idempotent, but cap spam)
const limiter = createRateLimiter({ windowMs: 10 * 60 * 1000, max: 20 })

const WANTED_ESCROW_GET_BOUNTY_ABI = [
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

function getRpcUrl(): string {
  const proxyBase = process.env.RPC_PROXY_BASE_URL
  const proxyToken = process.env.RPC_PROXY_TOKEN
  const proxyChains = (process.env.RPC_PROXY_CHAINS ?? '').split(',').map(s => s.trim())
  if (proxyBase && proxyToken && proxyChains.includes('Arc_Testnet')) {
    return `${proxyBase}/api/rpc/Arc_Testnet?_rpc_token=${proxyToken}`
  }
  // Fallback: use the chain's public RPC from the VITE_ env var if set,
  // otherwise leave undefined (verification will be skipped gracefully)
  return process.env.VITE_RPC_URL ?? ''
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const ip = getClientIp(req.headers as Record<string, string | string[] | undefined>)
  if (limiter.isLimited(ip)) return res.status(429).json({ error: 'Too many requests' })

  try {
    const bountyId = req.query.id as string
    if (!bountyId || typeof bountyId !== 'string' || bountyId.length > 200)
      return res.status(400).json({ error: 'Missing or invalid bounty id' })

    const body = req.body as { poster?: string } | undefined
    const claimedPoster = ((body?.poster ?? '') as string).toLowerCase()
    const validClaim = /^0x[0-9a-f]{40}$/.test(claimedPoster)

    await ensureSchema()

    // Check if poster is already recorded — if so, nothing to do
    const { rows } = await pool.sql`SELECT poster FROM bounties WHERE id = ${bountyId}`
    const existing = rows[0] as { poster: string | null } | undefined
    if (existing?.poster) {
      return res.status(200).json({ ok: true })
    }

    // If a poster address was claimed, verify it onchain before trusting it
    let verifiedPoster: string | null = null
    if (validClaim) {
      const rpcUrl = getRpcUrl()
      const contractAddress = (process.env.VITE_CONTRACT_ADDRESS ?? '') as `0x${string}`
      if (rpcUrl && contractAddress && /^0x[0-9a-fA-F]{40}$/.test(contractAddress)) {
        try {
          const client = createPublicClient({ transport: http(rpcUrl) })
          const bounty = await client.readContract({
            address: contractAddress,
            abi: WANTED_ESCROW_GET_BOUNTY_ABI,
            functionName: 'getBounty',
            args: [BigInt(bountyId)],
          }) as { poster: string }
          if (bounty.poster.toLowerCase() === claimedPoster) {
            verifiedPoster = claimedPoster
          }
        } catch {
          // RPC unavailable — skip verification, don't write poster
        }
      }
    }

    if (verifiedPoster) {
      await pool.sql`
        INSERT INTO bounties (id, is_public, poster)
        VALUES (${bountyId}, FALSE, ${verifiedPoster})
        ON CONFLICT (id) DO UPDATE SET poster = COALESCE(bounties.poster, ${verifiedPoster})
      `
    } else {
      await pool.sql`
        INSERT INTO bounties (id, is_public)
        VALUES (${bountyId}, FALSE)
        ON CONFLICT (id) DO NOTHING
      `
    }

    return res.status(200).json({ ok: true })
  } catch (e) {
    console.error('register handler error:', e)
    return res.status(500).json({ error: 'Server error' })
  }
}
