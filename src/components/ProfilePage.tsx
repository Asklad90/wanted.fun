import { useState, useCallback, useEffect, useMemo } from 'react'
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt, useWaitForTransactionReceipt as useWaitForWrite } from 'wagmi'
import { useSwitchChain } from 'wagmi'
import { isAddress, parseUnits } from 'viem'
import { BOUNTY_BOARD_ABI } from '../bounty-abi'
import { USDC_ADDRESS, USDC_DECIMALS, CONTRACT_ADDRESS, CHAIN_ID, CHAIN_NAME, getTxUrl, getAddressUrl } from '../bounty-config'
import { formatUsdc, formatAddress, parseOnchainError, decodeBytes, bountyStatus, timeLeft } from '../lib/utils'
import { fetchProfile, saveProfile, type OffchainProfile } from '../lib/submissions-api'
import { WindowCard } from './WindowCard'
import { StatusTag } from './StatusTag'
import { PixelAvatar, AVATAR_VARIANT_COUNT } from './PixelAvatar'
import { QRCode } from './QRCode'
import { SkeletonBountyRow } from './Skeleton'
import { TxStatus } from './TxStatus'
import {
  FolderIcon,
  LockIcon,
  TrophyIcon,
  CoinIcon,
  CheckCircleIcon,
  XIcon,
  GithubIcon,
  GlobeIcon,
} from './Icons'

// ─── MyStatus enum (mirrors Solidity) ────────────────────────────────────────
const MY_STATUS_NONE = 0
const MY_STATUS_SUBMITTED = 1
const MY_STATUS_WINNER_PENDING = 2
const MY_STATUS_WINNER_PAID = 3
const MY_STATUS_NOT_SELECTED = 4

const MY_STATUS_LABELS: Record<number, { label: string; color: string }> = {
  [MY_STATUS_NONE]: { label: 'NONE', color: '#FFFDF0' },
  [MY_STATUS_SUBMITTED]: { label: 'SUBMITTED', color: '#7FF3F0' },
  [MY_STATUS_WINNER_PENDING]: { label: 'WINNER (PENDING)', color: '#FFE600' },
  [MY_STATUS_WINNER_PAID]: { label: 'PAID', color: '#C6F23A' },
  [MY_STATUS_NOT_SELECTED]: { label: 'NOT SELECTED', color: '#e5e7eb' },
}

// Minimal ERC-20 ABI for balance + transfer
const ERC20_ABI = [
  { type: 'function', name: 'balanceOf', inputs: [{ name: 'account', type: 'address' }], outputs: [{ type: 'uint256' }], stateMutability: 'view' },
  { type: 'function', name: 'transfer', inputs: [{ name: 'to', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [{ type: 'bool' }], stateMutability: 'nonpayable' },
] as const

const PAGE_SIZE = 10n

interface ProfilePageProps {
  address: `0x${string}`
  onBack: () => void
  onSelectBounty: (id: bigint) => void
  onCreateBounty?: () => void
  onBrowseWall?: () => void
}

type ProfileTab = 'participating' | 'past' | 'posted'

function formatJoinedDate(epochSec?: number): string {
  if (!epochSec) return ''
  const d = new Date(epochSec * 1000)
  return d.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

// ─── Copy button ──────────────────────────────────────────────────────────────
function CopyButton({ text, label = 'Copy' }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      onClick={() => { void navigator.clipboard.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500) }) }}
      className="font-mono-bold text-[10px] uppercase tracking-widest border-[2px] border-[#111] rounded-full px-2 py-0.5 bg-[#FFE600] text-[#111] hover:shadow-hard-sm transition-shadow btn-press cursor-pointer"
    >
      {copied ? 'COPIED!' : label}
    </button>
  )
}

// ─── Reputation Badge Pill ────────────────────────────────────────────────────
function ReputationBadge({
  label,
  icon,
  bg,
  textColor = '#111',
  title,
}: {
  label: string
  icon: React.ReactNode
  bg: string
  textColor?: string
  title: string
}) {
  return (
    <div
      title={title}
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border-[2px] border-[#111] shadow-hard-sm font-mono-bold text-[10px] uppercase tracking-wider select-none cursor-help"
      style={{ backgroundColor: bg, color: textColor }}
    >
      <span className="inline-flex items-center shrink-0">{icon}</span>
      <span>{label}</span>
    </div>
  )
}

// ─── Stat card ────────────────────────────────────────────────────────────────
function ProfileStatCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string; color: string }) {
  return (
    <div className="border-[2px] border-[#111]/10 rounded-2xl p-4 flex flex-col gap-3 bg-white hover:border-[#111]/30 hover:shadow-sm transition-all" style={{ borderLeftColor: color, borderLeftWidth: '4px' }}>
      <div className="flex items-center justify-between">
        <span className="font-mono-ui text-[10px] uppercase tracking-widest text-[#111]/50">{label}</span>
        <span className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: color + '30' }}>{icon}</span>
      </div>
      <span className="font-heading text-[26px] font-extrabold tabular-nums leading-none text-[#111]">{value}</span>
    </div>
  )
}

// ─── Avatar picker (own profile only) ──────────────────────────────────────────
function AvatarPicker({ address, selected, onPick }: { address: string; selected: number; onPick: (variant: number) => void }) {
  return (
    <div className="flex gap-1.5 flex-wrap">
      {Array.from({ length: AVATAR_VARIANT_COUNT }, (_, v) => (
        <button
          key={v}
          type="button"
          onClick={() => onPick(v)}
          aria-label={`Avatar style ${v + 1}`}
          className={`rounded-md overflow-hidden border-[2px] transition-shadow btn-press ${v === selected ? 'border-[#111] shadow-hard-sm' : 'border-[#111]/25 hover:border-[#111]/60'}`}
        >
          <PixelAvatar address={address} size={30} variant={v} />
        </button>
      ))}
    </div>
  )
}

// ─── Reads one bounty's stats and reports it up ───────────────────────────────
interface BountyStatInfo {
  escrowRemaining: bigint
  winnersApproved: bigint
  maxWinners: bigint
  cancelled: boolean
}

function BountyStatsReader({ bountyId, onValue }: { bountyId: bigint; onValue: (id: string, info: BountyStatInfo) => void }) {
  const { data: bounty } = useReadContract({
    address: CONTRACT_ADDRESS, abi: BOUNTY_BOARD_ABI, functionName: 'getBounty',
    args: [bountyId], chainId: CHAIN_ID,
  }) as { data: { escrowRemaining: bigint; winnersApproved: bigint; maxWinners: bigint; cancelled: boolean } | undefined }

  useEffect(() => {
    if (bounty) {
      onValue(bountyId.toString(), {
        escrowRemaining: bounty.escrowRemaining,
        winnersApproved: bounty.winnersApproved,
        maxWinners: bounty.maxWinners,
        cancelled: bounty.cancelled,
      })
    }
  }, [bounty, bountyId, onValue])

  return null
}

