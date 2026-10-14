import { useState } from 'react'
import { motion } from 'framer-motion'
import { useReadContract } from 'wagmi'
import { BountyCard, BountyData } from './BountyCard'
import { WindowCard } from './WindowCard'
import { PillButton } from './PillButton'
import { TrophyIcon } from './Icons'
import { MyBounties, MySubmissions } from './MyBounties'
import { BOUNTY_BOARD_ABI } from '../bounty-abi'
import { CHAIN_ID, CONTRACT_ADDRESS, CONTRACT_DEPLOYED } from '../bounty-config'
import { formatUsdc } from '../lib/utils'

type Tab = 'wall' | 'my-bounties' | 'my-submissions'

const TAB_LABELS: { id: Tab; label: string; color: string }[] = [
  { id: 'wall',            label: 'BOUNTY WALL',    color: '#FFE600' },
  { id: 'my-bounties',    label: 'MY BOUNTIES',    color: '#FF3E9A' },
  { id: 'my-submissions', label: 'MY SUBMISSIONS', color: '#8B5CF6' },
]

interface WallPageProps {
  onSelectBounty: (id: bigint) => void
  onCreateBounty: () => void
  refreshKey: number
}

function useBountyData(id: bigint, enabled: boolean) {
  const { data: bounty } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: BOUNTY_BOARD_ABI,
    functionName: 'getBounty',
    args: [id],
    chainId: CHAIN_ID,
    query: { enabled },
  })
  const { data: subs } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: BOUNTY_BOARD_ABI,
    functionName: 'getSubmissions',
    args: [id, 0n, 100n],
    chainId: CHAIN_ID,
    query: { enabled },
  })
  return bounty
    ? ({ ...(bounty as BountyData), submissionCount: BigInt(Array.isArray(subs) ? subs.length : 0) } as BountyData)
    : null
}

// Expired/cancelled bounties disappear from the wall 3 days after their deadline.
const HIDE_AFTER_SEC = 3 * 24 * 60 * 60 // 3 days
// Module-level snapshot — avoids impure Date.now() inside render
const _wallNowSec = (): number => Date.now() / 1000

const cardVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.06, duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] },
  }),
}

function BountyItem({ bountyId, index, onSelect }: { bountyId: bigint; index: number; onSelect: (id: bigint) => void }) {
  const bounty = useBountyData(bountyId, true)
  if (!bounty) return <div className="border-[3px] border-[#111] rounded-lg bg-[#FFFDF0] animate-pulse h-60" />

  const nowSec = _wallNowSec()
  const deadlineSec = Number(bounty.deadline)
  const isInactive = bounty.cancelled || nowSec > deadlineSec
  if (isInactive && nowSec > deadlineSec + HIDE_AFTER_SEC) return null

  return (
    <motion.div
      custom={index}
      variants={cardVariants}
      initial="hidden"
      animate="visible"
      whileHover={{ y: -3, transition: { duration: 0.15 } }}
      whileTap={{ scale: 0.98, transition: { duration: 0.1 } }}
    >
      <BountyCard bounty={bounty} onClick={() => onSelect(bountyId)} />
    </motion.div>
  )
}

function BountyGrid({ total, onSelectBounty }: { total: number; onSelectBounty: (id: bigint) => void }) {
  const ids = Array.from({ length: Math.min(total, 24) }, (_, i) => BigInt(total - i))
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {ids.map((id, i) => <BountyItem key={id.toString()} bountyId={id} index={i} onSelect={onSelectBounty} />)}
    </div>
  )
}

export function WallPage({ onSelectBounty, onCreateBounty, refreshKey: _refreshKey }: WallPageProps) {
  const [tab, setTab] = useState<Tab>('wall')

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
      <div>
        <motion.section
          className="checkerboard border-[3px] border-[#111] rounded-xl shadow-hard overflow-hidden"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] }}
        >
        <div className="bg-[#FFFDF0]/92 px-6 py-10 flex flex-col gap-5">
          <h1 className="font-heading text-[44px] sm:text-[58px] font-extrabold leading-[1.05] text-[#111] text-balance" style={{ letterSpacing: '-0.02em' }}>
            Post a bounty.<br />Get it done.
          </h1>
          <p className="font-heading text-[18px] font-bold text-[#111] max-w-md leading-relaxed">
            Lock USDC in escrow, get work done onchain. The prize is guaranteed before a single worker types a word.
          </p>
          <div>
            <PillButton onClick={onCreateBounty} variant="yellow" size="lg">Post a bounty →</PillButton>
          </div>
          {CONTRACT_DEPLOYED && (
            <div className="flex gap-8 flex-wrap pt-4 mt-1 border-t-[3px] border-[#111]">
              <Stat value={totalBounties.toString()} label="Bounties" />
              <Stat value={`$${formatUsdc(totalEscrowed)}`} label="In escrow" />
              <Stat value={`${formatUsdc(totalPaid)} USDC`} label="Paid out" />
            </div>
          )}
        </div>
      </motion.section>
      </div>

      {/* Tab strip */}
      <motion.div
        className="flex gap-0 border-[3px] border-[#111] rounded-t-lg overflow-hidden shadow-hard w-fit"
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.3, delay: 0.1, ease: [0.25, 0.46, 0.45, 0.94] }}
      >
        {TAB_LABELS.map(({ id, label, color }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className="px-4 py-2.5 font-mono-bold text-[11px] uppercase tracking-widest text-[#111] transition-colors border-r-[3px] border-[#111] last:border-r-0"
            style={{ backgroundColor: tab === id ? color : '#FFFDF0', minWidth: 0 }}
          >{label}</button>
        ))}
      </motion.div>

      {/* Tab content */}
      {tab === 'my-bounties' && (
        <MyBounties onSelectBounty={onSelectBounty} onCreateBounty={onCreateBounty} />
      )}
      {tab === 'my-submissions' && (
        <MySubmissions onSelectBounty={onSelectBounty} />
      )}

      {/* Bounty wall — only shown on wall tab */}
      {tab === 'wall' && (
        !CONTRACT_DEPLOYED ? (
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
        )
      )}
    </div>
  )
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="font-heading text-[28px] font-extrabold tabular-nums text-[#111]" style={{ letterSpacing: '-0.02em' }}>{value}</span>
      <span className="font-mono-bold text-[10px] uppercase tracking-widest text-[#111]/70">{label}</span>
    </div>
  )
}
