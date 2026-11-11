import React, { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { useReadContract } from 'wagmi'
import { BountyCard, BountyData } from './BountyCard'
import { SkeletonBountyCard } from './Skeleton'
import { WindowCard } from './WindowCard'
import { PillButton } from './PillButton'
import { StatusTag } from './StatusTag'
import { PixelAvatar } from './PixelAvatar'
import { TrophyIcon, CoinIcon, ClockIcon, ArrowRightIcon } from './Icons'
import { TrophyBigIcon, NotepadIcon, UsdcCoinIcon } from './StatIcons'
import { AnimatedCounter } from './AnimatedCounter'
import { MyBounties, MySubmissions } from './MyBounties'
import { BOUNTY_BOARD_ABI } from '../bounty-abi'
import { CHAIN_ID, CONTRACT_ADDRESS, CONTRACT_DEPLOYED } from '../bounty-config'
import { formatUsdc, formatAddress, timeLeft, bountyStatus, decodeBytes } from '../lib/utils'
import type { BountyStatusType } from '../lib/utils'

type Tab = 'wall' | 'my-bounties' | 'my-submissions'
type StatusFilter = 'all' | 'open' | 'full' | 'ended'

const TAB_LABELS: { id: Tab; label: string; color: string }[] = [
  { id: 'wall',            label: 'BOUNTY WALL',    color: '#FFE600' },
  { id: 'my-bounties',    label: 'MY BOUNTIES',    color: '#FF3E9A' },
  { id: 'my-submissions', label: 'MY SUBMISSIONS', color: '#8B5CF6' },
]

const FILTERS: { id: StatusFilter; label: string }[] = [
  { id: 'all',   label: 'All' },
  { id: 'open',  label: 'Open' },
  { id: 'full',  label: 'Full' },
  { id: 'ended', label: 'Ended' },
]

function matchesFilter(status: BountyStatusType, filter: StatusFilter): boolean {
  if (filter === 'all') return true
  if (filter === 'open') return status === 'OPEN'
  if (filter === 'full') return status === 'FULL'
  return status === 'EXPIRED' || status === 'CANCELLED'
}

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

// ─── Desktop wall card (mobile keeps the original BountyCard) ───────────────
function WallBountyCard({ bounty, onClick }: { bounty: BountyData; onClick: () => void }) {
  const [spotlight, setSpotlight] = useState<{ x: number; y: number; opacity: number }>({ x: 0, y: 0, opacity: 0 })
  const idNum = Number(bounty.id)
  const title = decodeBytes(bounty.title) || `Bounty #${idNum}`
  const description = decodeBytes(bounty.description)
  const status = bountyStatus({
    winnersApproved: bounty.winnersApproved,
    maxWinners: bounty.maxWinners,
    deadline: bounty.deadline,
    cancelled: bounty.cancelled,
    reclaimedUnused: bounty.reclaimedUnused,
  })
  const subCount = bounty.submissionCount !== undefined ? Number(bounty.submissionCount) : null
  const meta = `${bounty.winnersApproved}/${bounty.maxWinners} winners${subCount !== null ? ` · ${subCount} submission${subCount === 1 ? '' : 's'}` : ''}`

  const handleMouseMove = (e: React.MouseEvent<HTMLButtonElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    setSpotlight({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      opacity: 1,
    })
  }

  const handleMouseLeave = () => {
    setSpotlight(s => ({ ...s, opacity: 0 }))
  }

  return (
    <button
      type="button"
      onClick={onClick}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className="relative overflow-hidden text-left w-full h-full flex flex-col gap-3 rounded-lg border-[2px] border-[#111] bg-[#FFFDF0] p-4 shadow-hard-sm transition-all hover:shadow-[6px_6px_0_#111] hover:-translate-y-0.5 active:translate-y-0.5 active:shadow-[2px_2px_0_#111]"
    >
      {/* Interactive cursor spotlight sheen */}
      <div
        className="pointer-events-none absolute inset-0 transition-opacity duration-300"
        style={{
          opacity: spotlight.opacity,
          background: `radial-gradient(240px circle at ${spotlight.x}px ${spotlight.y}px, rgba(127, 243, 240, 0.18), transparent 70%)`,
        }}
        aria-hidden="true"
      />
      <div className="flex items-center justify-between gap-2">
        <StatusTag status={status} />
        <span className="flex items-center gap-1 text-[#111]/70">
          <ClockIcon size={12} />
          <span className="font-mono-bold text-[10px] uppercase tracking-wider">{timeLeft(bounty.deadline)}</span>
        </span>
      </div>

      <h3 className="font-heading text-[17px] font-extrabold leading-tight text-[#111] line-clamp-2">{title}</h3>

      {description && (
        <p className="font-mono-ui text-[12px] leading-snug text-[#111]/70 line-clamp-3">{description}</p>
      )}

      <div className="mt-auto flex flex-col gap-3 pt-1">
        <div className="flex items-center gap-1.5">
          <UsdcCoinIcon size={20} />
          <span className="font-heading text-[17px] font-extrabold tabular-nums text-[#111]">{formatUsdc(bounty.rewardPerWinner)} USDC</span>
          <span className="font-mono-bold text-[9px] uppercase tracking-wider text-[#111]/50">/ winner</span>
        </div>

        <div className="flex items-center justify-between gap-2 border-t-2 border-[#111]/15 pt-3">
          <span className="flex items-center gap-2 min-w-0">
            <span className="inline-flex shrink-0 rounded-full overflow-hidden border-2 border-[#111]">
              <PixelAvatar address={bounty.poster} size={26} />
            </span>
            <span className="flex flex-col min-w-0">
              <span className="font-mono-ui text-[10px] text-[#111]/70 truncate">Created by {formatAddress(bounty.poster)}</span>
              <span className="font-mono-ui text-[10px] text-[#111]/50 truncate">{meta}</span>
            </span>
          </span>
          <span className="flex items-center gap-1 shrink-0 font-mono-bold text-[10px] text-[#111] underline underline-offset-2">
            View bounty <ArrowRightIcon size={11} />
          </span>
        </div>
      </div>
    </button>
  )
}

interface BountyItemProps {
  bountyId: bigint
  index: number
  onSelect: (id: bigint) => void
  filter: StatusFilter
  query: string
  onReport: (id: string, shown: boolean) => void
}

function BountyItem({ bountyId, index, onSelect, filter, query, onReport }: BountyItemProps) {
  const bounty = useBountyData(bountyId, true)
  const idKey = bountyId.toString()

  // Work out whether this bounty should be on the wall (before any early return so hook order stays fixed)
  let shown = true
  if (bounty) {
    const nowSec = _wallNowSec()
    const deadlineSec = Number(bounty.deadline)
    const isInactive = bounty.cancelled || nowSec > deadlineSec
    const hiddenForAge = isInactive && nowSec > deadlineSec + HIDE_AFTER_SEC
    const status = bountyStatus({
      winnersApproved: bounty.winnersApproved,
      maxWinners: bounty.maxWinners,
      deadline: bounty.deadline,
      cancelled: bounty.cancelled,
      reclaimedUnused: bounty.reclaimedUnused,
    })
    const q = query.trim().toLowerCase()
    const haystack = `${decodeBytes(bounty.title)} ${decodeBytes(bounty.description)}`.toLowerCase()
    shown = !hiddenForAge && matchesFilter(status, filter) && (q === '' || haystack.includes(q))
  }
  const loaded = bounty !== null

  useEffect(() => {
    if (loaded) onReport(idKey, shown)
  }, [loaded, shown, idKey, onReport])

  if (!bounty) return <SkeletonBountyCard />
  if (!shown) return null

  return (
    <motion.div
      className="h-full"
      custom={index}
      variants={cardVariants}
      initial="hidden"
      animate="visible"
      whileHover={{ y: -3, transition: { duration: 0.15 } }}
      whileTap={{ scale: 0.98, transition: { duration: 0.1 } }}
    >
      <div className="desk:hidden h-full">
        <BountyCard bounty={bounty} onClick={() => onSelect(bountyId)} />
      </div>
      <div className="hidden desk:block h-full">
        <WallBountyCard bounty={bounty} onClick={() => onSelect(bountyId)} />
      </div>
    </motion.div>
  )
}

function BountyGrid({ total, onSelectBounty, filter, query, onAllHiddenChange }: {
  total: number
  onSelectBounty: (id: bigint) => void
  filter: StatusFilter
  query: string
  onAllHiddenChange: (hidden: boolean) => void
}) {
  const ids = Array.from({ length: Math.min(total, 24) }, (_, i) => BigInt(total - i))
  const [visible, setVisible] = useState<Record<string, boolean>>({})
  const report = useCallback((id: string, shown: boolean) => {
    setVisible(prev => (prev[id] === shown ? prev : { ...prev, [id]: shown }))
  }, [])

  const allReported = ids.every(id => visible[id.toString()] !== undefined)
  const noMatches = allReported && ids.every(id => visible[id.toString()] === false)
  // No active filter/search means these bounties aren't "hidden by a search" — they're
  // just not showing (e.g. aged off the wall), so the wall is effectively empty.
  const noActiveFilter = filter === 'all' && query.trim() === ''
  const allHidden = noMatches && noActiveFilter

  useEffect(() => {
    onAllHiddenChange(allHidden)
  }, [allHidden, onAllHiddenChange])

  // When every bounty is hidden with no active filter, the parent swaps to the same
  // clean "No bounties yet" card used for a genuinely empty wall — skip rendering here.
  if (allHidden) return null

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 desk:grid-cols-2 xl:grid-cols-3 gap-4 items-stretch">
      {ids.map((id, i) => (
        <BountyItem
          key={id.toString()}
          bountyId={id}
          index={i}
          onSelect={onSelectBounty}
          filter={filter}
          query={query}
          onReport={report}
        />
      ))}
      {noMatches && !noActiveFilter && (
        <div className="col-span-full rounded-lg border-[2px] border-dashed border-[#111] bg-[#FFFDF0] py-12 px-4 text-center font-mono-bold text-[12px] uppercase tracking-widest text-[#111]/60">
          No bounties match. Try a different search or filter.
        </div>
      )}
    </div>
  )
}

