import { useEffect, useState } from 'react'
import { useReadContract } from 'wagmi'
import { BountyCard, BountyData } from './BountyCard'
import { WindowCard } from './WindowCard'
import { PillButton } from './PillButton'
import { TrophyIcon } from './Icons'
import { BOUNTY_BOARD_ABI } from '../bounty-abi'
import { CHAIN_ID, CONTRACT_ADDRESS, CONTRACT_DEPLOYED } from '../bounty-config'
import { formatUsdc } from '../lib/utils'
import { fetchCounts } from '../lib/submissions-api'

interface WallPageProps {
  onSelectBounty: (id: bigint) => void
  onCreateBounty: () => void
  refreshKey: number
}

function useBountyData(id: bigint, enabled: boolean, submissionCount?: number) {
  const { data: bounty } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: BOUNTY_BOARD_ABI,
    functionName: 'getBounty',
    args: [id],
    chainId: CHAIN_ID,
    query: { enabled },
  })
  return bounty
    ? ({ ...(bounty as BountyData), submissionCount: submissionCount !== undefined ? BigInt(submissionCount) : undefined } as BountyData)
    : null
}

function BountyItem({ bountyId, count, onSelect }: { bountyId: bigint; count?: number; onSelect: (id: bigint) => void }) {
  const bounty = useBountyData(bountyId, true, count)
  if (!bounty) return <div className="border-[3px] border-[#111] rounded-lg bg-[#FFFDF0] animate-pulse h-60" />
  return <BountyCard bounty={bounty} onClick={() => onSelect(bountyId)} />
}

function BountyGrid({ total, onSelectBounty }: { total: number; onSelectBounty: (id: bigint) => void }) {
  const ids = Array.from({ length: Math.min(total, 24) }, (_, i) => BigInt(total - i))
  const [counts, setCounts] = useState<Record<string, number>>({})
  useEffect(() => {
    let live = true
    fetchCounts(ids.map(Number)).then((c) => { if (live) setCounts(c) })
    return () => { live = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [total])
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {ids.map(id => <BountyItem key={id.toString()} bountyId={id} count={counts[id.toString()] ?? 0} onSelect={onSelectBounty} />)}
    </div>
  )
}

export function WallPage({ onSelectBounty, onCreateBounty, refreshKey: _refreshKey }: WallPageProps) {
  const { data: totalBountiesRaw } = useReadContract({
    address: CONTRACT_ADDRESS, abi: BOUNTY_BOARD_ABI, functionName: 'totalBounties',
    chainId: CHAIN_ID, query: { enabled: CONTRACT_DEPLOYED, refetchInterval: 8000 },
  })
  const { data: totalEscrowRaw } = useReadContract({
    address: CONTRACT_ADDRESS, abi: BOUNTY_BOARD_ABI, functionName: 'totalEscrowLocked',
    chainId: CHAIN_ID, query: { enabled: CONTRACT_DEPLOYED, refetchInterval: 8000 },
  })
  const { data: totalPaidRaw } = useReadContract({
    address: CONTRACT_ADDRESS, abi: BOUNTY_BOARD_ABI, functionName: 'totalWinnersPaid',
    chainId: CHAIN_ID, query: { enabled: CONTRACT_DEPLOYED, refetchInterval: 8000 },
  })

  const totalBounties = totalBountiesRaw ? Number(totalBountiesRaw) : 0
  const totalEscrowed = (totalEscrowRaw) ?? 0n
  const totalPaid = (totalPaidRaw) ?? 0n

  return (
    <div className="flex flex-col gap-8">
      {/* Hero */}
      <section className="checkerboard border-[3px] border-[#111] rounded-xl shadow-hard overflow-hidden">
        <div className="bg-white/85 px-6 py-10 flex flex-col gap-5">
          <h1 className="font-heading text-[44px] sm:text-[58px] font-extrabold leading-[1.05] text-[#111] text-balance" style={{ letterSpacing: '-0.02em' }}>
            Post a bounty.<br />Get it done.
          </h1>
          <p className="font-body text-[16px] text-[#111]/70 max-w-md">
            Lock USDC in escrow, get work done onchain. The prize is guaranteed before a single worker types a word.
          </p>
          <div>
            <PillButton onClick={onCreateBounty} variant="yellow" size="lg">Post a bounty →</PillButton>
          </div>
          {CONTRACT_DEPLOYED && (
            <div className="flex gap-8 flex-wrap pt-3 border-t-[3px] border-[#111]">
              <Stat value={totalBounties.toString()} label="Bounties" />
              <Stat value={`$${formatUsdc(totalEscrowed)}`} label="In escrow" />
              <Stat value={`$${formatUsdc(totalPaid)}`} label="Winners paid" />
            </div>
          )}
        </div>
      </section>

      {/* Grid or empty */}
      {!CONTRACT_DEPLOYED ? (
        <WindowCard title="BOUNTIES.EXE" titleBarColor="#A78BFA">
          <div className="checkerboard rounded-lg py-16 flex flex-col items-center gap-4">
            <TrophyIcon size={48} />
            <div className="font-mono-bold text-[12px] uppercase tracking-widest text-[#111]/60 text-center max-w-xs">
              Contract not yet deployed.
            </div>
          </div>
        </WindowCard>
      ) : totalBounties === 0 ? (
        <WindowCard title="BOUNTIES.EXE" titleBarColor="#A78BFA">
          <div className="checkerboard rounded-lg py-16 flex flex-col items-center gap-4">
            <TrophyIcon size={48} />
            <div className="font-mono-bold text-[12px] uppercase tracking-widest text-[#111]/60 text-center max-w-xs">
              No bounties yet. Be the first to post one!
            </div>
            <PillButton onClick={onCreateBounty} variant="pink">Post first bounty →</PillButton>
          </div>
        </WindowCard>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="font-heading text-[20px] font-bold text-[#111]">All Bounties ({totalBounties})</h2>
          </div>
          <BountyGrid total={totalBounties} onSelectBounty={onSelectBounty} />
        </div>
      )}
    </div>
  )
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="font-heading text-[28px] font-extrabold tabular-nums text-[#111]" style={{ letterSpacing: '-0.02em' }}>{value}</span>
      <span className="font-mono-ui text-[10px] uppercase tracking-widest text-[#111]/50">{label}</span>
    </div>
  )
}