// ─── Send modal ───────────────────────────────────────────────────────────────
interface SendModalProps {
  balance: bigint
  onClose: () => void
}
function SendModal({ balance, onClose }: SendModalProps) {
  const { chainId } = useAccount()
  const { switchChain } = useSwitchChain()
  const isWrongChain = chainId !== CHAIN_ID
  const [to, setTo] = useState('')
  const [amount, setAmount] = useState('')
  const [step, setStep] = useState<'form' | 'confirm'>('form')
  const [toErr, setToErr] = useState('')
  const [amountErr, setAmountErr] = useState('')

  const { writeContract, data: txHash, isPending, error: txErr, isSuccess } = useWriteContract()
  const { isLoading: confirming, isSuccess: confirmed } = useWaitForWrite({ hash: txHash })

  function validate() {
    let ok = true
    if (!isAddress(to) || to === '0x0000000000000000000000000000000000000000') {
      setToErr('Invalid recipient address'); ok = false
    } else { setToErr('') }
    let parsed: bigint
    try { parsed = parseUnits(amount || '0', USDC_DECIMALS) } catch { parsed = -1n }
    if (parsed <= 0n) { setAmountErr('Amount must be greater than 0'); ok = false }
    else if (parsed > balance) { setAmountErr('Insufficient USDC balance'); ok = false }
    else { setAmountErr('') }
    return ok
  }

  function handleReview() { if (validate()) setStep('confirm') }

  function handleSend() {
    if (isWrongChain) { switchChain({ chainId: CHAIN_ID }); return }
    const parsed = parseUnits(amount, USDC_DECIMALS)
    writeContract({ address: USDC_ADDRESS, abi: ERC20_ABI, functionName: 'transfer', args: [to as `0x${string}`, parsed], chainId: CHAIN_ID })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#111]/60" onClick={onClose}>
      <div onClick={e => e.stopPropagation()} className="w-full max-w-sm">
        <WindowCard title="SEND_USDC.EXE" titleBarColor="#FF3E9A" onClose={onClose}>
          {confirmed ? (
            <div className="flex flex-col gap-3 items-center text-center">
              <span className="font-heading text-[20px] font-extrabold text-[#111]">Sent!</span>
              {txHash && <a href={getTxUrl(txHash)} target="_blank" rel="noopener noreferrer" className="font-mono-bold text-[11px] uppercase tracking-widest text-[#1A1AE6] underline">View on explorer</a>}
              <button onClick={onClose} className="font-mono-bold text-[12px] uppercase tracking-widest bg-[#C6F23A] border-[3px] border-[#111] rounded-full px-4 py-2 shadow-hard-sm btn-press">Done</button>
            </div>
          ) : step === 'confirm' ? (
            <div className="flex flex-col gap-4">
              <p className="font-mono-bold text-[12px] uppercase tracking-widest text-[#111]/60">Confirm send</p>
              <div className="border-[2px] border-[#111] rounded-lg p-3 bg-[#FFFDF0] font-mono-ui text-[12px] text-[#111] break-all">
                <div><span className="text-[#111]/50">TO: </span>{to}</div>
                <div className="mt-1"><span className="text-[#111]/50">AMOUNT: </span><strong>{amount} USDC</strong></div>
              </div>
              {txErr && <p className="font-mono-bold text-[11px] text-[#FF3E9A]">{parseOnchainError(txErr)}</p>}
              <TxStatus hash={txHash} isPending={isPending} isConfirming={confirming} isSuccess={isSuccess} isError={!!txErr} error={txErr ? parseOnchainError(txErr) : undefined} successMessage="Transfer sent!" />
              <div className="flex gap-2">
                <button onClick={() => setStep('form')} disabled={isPending || confirming} className="flex-1 font-mono-bold text-[12px] uppercase tracking-widest bg-[#FFFDF0] border-[3px] border-[#111] rounded-full px-4 py-2.5 shadow-hard-sm btn-press disabled:opacity-40">Back</button>
                <button onClick={handleSend} disabled={isPending || confirming} className="flex-1 font-mono-bold text-[12px] uppercase tracking-widest bg-[#FFE600] border-[3px] border-[#111] rounded-full px-4 py-2.5 shadow-hard-sm btn-press disabled:opacity-40">
                  {isWrongChain ? 'Switch chain' : isPending ? 'Confirm in wallet...' : confirming ? 'Confirming...' : 'Send →'}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <label className="font-mono-bold text-[11px] uppercase tracking-widest text-[#111]">Recipient address</label>
                <input value={to} onChange={e => setTo(e.target.value)} placeholder="0x..." className="border-[3px] border-[#111] rounded-lg p-3 font-mono-ui text-[13px] bg-[#FFFDF0] focus:outline-none focus:ring-2 focus:ring-[#FF3E9A]" />
                {toErr && <p className="font-mono-bold text-[10px] text-[#FF3E9A]">{toErr}</p>}
              </div>
              <div className="flex flex-col gap-1">
                <label className="font-mono-bold text-[11px] uppercase tracking-widest text-[#111]">Amount (USDC)</label>
                <input value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" type="number" min="0" step="0.01" className="border-[3px] border-[#111] rounded-lg p-3 font-body text-[16px] bg-[#FFFDF0] focus:outline-none focus:ring-2 focus:ring-[#FF3E9A]" />
                {amountErr && <p className="font-mono-bold text-[10px] text-[#FF3E9A]">{amountErr}</p>}
              </div>
              <button onClick={handleReview} className="font-mono-bold text-[13px] uppercase tracking-widest bg-[#FFE600] border-[3px] border-[#111] rounded-full px-4 py-3 shadow-hard-sm btn-press">Review →</button>
            </div>
          )}
        </WindowCard>
      </div>
    </div>
  )
}

// ─── Receive modal ────────────────────────────────────────────────────────────
function ReceiveModal({ address, onClose }: { address: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#111]/60" onClick={onClose}>
      <div onClick={e => e.stopPropagation()} className="w-full max-w-sm">
        <WindowCard title="RECEIVE_USDC.EXE" titleBarColor="#7FF3F0" onClose={onClose}>
          <div className="flex flex-col items-center gap-4">
            <div className="border-[3px] border-[#111] rounded-lg overflow-hidden shadow-hard-sm">
              <QRCode value={address} size={180} />
            </div>
            <div className="w-full border-[2px] border-[#111] rounded-lg p-3 bg-[#FFFDF0] font-mono-ui text-[11px] text-[#111] break-all text-center">
              {address}
            </div>
            <CopyButton text={address} label="Copy address" />
            <p className="font-mono-ui text-[10px] uppercase tracking-widest text-[#111]/50 text-center">USDC on {CHAIN_NAME} only</p>
          </div>
        </WindowCard>
      </div>
    </div>
  )
}

// Module-level timestamp snapshot — avoids impure Date.now() inside render
const _rowNowSec = (): number => Date.now() / 1000

// ─── Bounty row in profile tabs ───────────────────────────────────────────────
function BountyRow({ bountyId, profileAddr, onSelect, tabMode }: {
  bountyId: bigint
  profileAddr: `0x${string}`
  onSelect: (id: bigint) => void
  tabMode: 'participating' | 'past' | 'posted'
}) {
  const { data: bounty } = useReadContract({
    address: CONTRACT_ADDRESS, abi: BOUNTY_BOARD_ABI, functionName: 'getBounty',
    args: [bountyId], chainId: CHAIN_ID,
  }) as { data: { title: `0x${string}`; rewardPerWinner: bigint; deadline: bigint; winnersApproved: bigint; maxWinners: bigint; cancelled: boolean; escrowRemaining: bigint; reclaimedUnused: boolean } | undefined }

  const { data: myStatusRaw } = useReadContract({
    address: CONTRACT_ADDRESS, abi: BOUNTY_BOARD_ABI, functionName: 'getMyStatus',
    args: [bountyId, profileAddr], chainId: CHAIN_ID,
  }) as { data: number | undefined }

  if (!bounty) return <SkeletonBountyRow />

  const isOpen = !bounty.cancelled && Number(bounty.deadline) > Math.floor(_rowNowSec()) && Number(bounty.winnersApproved) < Number(bounty.maxWinners)

  // Filter by tab: participating = open bounties, past = closed
  if (tabMode === 'participating' && !isOpen) return null
  if (tabMode === 'past' && isOpen) return null

  const titleStr = decodeBytes(bounty.title)
  const status = bountyStatus(bounty)
  const myStatus = myStatusRaw ?? MY_STATUS_NONE
  const myStatusInfo = MY_STATUS_LABELS[myStatus] ?? MY_STATUS_LABELS[MY_STATUS_NONE]

  return (
    <button
      onClick={() => onSelect(bountyId)}
      className="group w-full text-left border-[3px] border-[#111] rounded-xl p-3.5 bg-white shadow-hard-sm hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-hard transition-all flex items-center justify-between gap-3 cursor-pointer"
    >
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <span className="shrink-0 font-mono-bold text-[10px] uppercase tracking-wider px-2.5 py-1.5 rounded-lg bg-[#111] text-[#FFE600] border-[2px] border-[#111]">
          #{bountyId.toString().padStart(3, '0')}
        </span>
        <div className="flex flex-col gap-1 min-w-0 flex-1">
          <span className="font-heading text-[15px] font-extrabold text-[#111] group-hover:text-[#1A1AE6] truncate">{titleStr || '(untitled)'}</span>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1 font-mono-bold text-[10px] uppercase tracking-wider bg-[#FFE600] text-[#111] border-[1.5px] border-[#111] rounded-md px-2 py-0.5">
              <CoinIcon size={11} />
              {formatUsdc(bounty.rewardPerWinner)} USDC
            </span>
            <span className="font-mono-bold text-[10px] uppercase tracking-wider text-[#111]/60">
              {timeLeft(bounty.deadline)}
            </span>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <div className="flex flex-col items-end gap-1">
          <StatusTag status={status} />
          {myStatus !== MY_STATUS_NONE && (
            <span
              className="font-mono-bold text-[9px] uppercase tracking-widest border-[2px] border-[#111] rounded-full px-2 py-0.5 shadow-hard-xs"
              style={{ backgroundColor: myStatusInfo.color }}
            >{myStatusInfo.label}</span>
          )}
        </div>
        <span className="hidden sm:flex w-8 h-8 rounded-full bg-[#FFFDF0] group-hover:bg-[#FFE600] border-[2px] border-[#111] items-center justify-center font-mono-bold text-[12px] text-[#111] transition-colors">
          →
        </span>
      </div>
    </button>
  )
}

// ─── Main ProfilePage ─────────────────────────────────────────────────────────
export function ProfilePage({ address, onBack, onSelectBounty, onCreateBounty, onBrowseWall }: ProfilePageProps) {
  const { address: connectedAddr } = useAccount()
  const isOwn = connectedAddr?.toLowerCase() === address.toLowerCase()

  const [tab, setTab] = useState<ProfileTab>('participating')
  const [showSend, setShowSend] = useState(false)
  const [showReceive, setShowReceive] = useState(false)

  // Off-chain profile (bio, avatar style, twitter, github, website)
  const [profile, setProfile] = useState<OffchainProfile>({ bio: '', avatar_variant: 0 })
  const [editingProfile, setEditingProfile] = useState(false)
  const [bioDraft, setBioDraft] = useState('')
  const [avatarDraft, setAvatarDraft] = useState(0)
  const [twitterDraft, setTwitterDraft] = useState('')
  const [githubDraft, setGithubDraft] = useState('')
  const [websiteDraft, setWebsiteDraft] = useState('')
  const [savingProfile, setSavingProfile] = useState(false)
  const [profileSaveErr, setProfileSaveErr] = useState('')

  useEffect(() => {
    let cancelled = false
    fetchProfile(address).then(p => { if (!cancelled) setProfile(p) })
    return () => { cancelled = true }
  }, [address])

  function startEditingProfile() {
    setBioDraft(profile.bio || '')
    setAvatarDraft(profile.avatar_variant || 0)
    setTwitterDraft(profile.twitter || '')
    setGithubDraft(profile.github || '')
    setWebsiteDraft(profile.website || '')
    setProfileSaveErr('')
    setEditingProfile(true)
  }

  async function handleSaveProfile() {
    setSavingProfile(true)
    setProfileSaveErr('')
    const result = await saveProfile(address, {
      bio: bioDraft,
      avatarVariant: avatarDraft,
      twitter: twitterDraft,
      github: githubDraft,
      website: websiteDraft,
    })
    setSavingProfile(false)
    if (result.ok) {
      setProfile(prev => ({
        ...prev,
        bio: bioDraft.trim(),
        avatar_variant: avatarDraft,
        twitter: twitterDraft.trim() || undefined,
        github: githubDraft.trim() || undefined,
        website: websiteDraft.trim() || undefined,
      }))
      setEditingProfile(false)
    } else {
      setProfileSaveErr(result.error ?? 'Could not save your profile. Please try again.')
    }
  }

  // Earnings
  const { data: earningsRaw } = useReadContract({
    address: CONTRACT_ADDRESS, abi: BOUNTY_BOARD_ABI, functionName: 'getEarnings',
    args: [address], chainId: CHAIN_ID,
  }) as { data: [bigint, bigint, bigint] | undefined }
  const earned = earningsRaw?.[0] ?? 0n
  const pendingEarnings = earningsRaw?.[1] ?? 0n
  const wins = earningsRaw?.[2] ?? 0n

  // Paginated lists
  const [submittedOffset] = useState(0n)
  const [postedOffset] = useState(0n)

  const { data: submittedIds } = useReadContract({
    address: CONTRACT_ADDRESS, abi: BOUNTY_BOARD_ABI, functionName: 'getSubmittedBounties',
    args: [address, submittedOffset, PAGE_SIZE], chainId: CHAIN_ID,
  }) as { data: readonly bigint[] | undefined }

  const { data: postedIds } = useReadContract({
    address: CONTRACT_ADDRESS, abi: BOUNTY_BOARD_ABI, functionName: 'getPostedBounties',
    args: [address, postedOffset, PAGE_SIZE], chainId: CHAIN_ID,
  }) as { data: readonly bigint[] | undefined }

  const { data: totalPosted } = useReadContract({
    address: CONTRACT_ADDRESS, abi: BOUNTY_BOARD_ABI, functionName: 'getBountiesByPoster',
    args: [address], chainId: CHAIN_ID,
  }) as { data: readonly bigint[] | undefined }

  const hasPosted = (totalPosted?.length ?? 0) > 0

  // Track stats across all bounties this address posted
  const [bountyStats, setBountyStats] = useState<Record<string, BountyStatInfo>>({})
  const onBountyStat = useCallback((id: string, info: BountyStatInfo) => {
    setBountyStats(prev => ({ ...prev, [id]: info }))
  }, [])

  const escrowTotal = useMemo(
    () => Object.values(bountyStats).reduce((sum, v) => sum + v.escrowRemaining, 0n),
    [bountyStats],
  )

  // ── Reputation Badges ────────────────────────────────────────────────────────
  // 1. "First Catch": First bounty won
  const isFirstCatch = wins >= 1n
  // 2. "Heavy Hitter": Earned > $500 USDC
  const isHeavyHitter = earned >= 500_000_000n
  // 3. "Promise Keeper": 100% payout rate on posted bounties (posted bounties, >=1 paid winner, zero unpaid cancellations)
  const allPostedStats = Object.values(bountyStats)
  const isPromiseKeeper =
    hasPosted &&
    allPostedStats.length > 0 &&
    allPostedStats.some(b => b.winnersApproved > 0n) &&
    allPostedStats.every(b => !b.cancelled && (b.escrowRemaining === 0n || b.winnersApproved > 0n))

  // USDC balance (only read if own profile)
  const { data: balanceRaw, refetch: refetchBalance } = useReadContract({
    address: USDC_ADDRESS, abi: ERC20_ABI, functionName: 'balanceOf',
    args: [address], chainId: CHAIN_ID,
    query: { enabled: isOwn },
  }) as { data: bigint | undefined; refetch: () => void }
  const balance = balanceRaw ?? 0n

  // Profile URL
  const profileUrl = `${window.location.origin}${window.location.pathname}#/profile/${address}`

  const handleSendClose = useCallback(() => { setShowSend(false); refetchBalance() }, [refetchBalance])

  const submittedList: readonly bigint[] = submittedIds ?? []
  const postedList: readonly bigint[] = postedIds ?? []

  // Both tabs get the same submitted list; BountyRow filters itself by deadline/status
  const participatingIds = submittedList
  const pastIds = submittedList

  const hasPendingClaims = pendingEarnings > 0n && isOwn

  const TABS: { id: ProfileTab; label: string; color: string }[] = [
    { id: 'participating', label: 'PARTICIPATING', color: '#7FF3F0' },
    { id: 'past', label: 'PAST', color: '#8B5CF6' },
    { id: 'posted', label: 'CREATED', color: '#FF3E9A' },
  ]

  const cleanTwitter = profile.twitter?.replace(/^@/, '').trim()
  const cleanGithub = profile.github?.replace(/^@/, '').trim()
  const cleanWebsite = profile.website?.trim()
  const hasSocials = !!(cleanTwitter || cleanGithub || cleanWebsite)

  return (
    <div className="flex flex-col gap-5">
      {/* Top action control bar */}
      <div className="flex items-center justify-between gap-3 flex-wrap border-[3px] border-[#111] rounded-2xl bg-white shadow-hard px-4 py-3">
        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-1.5 font-mono-bold text-[11px] uppercase tracking-wider text-[#111] bg-[#FFFDF0] hover:bg-[#FFE600] border-[2.5px] border-[#111] px-3.5 py-1.5 rounded-full shadow-hard-xs transition-colors btn-press cursor-pointer"
          >
            <span aria-hidden="true">←</span>
            <span>Back to Wall</span>
          </button>
          <span className="hidden sm:inline-flex items-center gap-1.5 font-mono-bold text-[10px] uppercase tracking-widest px-3 py-1 rounded-full bg-[#111] text-[#7FF3F0] border-[2px] border-[#111]">
            <span className="w-1.5 h-1.5 rounded-full bg-[#C6F23A]" />
            Onchain Identity · Arc
          </span>
        </div>

        <div className="flex items-center gap-2">
          {isOwn && !editingProfile && (
            <button
              type="button"
              onClick={startEditingProfile}
              className="inline-flex items-center gap-1.5 font-mono-bold text-[10px] uppercase tracking-widest px-3 py-1.5 rounded-full border-[2px] border-[#111] bg-[#7FF3F0] hover:bg-[#FFE600] text-[#111] shadow-hard-xs transition-colors btn-press cursor-pointer"
            >
              <svg width="11" height="11" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M11.5 2.5L13.5 4.5L5.5 12.5H3.5V10.5L11.5 2.5Z" stroke="#111" strokeWidth="1.5" strokeLinejoin="round" fill="none" />
              </svg>
              <span>Edit Profile</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => { void navigator.clipboard.writeText(profileUrl) }}
            className="inline-flex items-center gap-1.5 font-mono-bold text-[10px] uppercase tracking-widest px-3 py-1.5 rounded-full border-[2px] border-[#111] bg-[#FFE600] hover:bg-[#111] hover:text-[#FFE600] text-[#111] shadow-hard-xs transition-colors btn-press cursor-pointer"
          >
            <span>Share Profile</span>
            <span>↗</span>
          </button>
        </div>
      </div>

      {/* Hidden readers — collect stats across every bounty this address posted */}
      {totalPosted?.map(id => <BountyStatsReader key={id.toString()} bountyId={id} onValue={onBountyStat} />)}

      {/* ── Header window ─────────────────────────────────────────────────── */}
      <WindowCard title="USER_PROFILE.EXE" titleBarColor="#7FF3F0" bodyClassName="flex flex-col gap-0 !p-0">

        {/* ── TOP: checkerboard zone — framed white identity card ───── */}
        <div className="checkerboard p-4 sm:p-5 border-b-[3px] border-[#111]">
          <div className="bg-white border-[3px] border-[#111] rounded-2xl p-4 sm:p-5 shadow-hard-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-start sm:items-center gap-4 min-w-0 flex-1">
              {/* Avatar with edit pencil */}
              <div className="relative shrink-0">
                <div className="border-[3px] border-[#111] rounded-2xl overflow-hidden shadow-hard-sm bg-[#FFFDF0]">
                  <PixelAvatar address={address} size={84} variant={profile.avatar_variant} />
                </div>
                {isOwn && !editingProfile && (
                  <button
                    onClick={startEditingProfile}
                    className="absolute -bottom-1.5 -right-1.5 w-7 h-7 rounded-full bg-[#FFE600] border-[2px] border-[#111] flex items-center justify-center shadow-hard-xs cursor-pointer hover:bg-[#111] hover:text-[#FFE600] text-[#111] transition-colors"
                    title="Edit profile"
                  >
                    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                      <path d="M11.5 2.5L13.5 4.5L5.5 12.5H3.5V10.5L11.5 2.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" fill="none" />
                    </svg>
                  </button>
                )}
              </div>

              {/* Address + badges + bio */}
              <div className="flex flex-col gap-2 min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono-bold text-[9px] uppercase tracking-widest px-2 py-0.5 rounded-md bg-[#111] text-[#FFE600] border-[1.5px] border-[#111]">
                    {isOwn ? 'YOUR WALLET' : 'HUNTER / CREATOR'}
                  </span>
                  <span className="font-mono-ui text-[11px] text-[#111]/60">
                    Joined {formatJoinedDate(profile.created_at || Math.floor(Date.now() / 1000))}
                  </span>
                </div>

                {/* Address + copy */}
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-heading text-[22px] sm:text-[26px] font-extrabold text-[#111] truncate leading-none">{formatAddress(address)}</span>
                  <button
                    onClick={() => { void navigator.clipboard.writeText(address) }}
                    className="inline-flex items-center gap-1 border-[2px] border-[#111] rounded-lg px-2 py-1 bg-[#FFFDF0] shadow-hard-xs hover:bg-[#FFE600] transition-colors cursor-pointer shrink-0 font-mono-bold text-[10px] uppercase tracking-wider text-[#111]"
                    title="Copy address"
                  >
                    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                      <rect x="5" y="5" width="9" height="9" rx="1.5" stroke="#111" strokeWidth="1.5" fill="none"/>
                      <path d="M4 11H3C2.4 11 2 10.6 2 10V3C2 2.4 2.4 2 3 2H10C10.6 2 11 2.4 11 3V4" stroke="#111" strokeWidth="1.5" strokeLinecap="round"/>
                    </svg>
                    <span>Copy</span>
                  </button>
                </div>

                {/* Reputation badges row */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  {isFirstCatch && (
                    <ReputationBadge
                      label="First Catch"
                      icon={
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                          <path d="M12 2L15 9L22 12L15 15L12 22L9 15L2 12L9 9L12 2Z" />
                        </svg>
                      }
                      bg="#FFE600"
                      title="First bounty won on Want.fun"
                    />
                  )}
                  {hasPosted && (
                    <ReputationBadge
                      label="Want Creator"
                      icon={
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                          <path d="M12 2L14.5 9.5L22 12L14.5 14.5L12 22L9.5 14.5L2 12L9.5 9.5L12 2Z" />
                        </svg>
                      }
                      bg="#FF3E9A"
                      textColor="#fff"
                      title="Has created bounties on Want.fun"
                    />
                  )}
                  {isHeavyHitter && (
                    <ReputationBadge
                      label="Heavy Hitter"
                      icon={
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                          <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
                        </svg>
                      }
                      bg="#FF3E9A"
                      textColor="#FFFDF0"
                      title="Earned > $500 USDC on Want.fun"
                    />
                  )}
                  {isPromiseKeeper && (
                    <ReputationBadge
                      label="Promise Keeper"
                      icon={
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d="M20 6L9 17l-5-5" />
                        </svg>
                      }
                      bg="#C6F23A"
                      title="100% payout rate on created bounties"
                    />
                  )}
                </div>

                {/* Bio pill */}
                {!editingProfile && (profile.bio ? (
                  <div className="inline-flex items-center gap-2 bg-[#FFFDF0] border-[2px] border-[#111] rounded-xl px-3 py-1.5 shadow-hard-xs w-fit max-w-full">
                    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" className="shrink-0" aria-hidden="true">
                      <rect x="2" y="2" width="12" height="12" rx="2" stroke="#111" strokeWidth="1.5" fill="none"/>
                      <path d="M5 6h6M5 9h4" stroke="#111" strokeWidth="1.5" strokeLinecap="round"/>
                    </svg>
                    <span className="font-mono-ui text-[12px] font-bold text-[#111]">{profile.bio}</span>
                  </div>
                ) : isOwn ? (
                  <button onClick={startEditingProfile} className="font-mono-bold text-[11px] uppercase tracking-widest text-[#1A1AE6] underline self-start cursor-pointer">
                    + Add bio &amp; socials
                  </button>
                ) : null)}
              </div>
            </div>

            {/* Right quick-earned showcase box inside the hero card */}
            <div className="w-full md:w-auto dark-grid-surface bg-[#111] border-[2.5px] border-[#111] rounded-xl p-3.5 sm:px-5 flex items-center justify-between md:flex-col md:items-end gap-2 shadow-hard-xs shrink-0">
              <span className="font-mono-bold text-[9px] uppercase tracking-widest text-white/60">Total Earned</span>
              <div className="flex items-center gap-2">
                <CoinIcon size={22} />
                <span className="font-heading text-[24px] sm:text-[28px] font-extrabold tabular-nums text-[#FFE600] leading-none">
                  ${formatUsdc(earned)}
                </span>
                <span className="font-mono-bold text-[10px] uppercase tracking-wider text-white/70">USDC</span>
              </div>
              <span className="font-mono-bold text-[10px] text-[#C6F23A]">
                {wins.toString()} bounty win{wins === 1n ? '' : 's'}
              </span>
            </div>
          </div>
        </div>

        {/* ── MIDDLE: dark card — socials + editor + share bar ───────────── */}
        <div className="dark-grid-surface bg-[#111] px-4 sm:px-5 py-4 flex flex-col gap-3">
          {/* Profile editor (own only) */}
          {editingProfile && (
            <div className="flex flex-col gap-3 border-[2px] border-white/20 rounded-xl p-3.5 bg-white/5">
              <div className="flex flex-col gap-1">
                <label className="font-mono-bold text-[10px] uppercase tracking-widest text-white/50">Bio</label>
                <textarea
                  value={bioDraft}
                  onChange={e => setBioDraft(e.target.value.slice(0, 160))}
                  rows={2}
                  maxLength={160}
                  placeholder="Onchain builder | Always looking for cool bounties to work on."
                  className="border-[2px] border-white/20 rounded-md p-2 font-mono-ui text-[12px] bg-white/10 text-white placeholder:text-white/30 resize-none focus:outline-none focus:border-[#FFE600]"
                />
                <span className="font-mono-ui text-[9px] text-white/30 self-end">{bioDraft.length}/160</span>
              </div>

              <p className="font-mono-bold text-[10px] uppercase tracking-widest text-white/50">Avatar style</p>
              <AvatarPicker address={address} selected={avatarDraft} onPick={setAvatarDraft} />

              <p className="font-mono-bold text-[10px] uppercase tracking-widest text-white/50">Connect Socials</p>
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2 border-[2px] border-white/20 rounded-md bg-white/10 p-1.5">
                  <div className="w-6 h-6 rounded bg-black flex items-center justify-center text-white shrink-0 border border-white/20">
                    <XIcon size={12} />
                  </div>
                  <input value={twitterDraft} onChange={e => setTwitterDraft(e.target.value)} placeholder="Twitter / X (@username)" className="font-mono-ui text-[12px] bg-transparent flex-1 focus:outline-none text-white placeholder:text-white/30" />
                </div>
                <div className="flex items-center gap-2 border-[2px] border-white/20 rounded-md bg-white/10 p-1.5">
                  <div className="w-6 h-6 rounded bg-[#24292e] flex items-center justify-center text-white shrink-0 border border-white/20">
                    <GithubIcon size={13} />
                  </div>
                  <input value={githubDraft} onChange={e => setGithubDraft(e.target.value)} placeholder="GitHub (username)" className="font-mono-ui text-[12px] bg-transparent flex-1 focus:outline-none text-white placeholder:text-white/30" />
                </div>
                <div className="flex items-center gap-2 border-[2px] border-white/20 rounded-md bg-white/10 p-1.5">
                  <div className="w-6 h-6 rounded bg-[#7FF3F0] flex items-center justify-center text-[#111] shrink-0">
                    <GlobeIcon size={13} />
                  </div>
                  <input value={websiteDraft} onChange={e => setWebsiteDraft(e.target.value)} placeholder="Website (https://...)" className="font-mono-ui text-[12px] bg-transparent flex-1 focus:outline-none text-white placeholder:text-white/30" />
                </div>
              </div>

              {profileSaveErr && <p className="font-mono-bold text-[10px] text-[#FF3E9A]">{profileSaveErr}</p>}
              <div className="flex items-center justify-end gap-2 pt-1">
                <button onClick={() => setEditingProfile(false)} disabled={savingProfile} className="font-mono-bold text-[11px] uppercase tracking-widest bg-white/10 border-[2px] border-white/20 text-white rounded-full px-3 py-1.5 btn-press disabled:opacity-40 cursor-pointer">Cancel</button>
                <button onClick={() => void handleSaveProfile()} disabled={savingProfile} className="font-mono-bold text-[11px] uppercase tracking-widest bg-[#FFE600] border-[2px] border-[#FFE600] text-[#111] rounded-full px-3 py-1.5 btn-press disabled:opacity-40 cursor-pointer">{savingProfile ? 'Saving...' : 'Save'}</button>
              </div>
            </div>
          )}

          {/* Connected socials + shareable profile link row */}
          {!editingProfile && (
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2 flex-wrap">
                {hasSocials ? (
                  <>
                    {cleanTwitter && (
                      <a href={`https://x.com/${cleanTwitter}`} target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 bg-white text-[#111] border-[2px] border-[#111] rounded-full px-3 py-1 font-mono-bold text-[11px] tracking-wide hover:bg-[#FFE600] transition-colors shadow-hard-xs"
                      >
                        <XIcon size={11} />
                        <span>@{cleanTwitter}</span>
                        <span>↗</span>
                      </a>
                    )}
                    {cleanGithub && (
                      <a href={`https://github.com/${cleanGithub}`} target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 bg-[#24292e] border-[2px] border-white/30 rounded-full px-3 py-1 font-mono-bold text-[11px] text-white tracking-wide hover:border-[#FFE600] transition-colors"
                      >
                        <GithubIcon size={12} />
                        <span>{cleanGithub}</span>
                        <span>↗</span>
                      </a>
                    )}
                    {cleanWebsite && (
                      <a href={cleanWebsite.startsWith('http') ? cleanWebsite : `https://${cleanWebsite}`} target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 bg-[#7FF3F0] border-[2px] border-[#111] rounded-full px-3 py-1 font-mono-bold text-[11px] text-[#111] tracking-wide hover:bg-[#FFE600] transition-colors shadow-hard-xs"
                      >
                        <GlobeIcon size={12} />
                        <span>{cleanWebsite.replace(/^https?:\/\//, '').replace(/\/$/, '')}</span>
                      </a>
                    )}
                  </>
                ) : (
                  <span className="font-mono-ui text-[11px] text-white/60">
                    No social accounts linked yet.
                  </span>
                )}
              </div>

              {/* Shareable link bar */}
              <div className="flex items-center gap-2 border-[2px] border-[#111] rounded-xl px-2.5 py-1.5 bg-[#FFFDF0] sm:max-w-xs w-full">
                <span className="font-mono-ui text-[10px] text-[#111]/60 flex-1 truncate">{profileUrl}</span>
                <button
                  onClick={() => { void navigator.clipboard.writeText(profileUrl) }}
                  className="inline-flex items-center gap-1 font-mono-bold text-[9px] uppercase tracking-widest border-[1.5px] border-[#111] rounded-full px-2.5 py-0.5 bg-[#FFE600] text-[#111] hover:bg-[#111] hover:text-[#FFE600] transition-colors cursor-pointer shrink-0"
                >
                  Copy URL
                </button>
              </div>
            </div>
          )}
        </div>
      </WindowCard>

      {/* ── Activity Stats ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">

        {/* Hunter stats panel */}
        <div className="border-[3px] border-[#111] rounded-2xl overflow-hidden bg-white shadow-hard">
          <div className="bg-[#111] border-b-[3px] border-[#111] px-4 py-2.5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrophyIcon size={15} className="text-[#FFE600]" />
              <span className="font-mono-bold text-[11px] uppercase tracking-widest text-[#FFE600]">Hunter Activity</span>
            </div>
            <span className="w-2.5 h-2.5 rounded-full bg-[#C6F23A] border border-white/40" />
          </div>
          <div className="p-4 flex flex-col gap-3.5">
            {/* Win rate bar */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <span className="font-mono-bold text-[10px] uppercase tracking-widest text-[#111]/60">Win rate</span>
                <span className="font-mono-bold text-[13px] text-[#111]">
                  {submittedList.length > 0 ? `${Math.round(Number(wins * 100n) / submittedList.length)}%` : '—'}
                </span>
              </div>
              <div className="h-3 rounded-full bg-[#FFFDF0] overflow-hidden border-[2px] border-[#111]">
                <div
                  className="h-full bg-[#C6F23A] transition-all duration-500"
                  style={{ width: submittedList.length > 0 ? `${Math.min(100, Math.round(Number(wins * 100n) / submittedList.length))}%` : '0%' }}
                />
              </div>
            </div>
            {/* Three inline stats */}
            <div className="grid grid-cols-3 gap-2.5 pt-1">
              <div className="border-[2px] border-[#111] rounded-xl p-2.5 bg-[#FFFDF0] shadow-hard-xs flex flex-col gap-0.5 items-center text-center">
                <span className="font-heading text-[22px] sm:text-[24px] font-black text-[#111] tabular-nums leading-none">{submittedList.length}</span>
                <span className="font-mono-bold text-[9px] uppercase tracking-widest text-[#111]/60">Submitted</span>
              </div>
              <div className="border-[2px] border-[#111] rounded-xl p-2.5 bg-[#C6F23A]/25 shadow-hard-xs flex flex-col gap-0.5 items-center text-center">
                <span className="font-heading text-[22px] sm:text-[24px] font-black text-[#16a34a] tabular-nums leading-none">{wins.toString()}</span>
                <span className="font-mono-bold text-[9px] uppercase tracking-widest text-[#111]/60">Won</span>
              </div>
              <div className="border-[2px] border-[#111] rounded-xl p-2.5 bg-[#FFE600]/30 shadow-hard-xs flex flex-col gap-0.5 items-center text-center">
                <span className="font-heading text-[22px] sm:text-[24px] font-black text-[#111] tabular-nums leading-none">${formatUsdc(earned)}</span>
                <span className="font-mono-bold text-[9px] uppercase tracking-widest text-[#111]/60">Earned</span>
              </div>
            </div>
            {pendingEarnings > 0n && (
              <div className="flex items-center gap-2 bg-[#FFE600]/30 border-[2px] border-[#111] rounded-xl px-3 py-2 shadow-hard-xs">
                <ClockIcon size={13} className="text-[#111] shrink-0" />
                <span className="font-mono-bold text-[10px] text-[#111]">
                  ${formatUsdc(pendingEarnings)} USDC payout pending
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Creator stats panel (always shown, greyed out if no posts) */}
        <div className="border-[3px] border-[#111] rounded-2xl overflow-hidden bg-white shadow-hard">
          <div className="bg-[#111] border-b-[3px] border-[#111] px-4 py-2.5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FolderIcon size={15} className="text-[#FF3E9A]" />
              <span className="font-mono-bold text-[11px] uppercase tracking-widest text-[#FF3E9A]">Creator Activity</span>
            </div>
            <span className="w-2.5 h-2.5 rounded-full bg-[#FF3E9A] border border-white/40" />
          </div>
          <div className="p-4 flex flex-col gap-3.5">
            {hasPosted ? (
              <>
                {/* Payout rate bar */}
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-mono-bold text-[10px] uppercase tracking-widest text-[#111]/60">Payout rate</span>
                    <span className="font-mono-bold text-[13px] text-[#111]">
                      {isPromiseKeeper ? '100%' : allPostedStats.some(b => b.winnersApproved > 0n)
                        ? `${Math.round(allPostedStats.filter(b => b.winnersApproved > 0n).length / allPostedStats.length * 100)}%` : '0%'}
                    </span>
                  </div>
                  <div className="h-3 rounded-full bg-[#FFFDF0] overflow-hidden border-[2px] border-[#111]">
                    <div
                      className="h-full bg-[#FF3E9A] transition-all duration-500"
                      style={{ width: isPromiseKeeper ? '100%' : `${Math.round(allPostedStats.filter(b => b.winnersApproved > 0n).length / Math.max(allPostedStats.length, 1) * 100)}%` }}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2.5 pt-1">
                  <div className="border-[2px] border-[#111] rounded-xl p-2.5 bg-[#FFFDF0] shadow-hard-xs flex flex-col gap-0.5 items-center text-center">
                    <span className="font-heading text-[22px] sm:text-[24px] font-black text-[#111] tabular-nums leading-none">{totalPosted?.length ?? 0}</span>
                    <span className="font-mono-bold text-[9px] uppercase tracking-widest text-[#111]/60">Created</span>
                  </div>
                  <div className="border-[2px] border-[#111] rounded-xl p-2.5 bg-[#FF3E9A]/15 shadow-hard-xs flex flex-col gap-0.5 items-center text-center">
                    <span className="font-heading text-[22px] sm:text-[24px] font-black text-[#FF3E9A] tabular-nums leading-none">
                      {allPostedStats.reduce((s, b) => s + Number(b.winnersApproved), 0)}
                    </span>
                    <span className="font-mono-bold text-[9px] uppercase tracking-widest text-[#111]/60">Paid out</span>
                  </div>
                  <div className="border-[2px] border-[#111] rounded-xl p-2.5 bg-[#7FF3F0]/25 shadow-hard-xs flex flex-col gap-0.5 items-center text-center">
                    <span className="font-heading text-[22px] sm:text-[24px] font-black text-[#111] tabular-nums leading-none">${formatUsdc(escrowTotal)}</span>
                    <span className="font-mono-bold text-[9px] uppercase tracking-widest text-[#111]/60">In escrow</span>
                  </div>
                </div>
                {isPromiseKeeper && (
                  <div className="flex items-center gap-2 bg-[#C6F23A]/35 border-[2px] border-[#111] rounded-xl px-3 py-2 shadow-hard-xs">
                    <CheckCircleIcon size={14} className="text-[#111] shrink-0" />
                    <span className="font-mono-bold text-[10px] text-[#111]">Promise Keeper — 100% payout rate</span>
                  </div>
                )}
              </>
            ) : (
              <div className="flex flex-col items-center justify-center py-6 gap-2 text-center">
                <FolderIcon size={28} className="text-[#111]/30" />
                <span className="font-mono-bold text-[11px] uppercase tracking-wider text-[#111]/45">No bounties created yet</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Wallet window (own profile only) ───────────────────────────────── */}
      {isOwn && (
        <WindowCard title="WALLET.EXE" titleBarColor="#C6F23A" bodyClassName="flex flex-col gap-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div className="dark-grid-surface bg-[#111] border-[2.5px] border-[#111] rounded-xl p-4 flex items-center gap-3.5 text-white shadow-hard-sm">
              <div className="w-11 h-11 rounded-xl bg-[#FFE600] border-[2px] border-[#111] flex items-center justify-center shrink-0">
                <CoinIcon size={26} />
              </div>
              <div className="flex flex-col">
                <p className="font-mono-bold text-[10px] uppercase tracking-widest text-white/60">Available Balance</p>
                <p className="font-heading text-[26px] font-extrabold tabular-nums text-[#FFE600] leading-none">
                  {formatUsdc(balance)} <span className="text-[14px] text-white/80">USDC</span>
                </p>
              </div>
            </div>

            <div className="bg-white border-[2.5px] border-[#111] rounded-xl p-4 flex items-center justify-between gap-3 shadow-hard-sm">
              {hasPosted ? (
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#7FF3F0] border-[2px] border-[#111] flex items-center justify-center shrink-0">
                    <LockIcon size={20} />
                  </div>
                  <div>
                    <p className="font-mono-bold text-[10px] uppercase tracking-widest text-[#111]/55">Locked in Escrow</p>
                    <p className="font-heading text-[22px] font-extrabold tabular-nums text-[#111] leading-none">{formatUsdc(escrowTotal)} <span className="text-[12px]">USDC</span></p>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col">
                  <span className="font-mono-bold text-[10px] uppercase tracking-widest text-[#111]/55">Quick Transfer</span>
                  <span className="font-mono-ui text-[11px] text-[#111]/70">Deposit or withdraw USDC on Arc</span>
                </div>
              )}
              <div className="flex gap-2 ml-auto shrink-0">
                <button onClick={() => setShowReceive(true)} className="font-mono-bold text-[11px] uppercase tracking-widest bg-[#7FF3F0] hover:bg-[#FFE600] border-[2.5px] border-[#111] rounded-full px-3.5 py-2 shadow-hard-xs btn-press cursor-pointer transition-colors">Receive</button>
                <button onClick={() => setShowSend(true)} className="font-mono-bold text-[11px] uppercase tracking-widest bg-[#FFE600] hover:bg-[#111] hover:text-[#FFE600] border-[2.5px] border-[#111] rounded-full px-3.5 py-2 shadow-hard-xs btn-press cursor-pointer transition-colors">Send →</button>
              </div>
            </div>
          </div>
          {hasPosted && (balance + escrowTotal) > 0n && (
            <div className="flex flex-col gap-1.5 bg-white border-[2px] border-[#111] rounded-xl p-3 shadow-hard-xs">
              <div className="flex items-center justify-between font-mono-bold text-[10px] uppercase tracking-widest text-[#111]/70">
                <span>Active Escrow Allocation</span>
                <span>{formatUsdc(escrowTotal)} / {formatUsdc(balance + escrowTotal)} USDC</span>
              </div>
              <div className="h-3 rounded-full border-[2px] border-[#111] bg-[#FFFDF0] overflow-hidden">
                <div
                  className="h-full bg-[#FF3E9A]"
                  style={{ width: `${Math.min(100, Number((escrowTotal * 100n) / (balance + escrowTotal)))}%` }}
                />
              </div>
            </div>
          )}
          <p className="font-mono-ui text-[10px] uppercase tracking-widest text-[#111]/50">Your connected wallet is your Want.fun wallet. Keys never leave your wallet app.</p>
        </WindowCard>
      )}

      {/* ── Pending claims ────────────────────────────────────────────────── */}
      {hasPendingClaims && submittedList.length > 0 && (
        <PendingClaimsWindow bountyIds={[...submittedList]} profileAddr={address} />
      )}

      {/* ── Tabs ──────────────────────────────────────────────────────────── */}
      <div>
        <div className="flex gap-0 border-[3px] border-[#111] rounded-t-xl overflow-hidden w-fit shadow-hard-sm">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className="px-4 py-2.5 font-mono-bold text-[10px] sm:text-[11px] uppercase tracking-widest text-[#111] border-r-[3px] border-[#111] last:border-r-0 transition-colors cursor-pointer"
              style={{
                backgroundColor: tab === t.id ? t.color : '#FFFDF0',
                color: tab === t.id && t.id === 'posted' ? '#FFFFFF' : '#111111',
              }}
            >{t.label}</button>
          ))}
        </div>
        <div className="border-[3px] border-t-0 border-[#111] rounded-b-xl rounded-tr-xl p-4 sm:p-5 bg-[#FFFDF0] shadow-hard">
          {tab === 'participating' && (
            <BountyList
              ids={participatingIds as bigint[]}
              profileAddr={address}
              onSelect={onSelectBounty}
              emptyMsg="No active submissions yet."
              tabMode="participating"
              onBrowseWall={onBrowseWall}
              onCreateBounty={onCreateBounty}
            />
          )}
          {tab === 'past' && (
            <BountyList
              ids={pastIds as bigint[]}
              profileAddr={address}
              onSelect={onSelectBounty}
              emptyMsg="No past bounties yet."
              tabMode="past"
              onBrowseWall={onBrowseWall}
              onCreateBounty={onCreateBounty}
            />
          )}
          {tab === 'posted' && (
            <BountyList
              ids={postedList as bigint[]}
              profileAddr={address}
              onSelect={onSelectBounty}
              emptyMsg="No bounties created yet."
              tabMode="posted"
              onBrowseWall={onBrowseWall}
              onCreateBounty={onCreateBounty}
            />
          )}
        </div>
      </div>

      {showSend && <SendModal balance={balance} onClose={handleSendClose} />}
      {showReceive && <ReceiveModal address={address} onClose={() => setShowReceive(false)} />}
    </div>
  )
}

// ─── Bounty list ──────────────────────────────────────────────────────────────
function BountyList({ ids, profileAddr, onSelect, emptyMsg, tabMode, onBrowseWall, onCreateBounty }: {
  ids: bigint[]
  profileAddr: `0x${string}`
  onSelect: (id: bigint) => void
  emptyMsg: string
  tabMode: 'participating' | 'past' | 'posted'
  onBrowseWall?: () => void
  onCreateBounty?: () => void
}) {
  if (ids.length === 0) {
    if (tabMode === 'participating') {
      return (
        <div className="checkerboard rounded-xl p-6 border-[2.5px] border-[#111] flex flex-col items-center justify-center text-center">
          <div className="bg-white border-[2.5px] border-[#111] rounded-2xl p-5 shadow-hard-sm flex flex-col items-center gap-2.5 max-w-sm">
            <span className="font-mono-bold text-[12px] uppercase tracking-wider text-[#111] bg-[#FFE600] border-[2px] border-[#111] px-3 py-1 rounded-full shadow-hard-xs">
              No active submissions yet
            </span>
            <p className="font-mono-ui text-[11px] text-[#111]/75">
              Hunt open bounties on the wall, submit proof of work, and earn USDC directly to your wallet.
            </p>
            {onBrowseWall && (
              <button
                onClick={onBrowseWall}
                className="font-mono-bold text-[11px] uppercase tracking-widest bg-[#111] text-[#FFE600] hover:bg-[#FFE600] hover:text-[#111] border-[2px] border-[#111] px-4 py-2 rounded-full shadow-hard-xs transition-colors btn-press cursor-pointer mt-1"
              >
                Browse Open Bounties →
              </button>
            )}
          </div>
        </div>
      )
    }

    if (tabMode === 'posted') {
      return (
        <div className="checkerboard rounded-xl p-6 border-[2.5px] border-[#111] flex flex-col items-center justify-center text-center">
          <div className="bg-white border-[2.5px] border-[#111] rounded-2xl p-5 shadow-hard-sm flex flex-col items-center gap-2.5 max-w-sm">
            <span className="font-mono-bold text-[12px] uppercase tracking-wider text-white bg-[#FF3E9A] border-[2px] border-[#111] px-3 py-1 rounded-full shadow-hard-xs">
              No bounties created yet
            </span>
            <p className="font-mono-ui text-[11px] text-[#111]/75">
              Put your tasks onchain with automated USDC escrow and let the world build for you.
            </p>
            {onCreateBounty && (
              <button
                onClick={onCreateBounty}
                className="font-mono-bold text-[11px] uppercase tracking-widest bg-[#FFE600] text-[#111] hover:bg-[#111] hover:text-[#FFE600] border-[2px] border-[#111] px-4 py-2 rounded-full shadow-hard-xs transition-colors btn-press cursor-pointer mt-1"
              >
                Post a Bounty →
              </button>
            )}
          </div>
        </div>
      )
    }

    return (
      <div className="checkerboard rounded-xl p-6 border-[2.5px] border-[#111] flex flex-col items-center justify-center text-center">
        <div className="bg-white border-[2.5px] border-[#111] rounded-2xl px-5 py-4 shadow-hard-sm">
          <span className="font-mono-bold text-[12px] uppercase tracking-widest text-[#111]">
            {emptyMsg}
          </span>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      {ids.map(id => (
        <BountyRow key={id.toString()} bountyId={id} profileAddr={profileAddr} onSelect={onSelect} tabMode={tabMode} />
      ))}
    </div>
  )
}

// ─── Pending claims window ────────────────────────────────────────────────────
function PendingClaimsWindow({ bountyIds, profileAddr }: { bountyIds: bigint[]; profileAddr: `0x${string}` }) {
  return (
    <WindowCard title="PENDING_CLAIMS.EXE" titleBarColor="#FFE600" bodyClassName="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <p className="font-mono-bold text-[11px] uppercase tracking-widest text-[#111]">You have unclaimed rewards</p>
          <p className="font-mono-ui text-[10px] text-[#111]/60">Claim each approved submission to transfer USDC directly to your wallet.</p>
        </div>
      </div>
      {bountyIds.map(id => (
        <PendingClaimRow key={id.toString()} bountyId={id} profileAddr={profileAddr} />
      ))}
    </WindowCard>
  )
}

function PendingClaimRow({ bountyId, profileAddr }: { bountyId: bigint; profileAddr: `0x${string}` }) {
  const { chainId } = useAccount()
  const { switchChain } = useSwitchChain()
  const isWrongChain = chainId !== CHAIN_ID

  const { data: myStatusRaw } = useReadContract({
    address: CONTRACT_ADDRESS, abi: BOUNTY_BOARD_ABI, functionName: 'getMyStatus',
    args: [bountyId, profileAddr], chainId: CHAIN_ID,
  }) as { data: number | undefined }

  const { data: bounty } = useReadContract({
    address: CONTRACT_ADDRESS, abi: BOUNTY_BOARD_ABI, functionName: 'getBounty',
    args: [bountyId], chainId: CHAIN_ID,
  }) as { data: { title: `0x${string}`; rewardPerWinner: bigint } | undefined }

  const { writeContract: claim, data: claimHash, isPending: claiming, error: claimErr, isSuccess: claimSuccess } = useWriteContract()
  const { isLoading: claimConfirming, isSuccess: claimConfirmed } = useWaitForTransactionReceipt({ hash: claimHash })

  if (myStatusRaw !== MY_STATUS_WINNER_PENDING || !bounty) return null

  return (
    <div className="border-[2px] border-[#111] rounded-lg p-3 bg-[#FFE600]/20 flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <span className="font-mono-bold text-[12px] text-[#111]">{decodeBytes(bounty.title) || `Bounty #${bountyId}`}</span>
        <span className="font-heading text-[16px] font-extrabold text-[#111]">{formatUsdc(bounty.rewardPerWinner)} USDC</span>
      </div>
      {!claimConfirmed && (
        <button
          onClick={() => { if (isWrongChain) { switchChain({ chainId: CHAIN_ID }); return }; claim({ address: CONTRACT_ADDRESS, abi: BOUNTY_BOARD_ABI, functionName: 'claim', args: [bountyId], chainId: CHAIN_ID }) }}
          disabled={claiming || claimConfirming}
          className="font-mono-bold text-[12px] uppercase tracking-widest bg-[#FFE600] border-[3px] border-[#111] rounded-full px-4 py-2.5 shadow-hard-sm btn-press disabled:opacity-40 w-full cursor-pointer"
        >
          {isWrongChain ? 'Switch chain' : claiming ? 'Confirm...' : claimConfirming ? 'Confirming...' : `Claim ${formatUsdc(bounty.rewardPerWinner)} USDC →`}
        </button>
      )}
      <TxStatus hash={claimHash} isPending={claiming} isConfirming={claimConfirming} isSuccess={claimSuccess} isError={!!claimErr} error={claimErr ? parseOnchainError(claimErr) : undefined} successMessage="Claimed!" />
    </div>
  )
}