export function WallPage({ onSelectBounty, onCreateBounty, refreshKey: _refreshKey }: WallPageProps) {
  const [tab, setTab] = useState<Tab>('wall')
  const [filter, setFilter] = useState<StatusFilter>('all')
  const [query, setQuery] = useState('')
  // Tagged with the inputs it was computed from, so a change to totalBounties, filter,
  // or query (below) invalidates it automatically — read it only through the derived
  // `allBountiesHidden` further down, never directly.
  const [hiddenSnapshot, setHiddenSnapshot] = useState<{ hidden: boolean; totalBounties: number; filter: StatusFilter; query: string } | null>(null)

  const { data: totalBountiesRaw, isLoading: totalBountiesLoading } = useReadContract({
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

  // Only trust the snapshot while it was computed from today's totalBounties/filter/query —
  // otherwise (e.g. a new bounty appears, or the filter/search changes), treat it as
  // unknown until BountyGrid re-mounts and reports back.
  const allBountiesHidden = !!hiddenSnapshot
    && hiddenSnapshot.totalBounties === totalBounties
    && hiddenSnapshot.filter === filter
    && hiddenSnapshot.query === query
    && hiddenSnapshot.hidden

  const handleAllHiddenChange = useCallback((hidden: boolean) => {
    setHiddenSnapshot({ hidden, totalBounties, filter, query })
  }, [totalBounties, filter, query])
  const totalPaid = (totalPaidRaw) ?? 0n

  return (
    <div className="flex flex-col gap-8">
      {/* Hero */}
      <div>
        <motion.section
          className="checkerboard border-[3px] border-[#111] rounded-2xl shadow-hard overflow-hidden p-4 sm:p-6 desk:p-8"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] }}
        >
          <div className="desk:grid desk:grid-cols-[1.15fr_0.85fr] desk:gap-8 desk:items-center">
            <div className="flex flex-col gap-4">
              {/* Dedicated black card for headline & copy */}
              <div className="bg-[#111] text-[#FFFDF0] rounded-2xl border-[3px] border-[#111] shadow-hard p-6 sm:p-8">
                <h1
                  className="font-heading text-[38px] sm:text-[50px] desk:text-[56px] font-extrabold leading-[1.05] text-white text-balance"
                  style={{ letterSpacing: '-0.02em' }}
                >
                  Create a bounty.<br />Get work done.
                </h1>
                <div className="my-4 sm:my-5 border-t border-white/20" />
                <p className="font-heading text-[16px] sm:text-[18px] font-bold text-white/90 leading-relaxed">
                  Put your idea onchain, set the reward, and let contributors bring it to life. No promises, just work and rewards.
                </p>
              </div>

              {/* Action buttons sitting on the cyan checkerboard */}
              <div className="flex items-center gap-3 flex-wrap">
                <button
                  type="button"
                  onClick={onCreateBounty}
                  className="inline-flex items-center gap-2 rounded-full border-[3px] border-[#111] shadow-hard btn-press bg-[#FFE600] text-[#111] font-heading font-extrabold uppercase tracking-wide px-6 py-3.5 text-[14px] sm:text-[15px] cursor-pointer"
                >
                  <span>Post a bounty</span>
                  <span aria-hidden="true">→</span>
                </button>
                <button
                  type="button"
                  onClick={() => { window.location.hash = '#/how-it-works' }}
                  className="inline-flex items-center gap-2 rounded-full border-[3px] border-[#111] shadow-hard btn-press bg-white text-[#111] font-mono-bold uppercase tracking-wider px-5 py-3 text-[12px] hover:bg-[#FFFDF0] transition-colors cursor-pointer"
                >
                  <span>How it works</span>
                  <span aria-hidden="true">→</span>
                </button>
              </div>

              {/* Stats row on mobile */}
              {CONTRACT_DEPLOYED && (
                <div className="flex gap-8 flex-wrap pt-4 mt-1 border-t-[3px] border-[#111] desk:hidden">
                  <Stat value={totalBounties.toString()} numericValue={totalBounties} label="Bounties" />
                  <Stat value={`$${formatUsdc(totalEscrowed)}`} numericValue={Number(totalEscrowed) / 1e6} prefix="$" label="In escrow" />
                  <Stat value={`$${formatUsdc(totalPaid)}`} numericValue={Number(totalPaid) / 1e6} prefix="$" label="Paid out" icon={<CoinIcon size={28} />} />
                </div>
              )}
            </div>
            <HowItWorks />
          </div>
        </motion.section>
      </div>

      {/* Stats row — desktop only (mobile keeps the stats inside the hero) */}
      {CONTRACT_DEPLOYED && (
        <div className="hidden desk:flex items-center justify-between w-full max-w-[1040px] mx-auto px-6">
          <StatItem icon={<NotepadIcon size={54} />} value={totalBounties.toString()} numericValue={totalBounties} label="Bounties" />
          <span className="h-14 w-px bg-[#111]/30" />
          <StatItem icon={<UsdcCoinIcon size={54} />} value={`$${formatUsdc(totalEscrowed)}`} numericValue={Number(totalEscrowed) / 1e6} prefix="$" label="In escrow" />
          <span className="h-14 w-px bg-[#111]/30" />
          <StatItem icon={<TrophyBigIcon size={54} />} value={`$${formatUsdc(totalPaid)}`} numericValue={Number(totalPaid) / 1e6} prefix="$" label="Paid out" />
        </div>
      )}

      {/* Tabs + content */}
      <div id="wall" className="scroll-mt-24 flex flex-col gap-8">
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
          ) : totalBountiesLoading ? (
            // Still reading the count — don't flash "No bounties yet" before we actually know.
            <div className="grid grid-cols-1 sm:grid-cols-2 desk:grid-cols-2 xl:grid-cols-3 gap-4">
              <SkeletonBountyCard />
              <SkeletonBountyCard />
              <SkeletonBountyCard />
            </div>
          ) : totalBounties === 0 || allBountiesHidden ? (
            <WindowCard title="BOUNTIES.EXE" titleBarColor="#A78BFA">
              <div className="checkerboard rounded-lg py-16 flex flex-col items-center gap-4">
                <TrophyIcon size={48} />
                <div className="font-mono-bold text-[12px] uppercase tracking-widest text-[#111]/60 text-center max-w-xs">
                  No bounties yet. Be the first to post one!
                </div>
                <PillButton onClick={onCreateBounty} variant="pink">Post first bounty</PillButton>
              </div>
            </WindowCard>
          ) : (
            <div className="desk:border-[3px] desk:border-[#111] desk:rounded-xl desk:shadow-[6px_6px_0_#111] desk:bg-[#FFFDF0] desk:overflow-hidden">
              {/* Desktop toolbar: title, count, search */}
              <div className="hidden desk:flex items-center gap-4 flex-wrap checkerboard border-b-[3px] border-[#111] px-6 py-5">
                <span className="font-heading text-[20px] font-extrabold uppercase tracking-wide text-[#111] bg-[#FFE600] border-[3px] border-[#111] shadow-hard-sm rounded-md px-4 py-1.5">
                  Bounty Wall
                </span>
                <span className="font-mono-bold text-[11px] uppercase tracking-widest text-[#111]/70 border-l-2 border-[#111]/30 pl-4">
                  {totalBounties} bount{totalBounties === 1 ? 'y' : 'ies'}
                </span>
                <label className="relative block w-full max-w-[340px] ml-auto">
                  <span className="sr-only">Search bounties</span>
                  <svg
                    className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#111]"
                    viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"
                  >
                    <circle cx="8.5" cy="8.5" r="5.5" />
                    <path d="M13 13l4.5 4.5" />
                  </svg>
                  <input
                    type="search"
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    placeholder="Search bounties..."
                    className="w-full bg-white border-[3px] border-[#111] rounded-lg shadow-hard-sm pl-10 pr-3 py-2 font-mono-ui text-[13px] text-[#111] placeholder:text-[#111]/50 focus:outline-none focus:shadow-[6px_6px_0_#111] transition-shadow"
                  />
                </label>
              </div>

              <div className="flex flex-col gap-4 desk:p-6 desk:gap-5">
                {/* Mobile heading (unchanged look) */}
                <div className="flex items-center justify-between desk:hidden">
                  <h2 className="font-heading text-[20px] font-bold text-[#111]">All Bounties ({totalBounties})</h2>
                </div>

                {/* Desktop filter pills */}
                <div className="hidden desk:flex items-center gap-2 flex-wrap">
                  {FILTERS.map(f => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setFilter(f.id)}
                      aria-pressed={filter === f.id}
                      className={`font-mono-bold text-[12px] text-[#111] px-4 py-1.5 rounded-full border-2 border-[#111] transition-colors ${filter === f.id ? 'bg-[#FFE600]' : 'bg-[#FFFDF0] hover:bg-[#FFE600]/50'}`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>

                <div className="desk:grid desk:grid-cols-[minmax(0,1fr)_264px] desk:gap-6 desk:items-start">
                  <BountyGrid
                    total={totalBounties}
                    onSelectBounty={onSelectBounty}
                    filter={filter}
                    query={query}
                    onAllHiddenChange={handleAllHiddenChange}
                  />
                  <aside className="hidden desk:flex flex-col items-center text-center gap-3 rounded-lg border-[2px] border-[#111] bg-[#A78BFA]/20 p-5">
                    <TrophyBigIcon size={64} />
                    <h3 className="font-heading text-[20px] font-extrabold text-[#111] leading-tight">Need something done?</h3>
                    <p className="font-mono-ui text-[12px] leading-snug text-[#111]/70">
                      Lock a USDC prize, let people compete, and pay only the winners you pick.
                    </p>
                    <PillButton onClick={onCreateBounty} variant="yellow" size="sm">Post a bounty</PillButton>
                  </aside>
                </div>
              </div>
            </div>
          )
        )}
      </div>
    </div>
  )
}

