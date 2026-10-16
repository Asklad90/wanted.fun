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

/**
 * Return the bounty's poster (lowercase), filling in bounties.poster from the
 * contract if the DB doesn't have it yet. Null only if it can't be determined.
 */
export async function ensurePoster(bountyId: string): Promise<string | null> {
  const { rows } = await pool.sql`SELECT poster FROM bounties WHERE id = ${bountyId}`
  const stored = (rows[0] as { poster: string | null } | undefined)?.poster
  if (stored) return stored.toLowerCase()

  const onchain = await readOnchainPoster(bountyId)
  if (!onchain) return null

  await pool.sql`
    INSERT INTO bounties (id, is_public, poster)
    VALUES (${bountyId}, FALSE, ${onchain})
    ON CONFLICT (id) DO UPDATE SET poster = COALESCE(bounties.poster, ${onchain})
  `
  return onchain
}
