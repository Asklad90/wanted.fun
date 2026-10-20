import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useReadContract } from 'wagmi'
import { BountyCard, BountyData } from './BountyCard'
import { SkeletonBountyCard } from './Skeleton'
import { WindowCard } from './WindowCard'
import { PillButton } from './PillButton'
import { TrophyIcon, CoinIcon } from './Icons'
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
  const [subCount, setSubCount] = useState<number>(0)

  useEffect(() => {
    if (!bounty) return
    fetch(`/api/bounties/${id.toString()}/submissions?count=1`)
      .then(r => r.ok ? r.json() as Promise<{ count: number }> : Promise.resolve({ count: 0 }))
      .then(d => setSubCount(d.count))
      .catch(() => {})
  }, [id, bounty])

  return bounty
    ? ({ ...(bounty as BountyData), submissionCount: BigInt(subCount) } as BountyData)
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
  if (!bounty) return <SkeletonBountyCard />

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

function BountyGrid({ total, onSelectBounty, onCreateBounty }: { total: number; onSelectBounty: (id: bigint) => void; onCreateBounty: () => void }) {
  const ids = Array.from({ length: Math.min(total, 24) }, (_, i) => BigInt(total - i))
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {ids.map((id, i) => <BountyItem key={id.toString()} bountyId={id} index={i} onSelect={onSelectBounty} />)}
      <button
        type="button"
        onClick={onCreateBounty}
        className="hidden sm:flex flex-col items-center justify-center gap-3 min-h-[240px] rounded-lg border-[3px] border-dashed border-[#111] bg-[#FFFDF0]/70 hover:bg-[#FFE600] transition-all hover:-translate-y-[3px] hover:shadow-hard"
      >
        <span className="w-14 h-14 rounded-full border-[3px] border-[#111] bg-[#FF3E9A] flex items-center justify-center font-heading text-[30px] leading-none text-[#111] shadow-hard-sm">+</span>
        <span className="font-mono-bold text-[12px] uppercase tracking-widest text-[#111]">Post a bounty</span>
        <span className="font-body text-[13px] text-[#111]/60">Lock the prize. Let people compete.</span>
      </button>
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
        <div className="bg-[#FFFDF0]/92 px-6 py-10 desk:px-12 desk:py-14 desk:grid desk:grid-cols-[1.1fr_0.9fr] desk:gap-12 desk:items-center">
          <div className="flex flex-col gap-5">
          <h1 className="font-heading text-[44px] sm:text-[58px] desk:text-[64px] font-extrabold leading-[1.05] text-[#111] text-balance" style={{ letterSpacing: '-0.02em' }}>
            Post a bounty.<br />Get it done.
          </h1>
          <p className="font-heading text-[18px] font-bold text-[#111] max-w-md leading-relaxed">
            Lock USDC in escrow, get work done onchain. The prize is guaranteed before a single worker types a word.
          </p>
          <div>
            <PillButton onClick={onCreateBounty} variant="yellow" size="lg">Post a bounty →</PillButton>
          </div>
          {CONTRACT_DEPLOYED && (
            <div className="flex gap-8 flex-wrap pt-4 mt-1 border-t-[3px] border-[#111] desk:hidden">
              <Stat value={totalBounties.toString()} label="Bounties" />
              <Stat value={`$${formatUsdc(totalEscrowed)}`} label="In escrow" />
              <Stat value={`$${formatUsdc(totalPaid)}`} label="Paid out" icon={<CoinIcon size={28} />} />
            </div>
          )}
          </div>
          <HowItWorks />
        </div>
      </motion.section>
      </div>

      {/* Stats strip — desktop only (mobile keeps the stats inside the hero) */}
      {CONTRACT_DEPLOYED && (
        <div className="hidden desk:grid grid-cols-3 gap-5 -mt-2">
          <StatTile bg="#FFE600" value={totalBounties.toString()} label="Bounties" />
          <StatTile bg="#C6F23A" value={`$${formatUsdc(totalEscrowed)}`} label="In escrow" />
          <StatTile bg="#FF3E9A" value={`$${formatUsdc(totalPaid)}`} label="Paid out" icon={<CoinIcon size={32} />} />
        </div>
      )}

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
            <BountyGrid total={totalBounties} onSelectBounty={onSelectBounty} onCreateBounty={onCreateBounty} />
          </div>
        )
      )}
    </div>
  )
}

function Stat({ value, label, icon }: { value: string; label: string; icon?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex items-center gap-1.5">
        <span className="font-heading text-[28px] font-extrabold tabular-nums text-[#111]" style={{ letterSpacing: '-0.02em' }}>{value}</span>
        {icon}
      </div>
      <span className="font-mono-bold text-[10px] uppercase tracking-widest text-[#111]/70">{label}</span>
    </div>
  )
}

function StatTile({ value, label, bg, icon }: { value: string; label: string; bg: string; icon?: React.ReactNode }) {
  return (
    <div
      className="border-[3px] border-[#111] rounded-xl shadow-hard-sm px-5 py-4 flex items-center justify-between gap-3"
      style={{ backgroundColor: bg }}
    >
      <div className="flex flex-col gap-1 min-w-0">
        <span className="font-heading text-[34px] font-extrabold tabular-nums text-[#111] leading-none truncate" style={{ letterSpacing: '-0.02em' }}>{value}</span>
        <span className="font-mono-bold text-[10px] uppercase tracking-widest text-[#111]/70">{label}</span>
      </div>
      {icon}
    </div>
  )
}

const HOW_STEPS: { n: number; title: string; text: string; color: string }[] = [
  { n: 1, title: 'Post',     text: 'Set the task, the prize and the deadline.',     color: '#FFE600' },
  { n: 2, title: 'Lock',     text: 'The full prize is escrowed in USDC up front.',  color: '#C6F23A' },
  { n: 3, title: 'Submit',   text: 'Workers send in their work, no gas needed.',    color: '#7FF3F0' },
  { n: 4, title: 'Get paid', text: 'You approve the winners and escrow pays out.',  color: '#FF3E9A' },
]

function HowItWorks() {
  return (
    <div className="hidden desk:block desk:rotate-[1.5deg]">
      <WindowCard title="HOW_IT_WORKS.EXE" titleBarColor="#FF3E9A" bodyClassName="flex flex-col gap-4 p-5">
        {HOW_STEPS.map(s => (
          <div key={s.n} className="flex items-start gap-3">
            <span
              className="shrink-0 w-8 h-8 rounded-full border-[3px] border-[#111] flex items-center justify-center font-mono-bold text-[13px] text-[#111]"
              style={{ backgroundColor: s.color }}
            >
              {s.n}
            </span>
            <div className="min-w-0">
              <div className="font-heading text-[17px] font-extrabold text-[#111] leading-tight">{s.title}</div>
              <div className="font-body text-[13px] text-[#111]/70 leading-snug">{s.text}</div>
            </div>
          </div>
        ))}
      </WindowCard>
    </div>
  )
}