function Stat({ value, label, icon, numericValue, prefix = '' }: {
  value: string
  label: string
  icon?: React.ReactNode
  numericValue?: number
  prefix?: string
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex items-center gap-1.5">
        <span className="font-heading text-[28px] font-extrabold tabular-nums text-[#111]" style={{ letterSpacing: '-0.02em' }}>
          {numericValue !== undefined ? (
            <AnimatedCounter value={numericValue} prefix={prefix} decimals={prefix === '$' ? 2 : 0} />
          ) : (
            value
          )}
        </span>
        {icon}
      </div>
      <span className="font-mono-bold text-[10px] uppercase tracking-widest text-[#111]/70">{label}</span>
    </div>
  )
}

function StatItem({ icon, value, label, numericValue, prefix = '' }: {
  icon: React.ReactNode
  value: string
  label: string
  numericValue?: number
  prefix?: string
}) {
  return (
    <div className="flex items-center gap-4 min-w-0">
      <span className="shrink-0">{icon}</span>
      <div className="flex flex-col gap-1 min-w-0">
        <span className="font-heading text-[40px] font-extrabold tabular-nums text-[#111] leading-none truncate" style={{ letterSpacing: '-0.02em' }}>
          {numericValue !== undefined ? (
            <AnimatedCounter value={numericValue} prefix={prefix} decimals={prefix === '$' ? 2 : 0} />
          ) : (
            value
          )}
        </span>
        <span className="font-mono-bold text-[12px] uppercase tracking-widest text-[#111]/70">{label}</span>
      </div>
    </div>
  )
}

