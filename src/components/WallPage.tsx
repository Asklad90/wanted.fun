import React, { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { useReadContract } from 'wagmi'
import { toast } from 'sonner'
import { BountyCard, ExternalBountyCard, BountyData } from './BountyCard'
import { SkeletonBountyCard } from './Skeleton'
import { WindowCard } from './WindowCard'
import { PillButton } from './PillButton'
import { StatusTag } from './StatusTag'
import { LoadingBar } from './LoadingBar'
import { PixelAvatar } from './PixelAvatar'
import { TrophyIcon, CoinIcon, ClockIcon, ArrowRightIcon, LockIcon, GlobeIcon } from './Icons'
import { TrophyBigIcon, NotepadIcon, UsdcCoinIcon } from './StatIcons'
import { AnimatedCounter } from './AnimatedCounter'
import { MyBounties, MySubmissions } from './MyBounties'
import { BOUNTY_BOARD_ABI } from '../bounty-abi'
import { CHAIN_ID, CONTRACT_ADDRESS, CONTRACT_DEPLOYED } from '../bounty-config'
import { barColor, formatUsdc, formatAddress, timeLeft, bountyStatus, decodeBytes } from '../lib/utils'
import type { BountyStatusType } from '../lib/utils'
import {
  fetchExternalBounties,
  syncExternalBounties,
  handleToPseudoAddress,
  type ExternalBounty,
} from '../lib/submissions-api'

type Tab = 'wall' | 'my-bounties' | 'my-submissions'
type StatusFilter = 'all' | 'open' | 'full' | 'ended'
type SourceFilter = 'all' | 'native' | 'external'

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

const SOURCE_FILTERS: { id: SourceFilter; label: string }[] = [
  { id: 'all',      label: 'All Bounties' },
  { id: 'native',   label: 'Want.fun Escrow' },
  { id: 'external', label: 'External Bounties' },
]

function matchesFilter(status: BountyStatusType, filter: StatusFilter): boolean {
  if (filter === 'all') return true
  if (filter === 'open') return status === 'OPEN'
  if (filter === 'full') return status === 'FULL'
  return status === 'EXPIRED' || status === 'CANCELLED'
}

interface WallPageProps {
  onSelectBounty: (id: bigint) => void
  onSelectExternalBounty: (id: string) => void
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
  const totalEscrow = bounty.rewardPerWinner * bounty.maxWinners
  const subCount = bounty.submissionCount !== undefined ? Number(bounty.submissionCount) : null
  const meta = `${bounty.winnersApproved}/${bounty.maxWinners} winners${subCount !== null ? ` · ${subCount} sub${subCount === 1 ? '' : 's'}` : ''}`
  const accentColor = barColor(idNum)

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
      className="group relative overflow-hidden text-left w-full h-full flex flex-col rounded-xl border-[3px] border-[#111] bg-[#FFFDF0] shadow-hard-sm transition-all duration-150 hover:shadow-[7px_7px_0_#111] hover:-translate-y-0.5 active:translate-y-0.5 active:shadow-[2px_2px_0_#111] cursor-pointer"
    >
      {/* Color-coded Neo-Brutalist top accent bar */}
      <div
        className="w-full px-3.5 py-2 border-b-[2.5px] border-[#111] flex items-center justify-between gap-2"
        style={{
          backgroundColor: accentColor,
          boxShadow: 'inset 0 2px 0 rgba(255,255,255,0.45)',
        }}
      >
        <div className="flex items-center gap-2">
          <span className="font-mono-bold text-[10px] uppercase tracking-wider text-[#111] bg-white/85 px-1.5 py-0.5 rounded border-[1.5px] border-[#111]">
            #{String(idNum).padStart(3, '0')}
          </span>
          <StatusTag status={status} />
        </div>
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/90 border-[1.5px] border-[#111] text-[#111]">
          <ClockIcon size={11} />
          <span className="font-mono-bold text-[10px] uppercase tracking-wider">{timeLeft(bounty.deadline)}</span>
        </span>
      </div>

      {/* Interactive cursor spotlight sheen */}
      <div
        className="pointer-events-none absolute inset-0 transition-opacity duration-300"
        style={{
          opacity: spotlight.opacity,
          background: `radial-gradient(240px circle at ${spotlight.x}px ${spotlight.y}px, rgba(127, 243, 240, 0.22), transparent 70%)`,
        }}
        aria-hidden="true"
      />

      <div className="relative z-10 p-4 flex flex-col gap-3 flex-1">
        <h3 className="font-heading text-[18px] font-extrabold leading-tight text-[#111] line-clamp-2 group-hover:underline decoration-2 underline-offset-2">
          {title}
        </h3>

        {description && (
          <p className="font-mono-ui text-[12px] leading-relaxed text-[#111]/75 line-clamp-2">{description}</p>
        )}

        <div className="mt-auto flex flex-col gap-3 pt-2">
          {/* Reward block */}
          <div className="rounded-xl border-[2px] border-[#111] bg-white p-3 shadow-[2px_2px_0_#111] flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-1.5">
              <UsdcCoinIcon size={22} />
              <div className="flex items-baseline gap-1">
                <span className="font-heading text-[20px] font-extrabold tabular-nums text-[#111] leading-none">
                  ${formatUsdc(bounty.rewardPerWinner)}
                </span>
                <span className="font-mono-bold text-[9px] uppercase tracking-wider text-[#111]/60">USDC / win</span>
              </div>
            </div>
            <span className="inline-flex items-center gap-1 bg-[#C6F23A] border-[1.5px] border-[#111] rounded-full px-2 py-0.5 font-mono-bold text-[9px] uppercase tracking-wider text-[#111]">
              <LockIcon size={10} />
              ${formatUsdc(totalEscrow)}
            </span>
          </div>

          <LoadingBar
            current={Number(bounty.winnersApproved)}
            max={Number(bounty.maxWinners)}
            label={`WINNERS ${bounty.winnersApproved}/${bounty.maxWinners}`}
            color="#FF3E9A"
          />

          <div className="flex items-center justify-between gap-2 border-t-[2px] border-[#111]/12 pt-2.5">
            <span className="flex items-center gap-2 min-w-0">
              <span className="inline-flex shrink-0 rounded-full overflow-hidden border-[2px] border-[#111]">
                <PixelAvatar address={bounty.poster} size={24} />
              </span>
              <span className="flex flex-col min-w-0">
                <span className="font-mono-bold text-[10px] text-[#111] truncate">{formatAddress(bounty.poster)}</span>
                <span className="font-mono-ui text-[9px] text-[#111]/60 truncate">{meta}</span>
              </span>
            </span>
            <span className="inline-flex items-center gap-1 shrink-0 font-mono-bold text-[10px] uppercase text-[#111] bg-[#FFE600] border-[1.5px] border-[#111] rounded-full px-2.5 py-1 shadow-[2px_2px_0_#111] group-hover:translate-x-0.5 transition-transform">
              Open <ArrowRightIcon size={10} />
            </span>
          </div>
        </div>
      </div>
    </button>
  )
}

// ─── Desktop wall card for External / Outside Bounties ──────────────────────
function WallExternalBountyCard({
  bounty,
  index,
  onClick,
}: {
  bounty: ExternalBounty
  index: number
  onClick: () => void
}) {
  const [spotlight, setSpotlight] = useState<{ x: number; y: number; opacity: number }>({ x: 0, y: 0, opacity: 0 })
  const deadlineSec = Number(bounty.deadline)
  const isExpired = _wallNowSec() > deadlineSec
  const status: BountyStatusType = isExpired ? 'EXPIRED' : 'OPEN'
  const rewardBig = BigInt(bounty.reward_usdc)
  const maxWinnersNum = Number(bounty.max_winners) || 1
  const totalPoolBig = rewardBig * BigInt(maxWinnersNum)
  const pseudoAddress = handleToPseudoAddress(bounty.poster_handle)
  const accentColor = barColor(index + 2)

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
      className="group relative overflow-hidden text-left w-full h-full flex flex-col rounded-xl border-[3px] border-[#111] bg-[#FFFDF0] shadow-hard-sm transition-all duration-150 hover:shadow-[7px_7px_0_#111] hover:-translate-y-0.5 active:translate-y-0.5 active:shadow-[2px_2px_0_#111] cursor-pointer"
    >
      {/* Top accent bar */}
      <div
        className="w-full px-3.5 py-2 border-b-[2.5px] border-[#111] flex items-center justify-between gap-2"
        style={{
          backgroundColor: accentColor,
          boxShadow: 'inset 0 2px 0 rgba(255,255,255,0.45)',
        }}
      >
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="inline-flex items-center gap-1 font-mono-bold text-[9.5px] uppercase tracking-wider text-[#111] bg-[#7FF3F0] px-2 py-0.5 rounded border-[1.5px] border-[#111]">
            <GlobeIcon size={10} />
            EXTERNAL
          </span>
          <StatusTag status={status} />
        </div>
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/90 border-[1.5px] border-[#111] text-[#111]">
          <ClockIcon size={11} />
          <span className="font-mono-bold text-[10px] uppercase tracking-wider">{isExpired ? 'ENDED' : timeLeft(deadlineSec)}</span>
        </span>
      </div>

      {/* Interactive cursor spotlight sheen */}
      <div
        className="pointer-events-none absolute inset-0 transition-opacity duration-300"
        style={{
          opacity: spotlight.opacity,
          background: `radial-gradient(240px circle at ${spotlight.x}px ${spotlight.y}px, rgba(127, 243, 240, 0.22), transparent 70%)`,
        }}
        aria-hidden="true"
      />

      <div className="relative z-10 p-4 flex flex-col gap-2.5 flex-1">
        <h3 className="font-heading text-[18px] font-extrabold leading-tight text-[#111] line-clamp-2 group-hover:underline decoration-2 underline-offset-2">
          {bounty.title}
        </h3>

        <p className="font-mono-ui text-[11.5px] leading-relaxed text-[#111]/75 line-clamp-2">
          {bounty.description}
        </p>

        <div className="mt-auto flex flex-col gap-2.5 pt-2">
          {/* Reward block */}
          <div className="rounded-xl border-[2px] border-[#111] bg-white p-3 shadow-[2px_2px_0_#111] flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-1.5">
              <UsdcCoinIcon size={22} />
              <div className="flex items-baseline gap-1">
                <span className="font-heading text-[20px] font-extrabold tabular-nums text-[#111] leading-none">
                  ${formatUsdc(rewardBig)}
                </span>
                <span className="font-mono-bold text-[9px] uppercase tracking-wider text-[#111]/60">
                  {bounty.reward_label} / win
                </span>
              </div>
            </div>
            <span className="inline-flex items-center gap-1 bg-[#FFE600] border-[1.5px] border-[#111] rounded-full px-2 py-0.5 font-mono-bold text-[9px] uppercase tracking-wider text-[#111]">
              ${formatUsdc(totalPoolBig)} pool · {maxWinnersNum} slot{maxWinnersNum !== 1 ? 's' : ''}
            </span>
          </div>

          {/* Subtle notice that this bounty was not launched on Want.fun */}
          <div className="rounded-lg border-[1.5px] border-[#111]/25 bg-white/80 px-2.5 py-1.5 flex items-center justify-between gap-2">
            <span className="font-mono-ui text-[9.5px] text-[#111]/75 truncate">
              Not launched on Want.fun · View-only
            </span>
            <span className="font-mono-bold text-[9px] uppercase tracking-wider text-[#111] bg-[#7FF3F0]/60 px-1.5 py-0.5 rounded border border-[#111]/30 shrink-0">
              {bounty.verified_source}
            </span>
          </div>

          <div className="flex items-center justify-between gap-2 border-t-[2px] border-[#111]/12 pt-2.5">
            <span className="flex items-center gap-2 min-w-0">
              <span className="inline-flex shrink-0 rounded-full overflow-hidden border-[2px] border-[#111]">
                <PixelAvatar address={pseudoAddress} size={24} />
              </span>
              <span className="flex flex-col min-w-0">
                <span className="font-mono-bold text-[10px] text-[#111] truncate">@{bounty.poster_handle}</span>
                <span className="font-mono-ui text-[9px] text-[#111]/60 truncate">{bounty.poster_name}</span>
              </span>
            </span>
            <span className="inline-flex items-center gap-1 shrink-0 font-mono-bold text-[10px] uppercase text-[#111] bg-[#7FF3F0] border-[1.5px] border-[#111] rounded-full px-2.5 py-1 shadow-[2px_2px_0_#111] group-hover:translate-x-0.5 transition-transform">
              View Only <ArrowRightIcon size={10} />
            </span>
          </div>
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
  onReport: (id: string, hiddenForAge: boolean, shown: boolean, isActive: boolean) => void
}

function BountyItem({ bountyId, index, onSelect, filter, query, onReport }: BountyItemProps) {
  const bounty = useBountyData(bountyId, true)
  const idKey = bountyId.toString()

  // Work out whether this bounty should be on the wall (before any early return so hook order stays fixed)
  let shown = true
  let hiddenForAge = false
  let isActive = false
  if (bounty) {
    const nowSec = _wallNowSec()
    const deadlineSec = Number(bounty.deadline)
    const isInactive = bounty.cancelled || nowSec > deadlineSec
    hiddenForAge = bounty.cancelled || (isInactive && nowSec > deadlineSec + HIDE_AFTER_SEC)
    const status = bountyStatus({
      winnersApproved: bounty.winnersApproved,
      maxWinners: bounty.maxWinners,
      deadline: bounty.deadline,
      cancelled: bounty.cancelled,
      reclaimedUnused: bounty.reclaimedUnused,
    })
    isActive = !hiddenForAge && status === 'OPEN'
    const q = query.trim().toLowerCase()
    const haystack = `${decodeBytes(bounty.title)} ${decodeBytes(bounty.description)}`.toLowerCase()
    shown = !hiddenForAge && matchesFilter(status, filter) && (q === '' || haystack.includes(q))
  }
  const loaded = bounty !== null

  useEffect(() => {
    if (loaded) onReport(idKey, hiddenForAge, shown, isActive)
  }, [loaded, hiddenForAge, shown, isActive, idKey, onReport])

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

const INITIAL_PAGE_SIZE = 6
const PAGE_STEP = 6

function BountyGrid({
  total,
  externalBounties,
  sourceFilter,
  onSelectBounty,
  onSelectExternalBounty,
  filter,
  query,
  onResetFilters,
  onAllHiddenChange,
}: {
  total: number
  externalBounties: ExternalBounty[]
  sourceFilter: SourceFilter
  onSelectBounty: (id: bigint) => void
  onSelectExternalBounty: (id: string) => void
  filter: StatusFilter
  query: string
  onResetFilters: () => void
  onAllHiddenChange: (hidden: boolean, activeCount: number) => void
}) {
  const ids = Array.from({ length: Math.min(total, 24) }, (_, i) => BigInt(total - i))
  const [agedOffMap, setAgedOffMap] = useState<Record<string, boolean>>({})
  const [activeMap, setActiveMap] = useState<Record<string, boolean>>({})
  const [visibleMap, setVisibleMap] = useState<Record<string, boolean>>({})
  const [limitByFilter, setLimitByFilter] = useState<Record<string, number>>({})

  const filterKey = `${filter}::${ query.trim().toLowerCase()}`
  const pageKey = `${filter}::${sourceFilter}::${query.trim().toLowerCase()}`
  const visibleLimit = limitByFilter[pageKey] ?? INITIAL_PAGE_SIZE

  const report = useCallback((id: string, hiddenForAge: boolean, shown: boolean, isActive: boolean) => {
    setAgedOffMap(prev => (prev[id] === hiddenForAge ? prev : { ...prev, [id]: hiddenForAge }))
    setActiveMap(prev => (prev[id] === isActive ? prev : { ...prev, [id]: isActive }))
    const scopedKey = `${filterKey}::${id}`
    setVisibleMap(prev => (prev[scopedKey] === shown ? prev : { ...prev, [scopedKey]: shown }))
  }, [filterKey])

  const allAgedReported = ids.length > 0 && ids.every(id => agedOffMap[id.toString()] !== undefined)
  const allHidden = allAgedReported && ids.every(id => agedOffMap[id.toString()] === true)
  const activeCount = allAgedReported
    ? ids.filter(id => activeMap[id.toString()] === true).length
    : Math.max(0, total - Object.values(agedOffMap).filter(Boolean).length)

  useEffect(() => {
    onAllHiddenChange(allHidden, activeCount)
  }, [allHidden, activeCount, onAllHiddenChange])

  const showNative = sourceFilter !== 'external'
  const showExternal = sourceFilter !== 'native'

  const nowSec = _wallNowSec()
  const q = query.trim().toLowerCase()
  const visibleExternal = showExternal
    ? externalBounties.filter(b => {
        const deadlineSec = Number(b.deadline)
        const isExpired = nowSec > deadlineSec
        const hiddenForAge = isExpired && nowSec > deadlineSec + HIDE_AFTER_SEC
        if (hiddenForAge) return false
        const status: BountyStatusType = isExpired ? 'EXPIRED' : 'OPEN'
        if (!matchesFilter(status, filter)) return false
        if (!q) return true
        const hay = `${b.title} ${b.description} ${b.poster_handle} ${b.poster_name} ${b.verified_source} ${b.category}`.toLowerCase()
        return hay.includes(q)
      })
    : []

  const allFilterReported = ids.length === 0 || ids.every(id => visibleMap[`${filterKey}::${id.toString()}`] !== undefined)
  const matchingNativeCount = showNative
    ? ids.filter(id => visibleMap[`${filterKey}::${id.toString()}`] !== false).length
    : 0
  const noNativeMatches = !showNative || ids.length === 0 || (allFilterReported && ids.every(id => visibleMap[`${filterKey}::${id.toString()}`] === false))
  const noMatches = noNativeMatches && visibleExternal.length === 0
  const noActiveFilter = filter === 'all' && sourceFilter === 'all' && query.trim() === ''

  const totalMatchingCount = matchingNativeCount + visibleExternal.length
  const externalQuota = Math.max(0, visibleLimit - matchingNativeCount)
  const paginatedExternal = visibleExternal.slice(0, externalQuota)
  const shownCount = Math.min(matchingNativeCount, visibleLimit) + paginatedExternal.length
  const remainingCount = Math.max(0, totalMatchingCount - shownCount)

  if (allHidden && externalBounties.length === 0) return null

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 desk:grid-cols-2 xl:grid-cols-3 gap-4 items-stretch">
        {showNative &&
          ids.slice(0, visibleLimit).map((id, i) => (
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
        {showExternal &&
          paginatedExternal.map((ext, idx) => (
            <motion.div
              key={ext.id}
              className="h-full"
              custom={idx}
              variants={cardVariants}
              initial="hidden"
              animate="visible"
              whileHover={{ y: -3, transition: { duration: 0.15 } }}
              whileTap={{ scale: 0.98, transition: { duration: 0.1 } }}
            >
              <div className="desk:hidden h-full">
                <ExternalBountyCard
                  bounty={ext}
                  index={idx}
                  onClick={() => onSelectExternalBounty(ext.id)}
                />
              </div>
              <div className="hidden desk:block h-full">
                <WallExternalBountyCard
                  bounty={ext}
                  index={idx}
                  onClick={() => onSelectExternalBounty(ext.id)}
                />
              </div>
            </motion.div>
          ))}
        {noMatches && !noActiveFilter && (
          <div className="col-span-full rounded-2xl border-[3px] border-dashed border-[#111] bg-white py-12 px-4 flex flex-col items-center justify-center gap-3 text-center shadow-hard-xs">
            <span className="font-mono-bold text-[12px] uppercase tracking-widest text-[#111]/75">
              No bounties match this filter or search.
            </span>
            <button
              type="button"
              onClick={onResetFilters}
              className="font-mono-bold text-[11px] uppercase tracking-wider bg-[#FFE600] text-[#111] border-[2px] border-[#111] px-4 py-1.5 rounded-full shadow-hard-xs hover:bg-[#FFE600]/85 btn-press cursor-pointer"
            >
              Reset to All Bounties →
            </button>
          </div>
        )}
      </div>

      {/* Pagination / Show More bar so the wall stays compact on PC & mobile */}
      {totalMatchingCount > INITIAL_PAGE_SIZE && (
        <div className="rounded-2xl border-[3px] border-[#111] bg-white p-3.5 sm:px-5 sm:py-3.5 shadow-hard-sm flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="font-mono-bold text-[11px] uppercase tracking-wider text-[#111] bg-[#FFFDF0] border-[2px] border-[#111] rounded-full px-3 py-1">
              Showing {shownCount} of {totalMatchingCount} bounties
            </span>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap justify-center">
            {remainingCount > 0 && (
              <button
                type="button"
                onClick={() =>
                  setLimitByFilter(prev => ({
                    ...prev,
                    [pageKey]: (prev[pageKey] ?? INITIAL_PAGE_SIZE) + PAGE_STEP,
                  }))
                }
                className="inline-flex items-center gap-1.5 font-heading font-extrabold text-[13px] uppercase tracking-wide bg-[#FFE600] hover:bg-[#FFE600]/85 text-[#111] border-[2.5px] border-[#111] px-5 py-2 rounded-full shadow-hard-xs btn-press cursor-pointer"
              >
                <span>Show More (+{Math.min(PAGE_STEP, remainingCount)})</span>
                <span aria-hidden="true">↓</span>
              </button>
            )}
            {remainingCount > PAGE_STEP && (
              <button
                type="button"
                onClick={() =>
                  setLimitByFilter(prev => ({
                    ...prev,
                    [pageKey]: totalMatchingCount + 24,
                  }))
                }
                className="inline-flex items-center gap-1 font-mono-bold text-[11px] uppercase tracking-wider bg-white hover:bg-[#FFFDF0] text-[#111] border-[2px] border-[#111] px-3.5 py-2 rounded-full shadow-hard-xs btn-press cursor-pointer"
              >
                <span>Show All ({totalMatchingCount})</span>
              </button>
            )}
            {visibleLimit > INITIAL_PAGE_SIZE && (
              <button
                type="button"
                onClick={() => {
                  setLimitByFilter(prev => ({
                    ...prev,
                    [pageKey]: INITIAL_PAGE_SIZE,
                  }))
                  document.getElementById('wall')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                }}
                className="inline-flex items-center gap-1 font-mono-bold text-[11px] uppercase tracking-wider bg-[#111] text-white hover:text-[#FFE600] border-[2px] border-[#111] px-3.5 py-2 rounded-full shadow-hard-xs btn-press cursor-pointer"
              >
                <span>Show Less ↑</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export function WallPage({ onSelectBounty, onSelectExternalBounty, onCreateBounty, refreshKey }: WallPageProps) {
  const [tab, setTab] = useState<Tab>('wall')
  const [filter, setFilter] = useState<StatusFilter>('all')
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all')
  const [query, setQuery] = useState('')
  const [hiddenSnapshot, setHiddenSnapshot] = useState<{ hidden: boolean; activeCount: number; totalBounties: number } | null>(null)
  const [externalBounties, setExternalBounties] = useState<ExternalBounty[]>([])
  const [syncingExternal, setSyncingExternal] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetchExternalBounties()
      .then(list => {
        if (!cancelled) setExternalBounties(list)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [refreshKey])

  async function handleSyncExternal() {
    setSyncingExternal(true)
    try {
      const res = await syncExternalBounties()
      setExternalBounties(res.bounties)
      toast.success(`Synced ${res.bounties.length} live external bounties!`)
    } catch {
      toast.error('Could not sync external bounties right now.')
    } finally {
      setSyncingExternal(false)
    }
  }

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

  const allBountiesHidden = !!hiddenSnapshot
    && hiddenSnapshot.totalBounties === totalBounties
    && hiddenSnapshot.hidden

  const activeBountiesCount = hiddenSnapshot && hiddenSnapshot.totalBounties === totalBounties
    ? hiddenSnapshot.activeCount
    : totalBounties

  const nowForStats = _wallNowSec()
  const activeExternalCount = externalBounties.filter(b => Number(b.deadline) > nowForStats).length
  const totalLiveBountiesCount = activeBountiesCount + activeExternalCount

  const handleAllHiddenChange = useCallback((hidden: boolean, activeCount: number) => {
    setHiddenSnapshot({ hidden, activeCount, totalBounties })
  }, [totalBounties])
  const totalPaid = (totalPaidRaw) ?? 0n

  return (
    <div className="flex flex-col gap-8">
      {/* Hero */}
      <div>
        <motion.section
          className="checkerboard border-[3px] border-[#111] rounded-2xl shadow-hard overflow-hidden p-4 sm:p-6 desk:p-8"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="desk:grid desk:grid-cols-[1.15fr_0.85fr] desk:gap-8 desk:items-center">
            <div className="flex flex-col gap-4">
              {/* Dedicated black card for headline & copy */}
              <div className="dark-grid-surface text-[#FFFDF0] rounded-2xl border-[3px] border-[#111] shadow-hard p-6 sm:p-8 relative overflow-hidden">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#C6F23A] text-[#111] border-[2px] border-[#111] font-mono-bold text-[10px] uppercase tracking-wider mb-4 shadow-[2px_2px_0_#FFFDF0]">
                  <span className="w-2 h-2 rounded-full bg-[#111] animate-pulse" />
                  100% Escrow Guaranteed on Arc
                </div>
                <h1
                  className="font-heading text-[36px] sm:text-[48px] desk:text-[54px] font-extrabold leading-[1.04] text-white text-balance"
                  style={{ letterSpacing: '-0.025em' }}
                >
                  Create a bounty.<br />
                  <span className="text-[#FFE600]">Get work done.</span>
                </h1>
                <div className="my-4 sm:my-5 border-t border-white/20" />
                <p className="font-heading text-[15px] sm:text-[17px] font-bold text-white/90 leading-relaxed">
                  Put your idea onchain, lock a USDC reward in smart-contract escrow, and let contributors compete to bring it to life.
                </p>
              </div>

              {/* Action buttons sitting on the cyan checkerboard */}
              <div className="flex items-center gap-3 flex-wrap">
                <button
                  type="button"
                  onClick={onCreateBounty}
                  className="inline-flex items-center gap-2 rounded-full border-[3px] border-[#111] shadow-hard btn-press bg-[#FFE600] text-[#111] font-heading font-extrabold uppercase tracking-wide px-6 py-3.5 text-[14px] sm:text-[15px] cursor-pointer"
                >
                  <span>+ Post a bounty</span>
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
                <div className="grid grid-cols-3 gap-2 pt-4 mt-1 border-t-[3px] border-[#111] desk:hidden">
                  <Stat value={totalLiveBountiesCount.toString()} numericValue={totalLiveBountiesCount} label="Bounties" />
                  <Stat value={`$${formatUsdc(totalEscrowed)}`} numericValue={Number(totalEscrowed) / 1e6} prefix="$" label="In escrow" />
                  <Stat value={`$${formatUsdc(totalPaid)}`} numericValue={Number(totalPaid) / 1e6} prefix="$" label="Paid out" icon={<CoinIcon size={20} />} />
                </div>
              )}
            </div>
            <HowItWorks />
          </div>
        </motion.section>
      </div>

      {/* Stats row — desktop only: framed in a crisp Neo-Brutalist 3-column card strip */}
      {CONTRACT_DEPLOYED && (
        <div className="hidden desk:grid grid-cols-3 gap-5 w-full">
          <StatItem
            icon={<NotepadIcon size={44} />}
            value={totalLiveBountiesCount.toString()}
            numericValue={totalLiveBountiesCount}
            label="Active Bounties"
            accent="#FFE600"
          />
          <StatItem
            icon={<UsdcCoinIcon size={44} />}
            value={`$${formatUsdc(totalEscrowed)}`}
            numericValue={Number(totalEscrowed) / 1e6}
            prefix="$"
            label="USDC Locked in Escrow"
            accent="#7FF3F0"
          />
          <StatItem
            icon={<TrophyBigIcon size={44} />}
            value={`$${formatUsdc(totalPaid)}`}
            numericValue={Number(totalPaid) / 1e6}
            prefix="$"
            label="USDC Paid to Winners"
            accent="#C6F23A"
          />
        </div>
      )}

      {/* Tabs + content */}
      <div id="wall" className="scroll-mt-24 flex flex-col gap-6">
        {/* Tab strip */}
        <motion.div
          className="flex gap-0 border-[3px] border-[#111] rounded-xl overflow-hidden shadow-hard w-fit bg-[#FFFDF0]"
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
        >
          {TAB_LABELS.map(({ id, label, color }) => {
            const active = tab === id
            return (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={`px-4 sm:px-5 py-2.5 font-mono-bold text-[11px] uppercase tracking-widest transition-colors border-r-[3px] border-[#111] last:border-r-0 cursor-pointer ${
                  active ? 'text-[#111]' : 'text-[#111]/75 hover:bg-[#111]/5'
                }`}
                style={{
                  backgroundColor: active ? color : '#FFFDF0',
                  color: active && id === 'my-bounties' ? '#FFFFFF' : '#111111',
                  minWidth: 0,
                }}
              >
                {label}
              </button>
            )
          })}
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
          !CONTRACT_DEPLOYED && externalBounties.length === 0 ? (
            <WindowCard title="BOUNTIES.EXE" titleBarColor="#A78BFA">
              <div className="checkerboard rounded-lg py-16 flex flex-col items-center gap-4">
                <TrophyIcon size={48} />
                <div className="font-mono-bold text-[12px] uppercase tracking-widest text-[#111]/60 text-center max-w-xs">
                  Contract not yet deployed.
                </div>
              </div>
            </WindowCard>
          ) : totalBountiesLoading && externalBounties.length === 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 desk:grid-cols-2 xl:grid-cols-3 gap-4">
              <SkeletonBountyCard />
              <SkeletonBountyCard />
              <SkeletonBountyCard />
            </div>
          ) : (totalBounties === 0 || allBountiesHidden) && externalBounties.length === 0 ? (
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
            <div className="border-[3px] border-[#111] rounded-2xl shadow-hard bg-[#FFFDF0] overflow-hidden">
              {/* Responsive toolbar: title, count, search */}
              <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 flex-wrap checkerboard border-b-[3px] border-[#111] px-4 sm:px-6 py-4 sm:py-5">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <span className="font-heading text-[18px] sm:text-[20px] font-extrabold uppercase tracking-wide text-[#111] bg-[#FFE600] border-[3px] border-[#111] shadow-hard-sm rounded-lg px-3.5 py-1">
                    Bounty Wall
                  </span>
                  <span className="font-mono-bold text-[11px] uppercase tracking-widest text-[#111] bg-white/90 border-[2px] border-[#111] rounded-full px-3 py-1">
                    {activeBountiesCount} onchain · {activeExternalCount} external
                  </span>
                </div>

                <label className="relative block w-full sm:max-w-[340px] sm:ml-auto">
                  <span className="sr-only">Search bounties</span>
                  <svg
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#111]"
                    viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"
                  >
                    <circle cx="8.5" cy="8.5" r="5.5" />
                    <path d="M13 13l4.5 4.5" />
                  </svg>
                  <input
                    type="search"
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    placeholder="Search bounties by keyword..."
                    className="w-full bg-white border-[3px] border-[#111] rounded-xl shadow-hard-sm pl-10 pr-8 py-2 font-mono-ui text-[13px] text-[#111] placeholder:text-[#111]/50 focus:outline-none focus:shadow-[5px_5px_0_#111] transition-shadow"
                  />
                  {query && (
                    <button
                      type="button"
                      onClick={() => setQuery('')}
                      aria-label="Clear search"
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-[#111] text-white font-mono-bold text-[11px] flex items-center justify-center hover:bg-[#FF3E9A] transition-colors cursor-pointer"
                    >
                      ×
                    </button>
                  )}
                </label>
              </div>

              <div className="flex flex-col gap-5 p-4 sm:p-6">
                {/* Filter pills + Source selector */}
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-2 flex-wrap">
                    {FILTERS.map(f => {
                      const active = filter === f.id
                      return (
                        <button
                          key={f.id}
                          type="button"
                          onClick={() => setFilter(f.id)}
                          aria-pressed={active}
                          className={`font-mono-bold text-[11px] uppercase tracking-wider text-[#111] px-4 py-1.5 rounded-full border-[2.5px] border-[#111] transition-all cursor-pointer ${
                            active
                              ? 'bg-[#FFE600] shadow-hard-sm -translate-y-0.5'
                              : 'bg-white hover:bg-[#FFE600]/40'
                          }`}
                        >
                          {f.label}
                        </button>
                      )
                    })}

                    <span className="hidden sm:inline-block h-5 w-[2px] bg-[#111]/20 mx-1" aria-hidden="true" />

                    {SOURCE_FILTERS.map(sf => {
                      const active = sourceFilter === sf.id
                      return (
                        <button
                          key={sf.id}
                          type="button"
                          onClick={() => setSourceFilter(sf.id)}
                          aria-pressed={active}
                          className={`font-mono-bold text-[11px] uppercase tracking-wider text-[#111] px-3.5 py-1.5 rounded-full border-[2.5px] border-[#111] transition-all cursor-pointer ${
                            active
                              ? 'bg-[#7FF3F0] shadow-hard-sm -translate-y-0.5'
                              : 'bg-white hover:bg-[#7FF3F0]/35'
                          }`}
                        >
                          {sf.label}
                        </button>
                      )
                    })}
                  </div>

                  <div className="flex items-center gap-2.5 flex-wrap">
                    {(filter !== 'all' || sourceFilter !== 'all' || query.trim() !== '') && (
                      <button
                        type="button"
                        onClick={() => { setFilter('all'); setSourceFilter('all'); setQuery('') }}
                        className="font-mono-bold text-[10px] uppercase tracking-wider text-[#111]/70 hover:text-[#111] underline underline-offset-2 cursor-pointer"
                      >
                        Reset filters
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => { void handleSyncExternal() }}
                      disabled={syncingExternal}
                      className="inline-flex items-center gap-1.5 font-mono-bold text-[10px] uppercase tracking-wider text-[#111] bg-white hover:bg-[#C6F23A] border-[2px] border-[#111] px-3 py-1.5 rounded-full shadow-hard-xs transition-colors btn-press cursor-pointer disabled:opacity-60"
                      title="Scan & refresh live external bounties"
                    >
                      <GlobeIcon size={12} />
                      <span>{syncingExternal ? 'Scanning…' : 'Sync External ↻'}</span>
                    </button>
                  </div>
                </div>

                {/* Framed Neo-Brutalist Outside Bounties Info Card */}
                {sourceFilter !== 'native' && externalBounties.length > 0 && (
                  <div className="rounded-2xl border-[3px] border-[#111] bg-white shadow-hard-sm overflow-hidden flex flex-col sm:flex-row sm:items-stretch">
                    <div className="bg-[#111] text-[#FFFDF0] px-4 py-2.5 sm:py-3 flex items-center gap-2.5 border-b-[2.5px] sm:border-b-0 sm:border-r-[3px] border-[#111] shrink-0">
                      <span className="w-7 h-7 rounded-lg bg-[#7FF3F0] border-[1.5px] border-white flex items-center justify-center text-[#111] shrink-0">
                        <GlobeIcon size={14} />
                      </span>
                      <div className="flex flex-col leading-tight">
                        <span className="font-heading text-[13px] font-extrabold uppercase tracking-wide text-[#FFE600]">
                          Outside Bounties
                        </span>
                        <span className="font-mono-bold text-[9px] uppercase tracking-widest text-white/75">
                          View-Only Feed
                        </span>
                      </div>
                    </div>
                    <div className="p-3 sm:px-4 sm:py-3 flex-1 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 bg-[#FFFDF0]">
                      <p className="font-mono-ui text-[11.5px] text-[#111]/85 leading-relaxed">
                        External bounties were <strong className="font-mono-bold text-[#111] underline decoration-[#FF3E9A] decoration-2 underline-offset-2">not posted or launched on Want.fun</strong>. They are curated live opportunities shown in view-only mode with direct links to each bounty&apos;s official participation page.
                      </p>
                      <span className="inline-flex items-center gap-1.5 self-start sm:self-center shrink-0 font-mono-bold text-[9.5px] uppercase tracking-wider px-2.5 py-1 rounded-full bg-[#C6F23A] border-[1.5px] border-[#111] text-[#111] shadow-[1px_1px_0_#111]">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#111]" />
                        {activeExternalCount} Live · Link Out
                      </span>
                    </div>
                  </div>
                )}

                <div className="desk:grid desk:grid-cols-[minmax(0,1fr)_272px] desk:gap-6 desk:items-start">
                  <BountyGrid
                    total={totalBounties}
                    externalBounties={externalBounties}
                    sourceFilter={sourceFilter}
                    onSelectBounty={onSelectBounty}
                    onSelectExternalBounty={onSelectExternalBounty}
                    filter={filter}
                    query={query}
                    onResetFilters={() => { setFilter('all'); setSourceFilter('all'); setQuery('') }}
                    onAllHiddenChange={handleAllHiddenChange}
                  />
                  <aside className="hidden desk:flex flex-col rounded-2xl border-[3px] border-[#111] bg-white shadow-hard overflow-hidden sticky top-24">
                    <div className="bg-[#A78BFA] border-b-[3px] border-[#111] px-4 py-2.5 flex items-center justify-between">
                      <span className="font-mono-bold text-[10px] uppercase tracking-widest text-[#111]">CREATOR_MODE.EXE</span>
                      <span className="w-2.5 h-2.5 rounded-full bg-[#C6F23A] border-[1.5px] border-[#111]" />
                    </div>
                    <div className="p-5 flex flex-col items-center text-center gap-3.5">
                      <TrophyBigIcon size={60} />
                      <h3 className="font-heading text-[20px] font-extrabold text-[#111] leading-tight">
                        Need something built or designed?
                      </h3>
                      <p className="font-mono-ui text-[12px] leading-relaxed text-[#111]/75">
                        Lock a USDC prize in smart-contract escrow, let builders compete, and pay only the winners you approve.
                      </p>
                      <div className="w-full rounded-xl bg-[#FFFDF0] border-[2px] border-[#111] p-3 text-left flex flex-col gap-1.5">
                        <div className="font-mono-bold text-[10px] text-[#111] flex items-center gap-1.5">
                          <span className="text-[#16a34a]">✓</span> Zero platform fee
                        </div>
                        <div className="font-mono-bold text-[10px] text-[#111] flex items-center gap-1.5">
                          <span className="text-[#16a34a]">✓</span> Reclaim unused funds anytime after deadline
                        </div>
                      </div>
                      <PillButton onClick={onCreateBounty} variant="yellow" size="md" className="w-full">
                        Post a bounty
                      </PillButton>
                    </div>
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
    <div className="rounded-xl border-[2px] border-[#111] bg-white/95 p-2.5 shadow-[2px_2px_0_#111] flex flex-col gap-0.5">
      <div className="flex items-center gap-1">
        <span className="font-heading text-[20px] sm:text-[24px] font-extrabold tabular-nums text-[#111] leading-none" style={{ letterSpacing: '-0.02em' }}>
          {numericValue !== undefined ? (
            <AnimatedCounter value={numericValue} prefix={prefix} decimals={prefix === '$' ? 2 : 0} />
          ) : (
            value
          )}
        </span>
        {icon}
      </div>
      <span className="font-mono-bold text-[9px] uppercase tracking-wider text-[#111]/70">{label}</span>
    </div>
  )
}

function StatItem({ icon, value, label, numericValue, prefix = '', accent = '#FFE600' }: {
  icon: React.ReactNode
  value: string
  label: string
  numericValue?: number
  prefix?: string
  accent?: string
}) {
  return (
    <div className="flex items-center gap-4 rounded-2xl border-[3px] border-[#111] bg-white p-5 shadow-hard min-w-0">
      <span
        className="w-16 h-16 rounded-xl border-[2.5px] border-[#111] shadow-hard-xs flex items-center justify-center shrink-0"
        style={{ backgroundColor: accent }}
      >
        {icon}
      </span>
      <div className="flex flex-col gap-1 min-w-0">
        <span className="font-heading text-[34px] font-extrabold tabular-nums text-[#111] leading-none truncate" style={{ letterSpacing: '-0.02em' }}>
          {numericValue !== undefined ? (
            <AnimatedCounter value={numericValue} prefix={prefix} decimals={prefix === '$' ? 2 : 0} />
          ) : (
            value
          )}
        </span>
        <span className="font-mono-bold text-[11px] uppercase tracking-wider text-[#111]/70">{label}</span>
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
            className="flex items-center gap-4 rounded-xl border-[3px] border-[#111] shadow-hard-sm px-4 py-2.5 transition-transform duration-150 hover:-translate-y-0.5"
            style={{ backgroundColor: s.color }}
          >
            <span className="font-heading text-[24px] font-extrabold tabular-nums text-[#111] bg-white/85 border-[2px] border-[#111] rounded-lg px-2 py-1 leading-none">
              {s.n}
            </span>
            <div className="min-w-0">
              <div className="font-heading text-[17px] font-extrabold text-[#111] leading-tight">{s.title}</div>
              <div className="font-mono-ui text-[12px] text-[#111] leading-snug">{s.text}</div>
            </div>
          </div>
        ))}
      </WindowCard>
    </div>
  )
}