const HOW_STEPS: { n: string; title: string; text: string; color: string }[] = [
  { n: '01', title: 'Post',     text: 'Creator locks the full USDC prize in escrow.',          color: '#FFE600' },
  { n: '02', title: 'Submit',   text: 'Workers send in their work. No gas needed.',      color: '#FF3E9A' },
  { n: '03', title: 'Approve',  text: 'Creator reviews every submission and picks the winners.',   color: '#A78BFA' },
  { n: '04', title: 'Get paid', text: 'Winners get their USDC straight from escrow.',             color: '#C6F23A' },
]

function HowItWorks() {
  return (
    <div className="hidden desk:block">
      <WindowCard title="HOW_IT_WORKS.EXE" titleBarColor="#7FF3F0" bodyClassName="flex flex-col gap-3 p-4">
        {HOW_STEPS.map(s => (
          <div
            key={s.n}
            className="flex items-center gap-4 rounded-lg border-[3px] border-[#111] shadow-hard-sm px-4 py-2.5"
            style={{ backgroundColor: s.color }}
          >
            <span className="font-heading text-[24px] font-extrabold tabular-nums text-[#111] leading-none">{s.n}</span>
            <div className="min-w-0">
              <div className="font-heading text-[18px] font-extrabold text-[#111] leading-tight">{s.title}</div>
              <div className="font-mono-ui text-[12px] text-[#111] leading-snug">{s.text}</div>
            </div>
          </div>
        ))}
      </WindowCard>
    </div>
  )
}
