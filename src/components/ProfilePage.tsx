import React, { useState, useCallback, useEffect, useMemo } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import {
  useAccount,
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
  useSwitchChain,
} from 'wagmi'
import { formatUnits, isAddress, parseUnits } from 'viem'
import { toast } from 'sonner'
import {
  ArrowLeft,
  ArrowDownLeft,
  ArrowUpRight,
  Award,
  Check,
  ChevronRight,
  Clock,
  Copy,
  ExternalLink,
  Folder,
  Inbox,
  Lock,
  Pencil,
  Plus,
  Share2,
  ShieldCheck,
  Sparkles,
  Trophy,
  Wallet,
  X,
  Zap,
} from 'lucide-react'
import { BOUNTY_BOARD_ABI } from '../bounty-abi'
import {
  USDC_ADDRESS,
  USDC_DECIMALS,
  CONTRACT_ADDRESS,
  CHAIN_ID,
  CHAIN_NAME,
  getTxUrl,
  getAddressUrl,
} from '../bounty-config'
import {
  formatUsdc,
  formatAddress,
  parseOnchainError,
  decodeBytes,
  bountyStatus,
  timeLeft,
  type BountyStatusType,
} from '../lib/utils'
import {
  fetchProfile,
  saveProfile,
  fetchWalletSubmissions,
  type OffchainProfile,
} from '../lib/submissions-api'
import { PixelAvatar, AVATAR_VARIANT_COUNT } from './PixelAvatar'
import { QRCode } from './QRCode'
import { SkeletonBountyRow } from './Skeleton'
import { TxStatus } from './TxStatus'
import { CoinIcon, XIcon, GithubIcon, GlobeIcon } from './Icons'

// ─── MyStatus enum (mirrors Solidity) ────────────────────────────────────────
const MY_STATUS_NONE = 0
const MY_STATUS_SUBMITTED = 1
const MY_STATUS_WINNER_PENDING = 2
const MY_STATUS_WINNER_PAID = 3
const MY_STATUS_NOT_SELECTED = 4

const MY_STATUS_STYLES: Record<number, { label: string; className: string }> = {
  [MY_STATUS_NONE]: { label: '', className: '' },
  [MY_STATUS_SUBMITTED]: {
    label: 'Submitted',
    className: 'bg-sky-50 text-sky-800 border-sky-200/80',
  },
  [MY_STATUS_WINNER_PENDING]: {
    label: 'Winner · Claim',
    className: 'bg-amber-50 text-amber-900 border-amber-300',
  },
  [MY_STATUS_WINNER_PAID]: {
    label: 'Paid',
    className: 'bg-emerald-50 text-emerald-800 border-emerald-200/90',
  },
  [MY_STATUS_NOT_SELECTED]: {
    label: 'Not selected',
    className: 'bg-[#111]/[0.04] text-[#111]/60 border-[#111]/10',
  },
}

const BOUNTY_STATUS_PILLS: Record<BountyStatusType, { label: string; dot: string; pill: string }> = {
  OPEN: {
    label: 'Open',
    dot: 'bg-emerald-500',
    pill: 'bg-emerald-50/90 text-emerald-800 border-emerald-200/80',
  },
  FULL: {
    label: 'Filled',
    dot: 'bg-rose-500',
    pill: 'bg-rose-50/90 text-rose-800 border-rose-200/80',
  },
  EXPIRED: {
    label: 'Ended',
    dot: 'bg-[#111]/40',
    pill: 'bg-[#111]/[0.04] text-[#111]/65 border-[#111]/10',
  },
  CANCELLED: {
    label: 'Cancelled',
    dot: 'bg-amber-500',
    pill: 'bg-amber-50/90 text-amber-800 border-amber-200/80',
  },
}

// Minimal ERC-20 ABI for balance + transfer
const ERC20_ABI = [
  {
    type: 'function',
    name: 'balanceOf',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'transfer',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ type: 'bool' }],
    stateMutability: 'nonpayable',
  },
] as const

const PAGE_STEP = 10

interface ProfilePageProps {
  address: `0x${string}`
  onBack: () => void
  onSelectBounty: (id: bigint) => void
  onCreateBounty?: () => void
  onBrowseWall?: () => void
}

type ProfileTab = 'participating' | 'past' | 'posted'

interface OnchainBountyRecord {
  title: `0x${string}`
  rewardPerWinner: bigint
  deadline: bigint
  winnersApproved: bigint
  maxWinners: bigint
  cancelled: boolean
  escrowRemaining: bigint
  reclaimedUnused: boolean
}

interface BountyStatInfo {
  rewardPerWinner: bigint
  escrowRemaining: bigint
  winnersApproved: bigint
  maxWinners: bigint
  cancelled: boolean
}

interface SubmittedMetaInfo {
  isOpen: boolean
}

// Module-level timestamp helper avoids impure Date.now() calls during render
const _nowSec = (): number => Math.floor(Date.now() / 1000)

function formatJoinedDate(epochSec?: number): string {
  if (!epochSec) return ''
  const d = new Date(epochSec * 1000)
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

// ─── Minimal Dialog Shell ─────────────────────────────────────────────────────
function DialogShell({
  title,
  subtitle,
  onClose,
  children,
  maxWidth = 'max-w-md',
}: {
  title: string
  subtitle?: string
  onClose: () => void
  children: React.ReactNode
  maxWidth?: string
}) {
  const prefersReduced = useReducedMotion()

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose])

  return (
    <motion.div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: prefersReduced ? 0.01 : 0.16 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#111]/45 backdrop-blur-[4px]"
      onClick={onClose}
    >
      <motion.div
        initial={prefersReduced ? { opacity: 0 } : { opacity: 0, scale: 0.97, y: 8 }}
        animate={prefersReduced ? { opacity: 1 } : { opacity: 1, scale: 1, y: 0 }}
        exit={prefersReduced ? { opacity: 0 } : { opacity: 0, scale: 0.98, y: 6 }}
        transition={{ duration: prefersReduced ? 0.01 : 0.2, ease: [0.16, 1, 0.3, 1] }}
        onClick={e => e.stopPropagation()}
        className={`w-full ${maxWidth} bg-white rounded-2xl border border-[#111]/12 shadow-[0_24px_64px_-16px_rgba(17,17,17,0.28)] overflow-hidden`}
      >
        <div className="px-6 py-4 border-b border-[#111]/10 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h2 className="font-heading text-[17px] font-bold text-[#111] tracking-tight leading-tight">
              {title}
            </h2>
            {subtitle && (
              <p className="text-[12px] text-[#111]/55 mt-0.5 truncate">{subtitle}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="w-8 h-8 rounded-lg border border-[#111]/10 text-[#111]/60 hover:text-[#111] hover:bg-[#111]/[0.05] flex items-center justify-center transition-colors cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="px-6 py-5 max-h-[80dvh] overflow-y-auto">{children}</div>
      </motion.div>
    </motion.div>
  )
}

// ─── Hidden onchain readers ───────────────────────────────────────────────────
function BountyStatsReader({
  bountyId,
  onValue,
}: {
  bountyId: bigint
  onValue: (id: string, info: BountyStatInfo) => void
}) {
  const { data: bounty } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: BOUNTY_BOARD_ABI,
    functionName: 'getBounty',
    args: [bountyId],
    chainId: CHAIN_ID,
  }) as { data: OnchainBountyRecord | undefined }

  useEffect(() => {
    if (!bounty) return
    onValue(bountyId.toString(), {
      rewardPerWinner: bounty.rewardPerWinner,
      escrowRemaining: bounty.escrowRemaining,
      winnersApproved: bounty.winnersApproved,
      maxWinners: bounty.maxWinners,
      cancelled: bounty.cancelled,
    })
  }, [bounty, bountyId, onValue])

  return null
}

function SubmittedMetaReader({
  bountyId,
  onValue,
}: {
  bountyId: bigint
  onValue: (id: string, info: SubmittedMetaInfo) => void
}) {
  const { data: bounty } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: BOUNTY_BOARD_ABI,
    functionName: 'getBounty',
    args: [bountyId],
    chainId: CHAIN_ID,
  }) as { data: OnchainBountyRecord | undefined }

  useEffect(() => {
    if (!bounty) return
    const isOpen =
      !bounty.cancelled &&
      Number(bounty.deadline) > _nowSec() &&
      Number(bounty.winnersApproved) < Number(bounty.maxWinners)
    onValue(bountyId.toString(), { isOpen })
  }, [bounty, bountyId, onValue])

  return null
}

// ─── Edit Profile Modal ───────────────────────────────────────────────────────
function EditProfileModal({
  address,
  profile,
  onClose,
  onSaved,
}: {
  address: `0x${string}`
  profile: OffchainProfile
  onClose: () => void
  onSaved: (next: OffchainProfile) => void
}) {
  const [bioDraft, setBioDraft] = useState(profile.bio || '')
  const [avatarDraft, setAvatarDraft] = useState(profile.avatar_variant || 0)
  const [twitterDraft, setTwitterDraft] = useState(profile.twitter || '')
  const [githubDraft, setGithubDraft] = useState(profile.github || '')
  const [websiteDraft, setWebsiteDraft] = useState(profile.website || '')
  const [saving, setSaving] = useState(false)
  const [saveErr, setSaveErr] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setSaveErr('')
    const result = await saveProfile(address, {
      bio: bioDraft,
      avatarVariant: avatarDraft,
      twitter: twitterDraft,
      github: githubDraft,
      website: websiteDraft,
    })
    setSaving(false)
    if (result.ok) {
      onSaved({
        ...profile,
        bio: bioDraft.trim(),
        avatar_variant: avatarDraft,
        twitter: twitterDraft.trim(),
        github: githubDraft.trim(),
        website: websiteDraft.trim(),
      })
      toast.success('Profile updated')
      onClose()
    } else {
      setSaveErr(result.error ?? 'Could not save your profile. Please try again.')
    }
  }

  return (
    <DialogShell
      title="Edit Profile"
      subtitle={`Customize your public Want.fun identity (${formatAddress(address)})`}
      onClose={onClose}
      maxWidth="max-w-lg"
    >
      <form
        onSubmit={e => {
          void handleSubmit(e)
        }}
        className="flex flex-col gap-5"
      >
        {/* Avatar live preview + selector */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3.5 p-3 rounded-xl bg-[#FAF9F2] border border-[#111]/10">
            <div className="rounded-xl overflow-hidden border border-[#111]/12 shrink-0 bg-[#FFFDF0]">
              <PixelAvatar address={address} size={52} variant={avatarDraft} />
            </div>
            <div className="min-w-0">
              <p className="text-[13px] font-semibold text-[#111]">Geometric Identity</p>
              <p className="text-[12px] text-[#111]/55">
                Deterministic pixel mark derived from your wallet address.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-6 gap-2" role="radiogroup" aria-label="Avatar style">
            {Array.from({ length: AVATAR_VARIANT_COUNT }, (_, v) => {
              const active = v === avatarDraft
              return (
                <button
                  key={v}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  aria-label={`Avatar style ${v + 1}`}
                  onClick={() => setAvatarDraft(v)}
                  className={`rounded-xl overflow-hidden border p-1 bg-[#FFFDF0] flex items-center justify-center transition-all cursor-pointer ${
                    active
                      ? 'border-[#111] ring-2 ring-[#111] ring-offset-1'
                      : 'border-[#111]/12 hover:border-[#111]/40 opacity-80 hover:opacity-100'
                  }`}
                >
                  <PixelAvatar address={address} size={36} variant={v} />
                </button>
              )
            })}
          </div>
        </div>

        {/* Bio */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <label htmlFor="profile-bio-input" className="text-[12px] font-semibold text-[#111]">
              Bio
            </label>
            <span className="font-mono-ui text-[11px] text-[#111]/45 tabular-nums">
              {bioDraft.length}/160
            </span>
          </div>
          <textarea
            id="profile-bio-input"
            value={bioDraft}
            onChange={e => setBioDraft(e.target.value.slice(0, 160))}
            rows={3}
            maxLength={160}
            placeholder="Full-stack engineer & security researcher building onchain."
            className="w-full rounded-xl border border-[#111]/15 bg-[#FAF9F2]/60 px-3.5 py-2.5 text-[13px] text-[#111] placeholder:text-[#111]/35 resize-none focus:bg-white focus:border-[#111] focus:outline-none focus:ring-2 focus:ring-[#111]/10 transition-colors"
          />
        </div>

        {/* Social Links */}
        <div className="flex flex-col gap-2.5">
          <span className="text-[12px] font-semibold text-[#111]">Social Links</span>

          <div className="relative flex items-center">
            <span className="absolute left-3 text-[#111]/55 pointer-events-none">
              <XIcon size={13} />
            </span>
            <input
              type="text"
              aria-label="X (Twitter) handle"
              value={twitterDraft}
              onChange={e => setTwitterDraft(e.target.value)}
              placeholder="X handle (e.g. satoshi)"
              className="w-full rounded-xl border border-[#111]/15 bg-[#FAF9F2]/60 pl-9 pr-3.5 py-2.5 text-[13px] text-[#111] placeholder:text-[#111]/35 focus:bg-white focus:border-[#111] focus:outline-none focus:ring-2 focus:ring-[#111]/10 transition-colors"
            />
          </div>

          <div className="relative flex items-center">
            <span className="absolute left-3 text-[#111]/55 pointer-events-none">
              <GithubIcon size={14} />
            </span>
            <input
              type="text"
              aria-label="GitHub username"
              value={githubDraft}
              onChange={e => setGithubDraft(e.target.value)}
              placeholder="GitHub username"
              className="w-full rounded-xl border border-[#111]/15 bg-[#FAF9F2]/60 pl-9 pr-3.5 py-2.5 text-[13px] text-[#111] placeholder:text-[#111]/35 focus:bg-white focus:border-[#111] focus:outline-none focus:ring-2 focus:ring-[#111]/10 transition-colors"
            />
          </div>

          <div className="relative flex items-center">
            <span className="absolute left-3 text-[#111]/55 pointer-events-none">
              <GlobeIcon size={14} />
            </span>
            <input
              type="text"
              aria-label="Website URL"
              value={websiteDraft}
              onChange={e => setWebsiteDraft(e.target.value)}
              placeholder="Website (https://example.com)"
              className="w-full rounded-xl border border-[#111]/15 bg-[#FAF9F2]/60 pl-9 pr-3.5 py-2.5 text-[13px] text-[#111] placeholder:text-[#111]/35 focus:bg-white focus:border-[#111] focus:outline-none focus:ring-2 focus:ring-[#111]/10 transition-colors"
            />
          </div>
        </div>

        {saveErr && (
          <p
            role="alert"
            className="text-[12px] font-medium text-rose-700 bg-rose-50 border border-rose-200 rounded-xl px-3.5 py-2.5"
          >
            {saveErr}
          </p>
        )}

        <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-[#111]/10">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 rounded-xl text-[13px] font-medium text-[#111]/70 hover:text-[#111] hover:bg-[#111]/[0.05] transition-colors cursor-pointer disabled:opacity-40"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="px-5 py-2 rounded-xl text-[13px] font-semibold bg-[#111] text-[#FFFDF0] hover:bg-[#222] transition-colors cursor-pointer disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </form>
    </DialogShell>
  )
}

// ─── Send USDC Modal ──────────────────────────────────────────────────────────
function SendModal({ balance, onClose }: { balance: bigint; onClose: () => void }) {
  const { chainId } = useAccount()
  const { switchChain } = useSwitchChain()
  const isWrongChain = chainId !== CHAIN_ID
  const [to, setTo] = useState('')
  const [amount, setAmount] = useState('')
  const [step, setStep] = useState<'form' | 'confirm'>('form')
  const [toErr, setToErr] = useState('')
  const [amountErr, setAmountErr] = useState('')

  const { writeContract, data: txHash, isPending, error: txErr, isSuccess } = useWriteContract()
  const { isLoading: confirming, isSuccess: confirmed } = useWaitForTransactionReceipt({ hash: txHash })

  function validate(): boolean {
    let ok = true
    if (!isAddress(to) || to === '0x0000000000000000000000000000000000000000') {
      setToErr('Enter a valid 0x recipient address')
      ok = false
    } else {
      setToErr('')
    }
    let parsed: bigint
    try {
      parsed = parseUnits(amount || '0', USDC_DECIMALS)
    } catch {
      parsed = -1n
    }
    if (parsed <= 0n) {
      setAmountErr('Amount must be greater than 0')
      ok = false
    } else if (parsed > balance) {
      setAmountErr('Exceeds available USDC balance')
      ok = false
    } else {
      setAmountErr('')
    }
    return ok
  }

  function handleReview(e: React.FormEvent) {
    e.preventDefault()
    if (validate()) setStep('confirm')
  }

  function handleMax() {
    if (balance <= 0n) return
    setAmount(formatUnits(balance, USDC_DECIMALS))
    setAmountErr('')
  }

  function handleSend() {
    if (isWrongChain) {
      switchChain({ chainId: CHAIN_ID })
      return
    }
    const parsed = parseUnits(amount, USDC_DECIMALS)
    writeContract({
      address: USDC_ADDRESS,
      abi: ERC20_ABI,
      functionName: 'transfer',
      args: [to as `0x${string}`, parsed],
      chainId: CHAIN_ID,
    })
  }

  return (
    <DialogShell
      title="Send USDC"
      subtitle={`Transfer USDC on ${CHAIN_NAME}`}
      onClose={onClose}
    >
      {confirmed ? (
        <div className="flex flex-col items-center text-center gap-4 py-3">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center">
            <Check className="w-6 h-6" />
          </div>
          <div>
            <p className="font-heading text-[20px] font-bold text-[#111]">Transfer Sent</p>
            <p className="text-[13px] text-[#111]/60 mt-1">
              {amount} USDC transferred to {formatAddress(to)}
            </p>
          </div>
          {txHash && (
            <a
              href={getTxUrl(txHash)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-[12px] font-medium text-[#111]/75 hover:text-[#111] underline underline-offset-4"
            >
              <span>View transaction on explorer</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}
          <button
            type="button"
            onClick={onClose}
            className="w-full mt-1 py-2.5 rounded-xl text-[13px] font-semibold bg-[#111] text-[#FFFDF0] hover:bg-[#222] transition-colors cursor-pointer"
          >
            Done
          </button>
        </div>
      ) : step === 'confirm' ? (
        <div className="flex flex-col gap-4">
          <div className="rounded-xl border border-[#111]/12 bg-[#FAF9F2] p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[12px] text-[#111]/55">Amount</span>
              <span className="font-heading text-[18px] font-bold text-[#111] tabular-nums">
                {amount} USDC
              </span>
            </div>
            <div className="border-t border-[#111]/8 pt-3 flex flex-col gap-1">
              <span className="text-[12px] text-[#111]/55">Recipient</span>
              <span className="font-mono-ui text-[12px] text-[#111] break-all">{to}</span>
            </div>
            <div className="border-t border-[#111]/8 pt-3 flex items-center justify-between gap-2">
              <span className="text-[12px] text-[#111]/55">Network</span>
              <span className="text-[12px] font-medium text-[#111]">{CHAIN_NAME}</span>
            </div>
          </div>

          {txErr && (
            <p className="text-[12px] font-medium text-rose-700 bg-rose-50 border border-rose-200 rounded-xl px-3.5 py-2.5">
              {parseOnchainError(txErr)}
            </p>
          )}

          <TxStatus
            hash={txHash}
            isPending={isPending}
            isConfirming={confirming}
            isSuccess={isSuccess}
            isError={!!txErr}
            error={txErr ? parseOnchainError(txErr) : undefined}
            successMessage="Transfer sent!"
          />

          <div className="grid grid-cols-2 gap-2.5 pt-1">
            <button
              type="button"
              onClick={() => setStep('form')}
              disabled={isPending || confirming}
              className="py-2.5 rounded-xl text-[13px] font-medium border border-[#111]/15 bg-white text-[#111] hover:bg-[#111]/[0.04] transition-colors cursor-pointer disabled:opacity-40"
            >
              Back
            </button>
            <button
              type="button"
              onClick={handleSend}
              disabled={isPending || confirming}
              className="py-2.5 rounded-xl text-[13px] font-semibold bg-[#111] text-[#FFFDF0] hover:bg-[#222] transition-colors cursor-pointer disabled:opacity-40"
            >
              {isWrongChain
                ? 'Switch Network'
                : isPending
                  ? 'Confirm in Wallet…'
                  : confirming
                    ? 'Confirming…'
                    : 'Confirm Send'}
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleReview} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="send-recipient" className="text-[12px] font-semibold text-[#111]">
              Recipient Address
            </label>
            <input
              id="send-recipient"
              value={to}
              onChange={e => setTo(e.target.value)}
              placeholder="0x…"
              autoComplete="off"
              className="w-full rounded-xl border border-[#111]/15 bg-[#FAF9F2]/60 px-3.5 py-2.5 font-mono-ui text-[13px] text-[#111] placeholder:text-[#111]/35 focus:bg-white focus:border-[#111] focus:outline-none focus:ring-2 focus:ring-[#111]/10 transition-colors"
            />
            {toErr && <p className="text-[12px] text-rose-600">{toErr}</p>}
          </div>

          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label htmlFor="send-amount" className="text-[12px] font-semibold text-[#111]">
                Amount (USDC)
              </label>
              <span className="font-mono-ui text-[11px] text-[#111]/55 tabular-nums">
                Available: {formatUsdc(balance)} USDC
              </span>
            </div>
            <div className="relative flex items-center">
              <input
                id="send-amount"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                placeholder="0.00"
                type="number"
                min="0"
                step="0.01"
                className="w-full rounded-xl border border-[#111]/15 bg-[#FAF9F2]/60 pl-3.5 pr-16 py-2.5 text-[15px] font-semibold tabular-nums text-[#111] placeholder:text-[#111]/35 focus:bg-white focus:border-[#111] focus:outline-none focus:ring-2 focus:ring-[#111]/10 transition-colors"
              />
              <button
                type="button"
                onClick={handleMax}
                disabled={balance <= 0n}
                className="absolute right-2 px-2.5 py-1 rounded-lg text-[11px] font-mono-bold uppercase tracking-wider bg-[#111]/[0.06] hover:bg-[#111] hover:text-white text-[#111]/80 transition-colors cursor-pointer disabled:opacity-35"
              >
                Max
              </button>
            </div>
            {amountErr && <p className="text-[12px] text-rose-600">{amountErr}</p>}
          </div>

          <button
            type="submit"
            className="w-full mt-1 py-2.5 rounded-xl text-[13px] font-semibold bg-[#111] text-[#FFFDF0] hover:bg-[#222] transition-colors cursor-pointer"
          >
            Review Transfer
          </button>
        </form>
      )}
    </DialogShell>
  )
}

// ─── Receive USDC Modal ───────────────────────────────────────────────────────
function ReceiveModal({ address, onClose }: { address: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    const ok = await copyToClipboard(address)
    if (ok) {
      setCopied(true)
      toast.success('Wallet address copied')
      window.setTimeout(() => setCopied(false), 1800)
    }
  }

  return (
    <DialogShell
      title="Receive USDC"
      subtitle={`Deposit USDC on ${CHAIN_NAME}`}
      onClose={onClose}
      maxWidth="max-w-sm"
    >
      <div className="flex flex-col items-center gap-4">
        <div className="p-3.5 rounded-2xl border border-[#111]/12 bg-white shadow-sm">
          <QRCode value={address} size={176} />
        </div>

        <div className="w-full rounded-xl border border-[#111]/10 bg-[#FAF9F2] px-3.5 py-3 font-mono-ui text-[11.5px] text-[#111]/85 break-all text-center select-all">
          {address}
        </div>

        <button
          type="button"
          onClick={() => {
            void handleCopy()
          }}
          className="w-full py-2.5 rounded-xl text-[13px] font-semibold bg-[#111] text-[#FFFDF0] hover:bg-[#222] transition-colors inline-flex items-center justify-center gap-2 cursor-pointer"
        >
          {copied ? <Check className="w-4 h-4 text-[#C6F23A]" /> : <Copy className="w-4 h-4" />}
          <span>{copied ? 'Address Copied' : 'Copy Wallet Address'}</span>
        </button>

        <p className="text-[11px] font-mono-ui uppercase tracking-wider text-[#111]/45 text-center">
          Send USDC on {CHAIN_NAME} only
        </p>
      </div>
    </DialogShell>
  )
}

// ─── Pending Claims Banner ────────────────────────────────────────────────────
function PendingClaimsBanner({
  bountyIds,
  profileAddr,
  pendingTotal,
  onClaimed,
}: {
  bountyIds: bigint[]
  profileAddr: `0x${string}`
  pendingTotal: bigint
  onClaimed: () => void
}) {
  return (
    <section
      aria-label="Unclaimed rewards"
      className="rounded-2xl bg-[#111111] text-[#FFFDF0] border border-[#111] p-5 sm:p-6 shadow-[0_12px_32px_-12px_rgba(17,17,17,0.28)]"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-white/10">
        <div className="flex items-center gap-2.5">
          <span className="w-2.5 h-2.5 rounded-full bg-[#FFE600] shrink-0" aria-hidden="true" />
          <div>
            <h2 className="font-heading text-[15px] font-bold text-white tracking-tight">
              Unclaimed Rewards Ready
            </h2>
            <p className="text-[12px] text-white/60">
              Claim approved payouts directly to your wallet in USDC.
            </p>
          </div>
        </div>
        <span className="font-heading text-[18px] font-extrabold text-[#FFE600] tabular-nums self-start sm:self-center">
          +${formatUsdc(pendingTotal)} USDC
        </span>
      </div>

      <div className="flex flex-col gap-2.5 mt-4">
        {bountyIds.map(id => (
          <PendingClaimRow
            key={id.toString()}
            bountyId={id}
            profileAddr={profileAddr}
            onClaimed={onClaimed}
          />
        ))}
      </div>
    </section>
  )
}

function PendingClaimRow({
  bountyId,
  profileAddr,
  onClaimed,
}: {
  bountyId: bigint
  profileAddr: `0x${string}`
  onClaimed: () => void
}) {
  const { chainId } = useAccount()
  const { switchChain } = useSwitchChain()
  const isWrongChain = chainId !== CHAIN_ID

  const { data: myStatusRaw } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: BOUNTY_BOARD_ABI,
    functionName: 'getMyStatus',
    args: [bountyId, profileAddr],
    chainId: CHAIN_ID,
  }) as { data: number | undefined }

  const { data: bounty } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: BOUNTY_BOARD_ABI,
    functionName: 'getBounty',
    args: [bountyId],
    chainId: CHAIN_ID,
  }) as { data: { title: `0x${string}`; rewardPerWinner: bigint } | undefined }

  const {
    writeContract: claim,
    data: claimHash,
    isPending: claiming,
    error: claimErr,
    isSuccess: claimSuccess,
  } = useWriteContract()
  const { isLoading: claimConfirming, isSuccess: claimConfirmed } = useWaitForTransactionReceipt({
    hash: claimHash,
  })

  useEffect(() => {
    if (claimConfirmed) {
      toast.success('Reward claimed to your wallet')
      onClaimed()
    }
  }, [claimConfirmed, onClaimed])

  if (myStatusRaw !== MY_STATUS_WINNER_PENDING || !bounty) return null

  return (
    <div className="rounded-xl bg-white/[0.06] border border-white/10 p-3.5 flex flex-col gap-2.5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="min-w-0">
          <span className="font-mono-ui text-[10px] uppercase tracking-wider text-white/45">
            Bounty #{bountyId.toString().padStart(3, '0')}
          </span>
          <p className="text-[14px] font-semibold text-white truncate">
            {decodeBytes(bounty.title) || `Bounty #${bountyId.toString()}`}
          </p>
        </div>

        <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
          <span className="font-heading text-[16px] font-bold text-[#FFE600] tabular-nums">
            ${formatUsdc(bounty.rewardPerWinner)} USDC
          </span>
          {!claimConfirmed && (
            <button
              type="button"
              onClick={() => {
                if (isWrongChain) {
                  switchChain({ chainId: CHAIN_ID })
                  return
                }
                claim({
                  address: CONTRACT_ADDRESS,
                  abi: BOUNTY_BOARD_ABI,
                  functionName: 'claim',
                  args: [bountyId],
                  chainId: CHAIN_ID,
                })
              }}
              disabled={claiming || claimConfirming}
              className="px-4 py-2 rounded-xl text-[12px] font-semibold bg-[#FFE600] hover:bg-[#FFFDF0] text-[#111] transition-colors cursor-pointer disabled:opacity-40"
            >
              {isWrongChain
                ? 'Switch Network'
                : claiming
                  ? 'Confirm…'
                  : claimConfirming
                    ? 'Claiming…'
                    : 'Claim Now'}
            </button>
          )}
        </div>
      </div>

      {(claiming || claimConfirming || claimSuccess || !!claimErr) && (
        <TxStatus
          hash={claimHash}
          isPending={claiming}
          isConfirming={claimConfirming}
          isSuccess={claimSuccess}
          isError={!!claimErr}
          error={claimErr ? parseOnchainError(claimErr) : undefined}
          successMessage="Reward claimed!"
        />
      )}
    </div>
  )
}

// ─── Bounty Row (Minimal Editorial List Item) ─────────────────────────────────
function BountyListRow({
  bountyId,
  profileAddr,
  onSelect,
  tabMode,
  isOffchainSubmitted,
}: {
  bountyId: bigint
  profileAddr: `0x${string}`
  onSelect: (id: bigint) => void
  tabMode: ProfileTab
  isOffchainSubmitted: boolean
}) {
  const { data: bounty } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: BOUNTY_BOARD_ABI,
    functionName: 'getBounty',
    args: [bountyId],
    chainId: CHAIN_ID,
  }) as { data: OnchainBountyRecord | undefined }

  const { data: myStatusRaw } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: BOUNTY_BOARD_ABI,
    functionName: 'getMyStatus',
    args: [bountyId, profileAddr],
    chainId: CHAIN_ID,
  }) as { data: number | undefined }

  if (!bounty) return <SkeletonBountyRow />

  const titleStr = decodeBytes(bounty.title)
  const status = bountyStatus(bounty)
  const statusStyle = BOUNTY_STATUS_PILLS[status]

  const rawStatus = myStatusRaw ?? MY_STATUS_NONE
  const effectiveMyStatus =
    tabMode !== 'posted' && rawStatus === MY_STATUS_NONE && isOffchainSubmitted
      ? MY_STATUS_SUBMITTED
      : rawStatus
  const myStatusInfo = MY_STATUS_STYLES[effectiveMyStatus]

  return (
    <button
      type="button"
      onClick={() => onSelect(bountyId)}
      className="group w-full text-left px-5 sm:px-6 py-4 bg-white hover:bg-[#FAF9F2]/90 transition-colors flex items-center justify-between gap-4 cursor-pointer"
    >
      <div className="min-w-0 flex-1 flex flex-col gap-1.5">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-mono-ui text-[11px] text-[#111]/45 tabular-nums">
            #{bountyId.toString().padStart(3, '0')}
          </span>
          <span
            className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[11px] font-medium leading-none ${statusStyle.pill}`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${statusStyle.dot}`} aria-hidden="true" />
            {statusStyle.label}
          </span>
          {tabMode !== 'posted' && effectiveMyStatus !== MY_STATUS_NONE && myStatusInfo?.label && (
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded-full border text-[11px] font-medium leading-none ${myStatusInfo.className}`}
            >
              {myStatusInfo.label}
            </span>
          )}
        </div>

        <h3 className="font-heading text-[15px] font-bold text-[#111] group-hover:text-[#111] truncate leading-snug">
          {titleStr || '(Untitled Bounty)'}
        </h3>

        <div className="flex items-center gap-3 text-[12px] text-[#111]/55">
          <span className="inline-flex items-center gap-1 font-mono-ui text-[11px]">
            <Clock className="w-3 h-3 shrink-0" />
            <span>{timeLeft(bounty.deadline)}</span>
          </span>
          <span className="text-[#111]/20" aria-hidden="true">
            ·
          </span>
          <span className="font-mono-ui text-[11px] tabular-nums">
            {bounty.winnersApproved.toString()}/{bounty.maxWinners.toString()} winners
          </span>
        </div>
      </div>

      <div className="flex items-center gap-3 shrink-0">
        <div className="text-right">
          <p className="font-heading text-[15px] sm:text-[16px] font-extrabold text-[#111] tabular-nums leading-tight">
            ${formatUsdc(bounty.rewardPerWinner)}
          </p>
          <p className="font-mono-ui text-[10px] uppercase tracking-wider text-[#111]/45">USDC</p>
        </div>
        <ChevronRight className="w-4 h-4 text-[#111]/30 group-hover:text-[#111] group-hover:translate-x-0.5 transition-all" />
      </div>
    </button>
  )
}

// ─── Clean Empty State ────────────────────────────────────────────────────────
function ActivityEmptyState({
  tabMode,
  isOwn,
  onBrowseWall,
  onCreateBounty,
}: {
  tabMode: ProfileTab
  isOwn: boolean
  onBrowseWall?: () => void
  onCreateBounty?: () => void
}) {
  const copy =
    tabMode === 'participating'
      ? {
          icon: <Inbox className="w-5 h-5" />,
          title: 'No active submissions',
          desc: isOwn
            ? 'Explore open bounties on the wall, submit proof of work, and earn USDC directly to your wallet.'
            : 'This address has no open bounty submissions right now.',
          ctaLabel: onBrowseWall ? 'Browse Open Bounties' : null,
          onCta: onBrowseWall,
        }
      : tabMode === 'posted'
        ? {
            icon: <Folder className="w-5 h-5" />,
            title: 'No bounties created',
            desc: isOwn
              ? 'Fund a task with automated USDC escrow and review submissions from builders worldwide.'
              : 'This address has not posted any bounties yet.',
            ctaLabel: isOwn && onCreateBounty ? 'Post a Bounty' : null,
            onCta: onCreateBounty,
          }
        : {
            icon: <Clock className="w-5 h-5" />,
            title: 'No completed history yet',
            desc: 'Past submissions and finalized bounties will appear here once they conclude.',
            ctaLabel: null,
            onCta: undefined,
          }

  return (
    <div className="py-14 px-6 flex flex-col items-center text-center">
      <div className="w-11 h-11 rounded-2xl bg-[#FAF9F2] border border-[#111]/10 text-[#111]/45 flex items-center justify-center mb-3.5">
        {copy.icon}
      </div>
      <p className="font-heading text-[15px] font-bold text-[#111]">{copy.title}</p>
      <p className="text-[13px] text-[#111]/55 max-w-sm mt-1 leading-relaxed">{copy.desc}</p>
      {copy.ctaLabel && copy.onCta && (
        <button
          type="button"
          onClick={copy.onCta}
          className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-[13px] font-semibold bg-[#111] text-[#FFFDF0] hover:bg-[#222] transition-colors cursor-pointer"
        >
          <span>{copy.ctaLabel}</span>
          <ArrowUpRight className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  )
}

// ─── KPI Metric Card ──────────────────────────────────────────────────────────
function MetricCard({
  label,
  value,
  sub,
  progress,
  progressColor = '#111111',
  accentValue = false,
}: {
  label: string
  value: string
  sub: string
  progress?: number
  progressColor?: string
  accentValue?: boolean
}) {
  return (
    <div className="bg-white rounded-2xl border border-[#111]/12 p-4 sm:p-5 flex flex-col justify-between gap-3 shadow-[0_1px_2px_rgba(17,17,17,0.03)] hover:border-[#111]/25 transition-colors">
      <span className="font-mono-ui text-[10.5px] uppercase tracking-[0.11em] text-[#111]/50">
        {label}
      </span>
      <div className="flex flex-col gap-1">
        <span
          className={`font-heading text-[24px] sm:text-[26px] font-extrabold tracking-tight tabular-nums leading-none ${
            accentValue ? 'text-emerald-700' : 'text-[#111]'
          }`}
        >
          {value}
        </span>
        <span className="text-[12px] text-[#111]/55 truncate">{sub}</span>
      </div>
      {typeof progress === 'number' && (
        <div className="h-1.5 w-full rounded-full bg-[#111]/[0.07] overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${Math.max(0, Math.min(100, progress))}%`, backgroundColor: progressColor }}
          />
        </div>
      )}
    </div>
  )
}

// ─── Main ProfilePage Wrapper (resets cleanly on address navigation) ──────────
export function ProfilePage(props: ProfilePageProps) {
  return <ProfilePageContent key={props.address.toLowerCase()} {...props} />
}

function ProfilePageContent({
  address,
  onBack,
  onSelectBounty,
  onCreateBounty,
  onBrowseWall,
}: ProfilePageProps) {
  const prefersReduced = useReducedMotion()
  const { address: connectedAddr } = useAccount()
  const isOwn = connectedAddr?.toLowerCase() === address.toLowerCase()

  const [tab, setTab] = useState<ProfileTab>('participating')
  const [visibleCount, setVisibleCount] = useState(PAGE_STEP)
  const [showEdit, setShowEdit] = useState(false)
  const [showSend, setShowSend] = useState(false)
  const [showReceive, setShowReceive] = useState(false)
  const [copiedAddr, setCopiedAddr] = useState(false)
  const [copiedUrl, setCopiedUrl] = useState(false)

  // Off-chain profile
  const [profile, setProfile] = useState<OffchainProfile>({ bio: '', avatar_variant: 0 })
  const [profileLoaded, setProfileLoaded] = useState(false)

  useEffect(() => {
    let cancelled = false
    void fetchProfile(address).then(p => {
      if (!cancelled) {
        setProfile(p)
        setProfileLoaded(true)
      }
    })
    return () => {
      cancelled = true
    }
  }, [address])

  // Off-chain submitted bounty IDs
  const [offchainSubmittedIds, setOffchainSubmittedIds] = useState<bigint[]>([])
  useEffect(() => {
    let cancelled = false
    void fetchWalletSubmissions(address).then(ids => {
      if (!cancelled) setOffchainSubmittedIds(ids)
    })
    return () => {
      cancelled = true
    }
  }, [address])

  // On-chain earnings
  const { data: earningsRaw, refetch: refetchEarnings } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: BOUNTY_BOARD_ABI,
    functionName: 'getEarnings',
    args: [address],
    chainId: CHAIN_ID,
  }) as { data: [bigint, bigint, bigint] | undefined; refetch: () => void }
  const earned = earningsRaw?.[0] ?? 0n
  const pendingEarnings = earningsRaw?.[1] ?? 0n
  const wins = earningsRaw?.[2] ?? 0n

  // On-chain submitted & posted bounty lists (complete lists, newest first)
  const { data: onchainSubmittedRaw } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: BOUNTY_BOARD_ABI,
    functionName: 'getBountiesBySubmitter',
    args: [address],
    chainId: CHAIN_ID,
  }) as { data: readonly bigint[] | undefined }

  const { data: totalPostedRaw } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: BOUNTY_BOARD_ABI,
    functionName: 'getBountiesByPoster',
    args: [address],
    chainId: CHAIN_ID,
  }) as { data: readonly bigint[] | undefined }

  // Deduplicated submitted bounties (on-chain + off-chain, newest first)
  const offchainSet = useMemo(
    () => new Set(offchainSubmittedIds.map(id => id.toString())),
    [offchainSubmittedIds],
  )

  const allSubmittedIds = useMemo(() => {
    const map = new Map<string, bigint>()
    for (const id of onchainSubmittedRaw ?? []) map.set(id.toString(), id)
    for (const id of offchainSubmittedIds) map.set(id.toString(), id)
    return Array.from(map.values()).sort((a, b) => (a > b ? -1 : a < b ? 1 : 0))
  }, [onchainSubmittedRaw, offchainSubmittedIds])

  const allPostedIds = useMemo(
    () => [...(totalPostedRaw ?? [])].sort((a, b) => (a > b ? -1 : a < b ? 1 : 0)),
    [totalPostedRaw],
  )

  const hasPosted = allPostedIds.length > 0

  // Collect metadata across posted bounties
  const [bountyStats, setBountyStats] = useState<Record<string, BountyStatInfo>>({})
  const onBountyStat = useCallback((id: string, info: BountyStatInfo) => {
    setBountyStats(prev => {
      const existing = prev[id]
      if (
        existing &&
        existing.escrowRemaining === info.escrowRemaining &&
        existing.winnersApproved === info.winnersApproved &&
        existing.cancelled === info.cancelled
      ) {
        return prev
      }
      return { ...prev, [id]: info }
    })
  }, [])

  // Collect open/closed status across submitted bounties for accurate tab counts & empty states
  const [submittedMeta, setSubmittedMeta] = useState<Record<string, SubmittedMetaInfo>>({})
  const onSubmittedMeta = useCallback((id: string, info: SubmittedMetaInfo) => {
    setSubmittedMeta(prev => {
      const existing = prev[id]
      if (existing && existing.isOpen === info.isOpen) return prev
      return { ...prev, [id]: info }
    })
  }, [])

  const activeSubmittedIds = useMemo(
    () => allSubmittedIds.filter(id => submittedMeta[id.toString()]?.isOpen === true),
    [allSubmittedIds, submittedMeta],
  )

  const pastSubmittedIds = useMemo(
    () => allSubmittedIds.filter(id => submittedMeta[id.toString()]?.isOpen === false),
    [allSubmittedIds, submittedMeta],
  )

  const submittedMetaReady =
    allSubmittedIds.length === 0 || Object.keys(submittedMeta).length >= allSubmittedIds.length

  const escrowTotal = useMemo(
    () => Object.values(bountyStats).reduce((sum, v) => sum + v.escrowRemaining, 0n),
    [bountyStats],
  )

  const paidOutTotal = useMemo(
    () =>
      Object.values(bountyStats).reduce(
        (sum, v) => sum + v.winnersApproved * v.rewardPerWinner,
        0n,
      ),
    [bountyStats],
  )

  // Derived rates & milestones
  const totalSubmissionsCount = allSubmittedIds.length
  const winRatePct =
    totalSubmissionsCount > 0
      ? Math.min(100, Math.round(Number(wins * 100n) / totalSubmissionsCount))
      : null

  const allPostedStats = Object.values(bountyStats)
  const isFirstCatch = wins >= 1n
  const isHeavyHitter = earned >= 500_000_000n
  const isPromiseKeeper =
    hasPosted &&
    allPostedStats.length > 0 &&
    allPostedStats.some(b => b.winnersApproved > 0n) &&
    allPostedStats.every(
      b => !b.cancelled && (b.escrowRemaining === 0n || b.winnersApproved > 0n),
    )

  const payoutRatePct = hasPosted
    ? isPromiseKeeper
      ? 100
      : allPostedStats.length > 0
        ? Math.round(
            (allPostedStats.filter(b => b.winnersApproved > 0n).length / allPostedStats.length) *
              100,
          )
        : 0
    : 0

  // USDC balance (own profile only)
  const { data: balanceRaw, refetch: refetchBalance } = useReadContract({
    address: USDC_ADDRESS,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [address],
    chainId: CHAIN_ID,
    query: { enabled: isOwn },
  }) as { data: bigint | undefined; refetch: () => void }
  const balance = balanceRaw ?? 0n

  const handleSendClose = useCallback(() => {
    setShowSend(false)
    refetchBalance()
  }, [refetchBalance])

  const handleClaimed = useCallback(() => {
    refetchEarnings()
    refetchBalance()
  }, [refetchEarnings, refetchBalance])

  const profileUrl = `${window.location.origin}${window.location.pathname}#/profile/${address}`
  const hasPendingClaims = pendingEarnings > 0n && isOwn

  const cleanTwitter = profile.twitter?.replace(/^@/, '').trim()
  const cleanGithub = profile.github?.replace(/^@/, '').trim()
  const cleanWebsite = profile.website?.trim()
  const hasSocials = !!(cleanTwitter || cleanGithub || cleanWebsite)

  const milestones = [
    {
      id: 'first-catch',
      label: 'First Catch',
      desc: 'Won at least one bounty on Want.fun',
      earned: isFirstCatch,
      icon: <Award className="w-3.5 h-3.5" />,
    },
    {
      id: 'creator',
      label: 'Want Creator',
      desc: 'Funded an onchain USDC escrow bounty',
      earned: hasPosted,
      icon: <Sparkles className="w-3.5 h-3.5" />,
    },
    {
      id: 'heavy-hitter',
      label: 'Heavy Hitter',
      desc: 'Earned $500+ USDC across bounties',
      earned: isHeavyHitter,
      icon: <Zap className="w-3.5 h-3.5" />,
    },
    {
      id: 'promise-keeper',
      label: 'Promise Keeper',
      desc: '100% payout rate on created bounties',
      earned: isPromiseKeeper,
      icon: <ShieldCheck className="w-3.5 h-3.5" />,
    },
  ]

  const earnedMilestones = milestones.filter(m => m.earned)

  const TABS: { id: ProfileTab; label: string; count: number }[] = [
    { id: 'participating', label: 'Active', count: activeSubmittedIds.length },
    { id: 'past', label: 'Past', count: pastSubmittedIds.length },
    { id: 'posted', label: 'Created', count: allPostedIds.length },
  ]

  const currentTabIds =
    tab === 'participating'
      ? activeSubmittedIds
      : tab === 'past'
        ? pastSubmittedIds
        : allPostedIds

  const visibleIds = currentTabIds.slice(0, visibleCount)
  const remainingCount = Math.max(0, currentTabIds.length - visibleIds.length)

  async function handleCopyAddress() {
    const ok = await copyToClipboard(address)
    if (ok) {
      setCopiedAddr(true)
      toast.success('Wallet address copied')
      window.setTimeout(() => setCopiedAddr(false), 1800)
    }
  }

  async function handleCopyProfileUrl() {
    const ok = await copyToClipboard(profileUrl)
    if (ok) {
      setCopiedUrl(true)
      toast.success('Profile link copied')
      window.setTimeout(() => setCopiedUrl(false), 1800)
    }
  }

  const handleTabChange = (nextTab: ProfileTab) => {
    setTab(nextTab)
    setVisibleCount(PAGE_STEP)
  }

  const escrowRatioPct =
    balance + escrowTotal > 0n
      ? Math.min(100, Number((escrowTotal * 100n) / (balance + escrowTotal)))
      : 0

  return (
    <div className="flex flex-col gap-6 pb-8">
      {/* Hidden data readers */}
      {allPostedIds.map(id => (
        <BountyStatsReader key={`stat-${id.toString()}`} bountyId={id} onValue={onBountyStat} />
      ))}
      {allSubmittedIds.map(id => (
        <SubmittedMetaReader
          key={`meta-${id.toString()}`}
          bountyId={id}
          onValue={onSubmittedMeta}
        />
      ))}

      {/* ── Top Utility Bar ───────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <button
          type="button"
          onClick={onBack}
          className="group inline-flex items-center gap-2 px-3 py-2 -ml-3 rounded-xl text-[13px] font-medium text-[#111]/70 hover:text-[#111] hover:bg-[#111]/[0.05] transition-colors cursor-pointer min-h-[40px]"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
          <span>Back to Wall</span>
        </button>

        <div className="flex items-center gap-2 flex-wrap">
          <a
            href={getAddressUrl(address)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[#111]/12 bg-white hover:border-[#111]/30 text-[12px] font-medium text-[#111]/75 hover:text-[#111] transition-colors min-h-[40px]"
          >
            <span>Explorer</span>
            <ExternalLink className="w-3.5 h-3.5 text-[#111]/45" />
          </a>

          <button
            type="button"
            onClick={() => {
              void handleCopyProfileUrl()
            }}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[#111]/12 bg-white hover:border-[#111]/30 text-[12px] font-medium text-[#111]/75 hover:text-[#111] transition-colors cursor-pointer min-h-[40px]"
          >
            {copiedUrl ? (
              <Check className="w-3.5 h-3.5 text-emerald-600" />
            ) : (
              <Share2 className="w-3.5 h-3.5 text-[#111]/45" />
            )}
            <span>{copiedUrl ? 'Link Copied' : 'Share'}</span>
          </button>

          {isOwn && (
            <button
              type="button"
              onClick={() => setShowEdit(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#111] hover:bg-[#222] text-[#FFFDF0] text-[12.5px] font-semibold transition-colors cursor-pointer min-h-[40px]"
            >
              <Pencil className="w-3.5 h-3.5" />
              <span>Edit Profile</span>
            </button>
          )}
        </div>
      </div>

      {/* ── Executive Identity Hero Card ─────────────────────────────────── */}
      <motion.section
        initial={prefersReduced ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
        aria-label="Profile overview"
        className="bg-white rounded-2xl border border-[#111]/12 shadow-[0_1px_2px_rgba(17,17,17,0.04),0_12px_32px_-16px_rgba(17,17,17,0.08)] overflow-hidden"
      >
        {/* Subtle architectural top hairline */}
        <div className="h-[3px] w-full bg-gradient-to-r from-[#111111] via-[#111111]/40 to-transparent" />

        <div className="p-6 sm:p-8 flex flex-col md:flex-row md:items-start justify-between gap-6">
          {/* Left: Avatar + Identity Details */}
          <div className="flex flex-col sm:flex-row items-start gap-5 min-w-0 flex-1">
            {/* Avatar */}
            <div className="relative shrink-0">
              <div className="w-[80px] h-[80px] rounded-2xl overflow-hidden border border-[#111]/12 bg-[#FFFDF0] shadow-sm">
                <PixelAvatar address={address} size={80} variant={profile.avatar_variant} />
              </div>
              {isOwn && (
                <button
                  type="button"
                  onClick={() => setShowEdit(true)}
                  aria-label="Edit avatar and profile"
                  title="Edit profile"
                  className="absolute -bottom-1.5 -right-1.5 w-7 h-7 rounded-full bg-[#111] text-[#FFFDF0] hover:bg-[#222] border-2 border-white flex items-center justify-center shadow-sm transition-colors cursor-pointer"
                >
                  <Pencil className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* Identity copy */}
            <div className="min-w-0 flex-1 flex flex-col">
              {/* Role & Member Date eyebrow */}
              <div className="flex items-center gap-2 flex-wrap text-[12px] text-[#111]/55">
                <span className="inline-flex items-center gap-1.5 font-medium text-[#111]/75">
                  <span
                    className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0"
                    aria-hidden="true"
                  />
                  {isOwn ? 'Your Account' : 'Onchain Identity'}
                </span>
                <span className="text-[#111]/25" aria-hidden="true">
                  ·
                </span>
                <span className="font-mono-ui text-[11px]">{CHAIN_NAME}</span>
                {profileLoaded && profile.created_at && (
                  <>
                    <span className="text-[#111]/25" aria-hidden="true">
                      ·
                    </span>
                    <span>Joined {formatJoinedDate(profile.created_at)}</span>
                  </>
                )}
              </div>

              {/* Address headline + inline copy */}
              <div className="flex items-center gap-2.5 flex-wrap mt-1.5">
                <h1 className="font-heading text-[24px] sm:text-[28px] font-extrabold tracking-tight text-[#111] tabular-nums leading-none">
                  {formatAddress(address)}
                </h1>
                <button
                  type="button"
                  onClick={() => {
                    void handleCopyAddress()
                  }}
                  aria-label="Copy wallet address"
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-[#111]/10 bg-[#FAF9F2] hover:bg-[#111]/[0.06] text-[11.5px] font-mono-ui text-[#111]/70 hover:text-[#111] transition-colors cursor-pointer"
                >
                  {copiedAddr ? (
                    <Check className="w-3 h-3 text-emerald-600" />
                  ) : (
                    <Copy className="w-3 h-3" />
                  )}
                  <span>{copiedAddr ? 'Copied' : 'Copy'}</span>
                </button>
              </div>

              {/* Bio */}
              {profile.bio ? (
                <p className="text-[14px] text-[#111]/75 leading-relaxed max-w-xl mt-2.5">
                  {profile.bio}
                </p>
              ) : isOwn ? (
                <button
                  type="button"
                  onClick={() => setShowEdit(true)}
                  className="self-start mt-2 text-[13px] text-[#111]/50 hover:text-[#111] underline underline-offset-4 decoration-[#111]/25 hover:decoration-[#111] transition-colors cursor-pointer"
                >
                  + Add a bio and social links
                </button>
              ) : null}

              {/* Socials & Earned Badges */}
              {(hasSocials || earnedMilestones.length > 0) && (
                <div className="flex items-center gap-2 flex-wrap mt-4">
                  {cleanTwitter && (
                    <a
                      href={`https://x.com/${cleanTwitter}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-[#111]/12 bg-[#FAF9F2] hover:bg-[#111] hover:text-white hover:border-[#111] text-[12px] font-medium text-[#111]/80 transition-colors"
                    >
                      <XIcon size={11} />
                      <span>@{cleanTwitter}</span>
                      <ArrowUpRight className="w-3 h-3 opacity-60" />
                    </a>
                  )}
                  {cleanGithub && (
                    <a
                      href={`https://github.com/${cleanGithub}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-[#111]/12 bg-[#FAF9F2] hover:bg-[#111] hover:text-white hover:border-[#111] text-[12px] font-medium text-[#111]/80 transition-colors"
                    >
                      <GithubIcon size={12} />
                      <span>{cleanGithub}</span>
                      <ArrowUpRight className="w-3 h-3 opacity-60" />
                    </a>
                  )}
                  {cleanWebsite && (
                    <a
                      href={cleanWebsite.startsWith('http') ? cleanWebsite : `https://${cleanWebsite}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-[#111]/12 bg-[#FAF9F2] hover:bg-[#111] hover:text-white hover:border-[#111] text-[12px] font-medium text-[#111]/80 transition-colors"
                    >
                      <GlobeIcon size={12} />
                      <span className="max-w-[180px] truncate">
                        {cleanWebsite.replace(/^https?:\/\//, '').replace(/\/$/, '')}
                      </span>
                      <ArrowUpRight className="w-3 h-3 opacity-60" />
                    </a>
                  )}

                  {hasSocials && earnedMilestones.length > 0 && (
                    <span className="hidden sm:block h-4 w-px bg-[#111]/12 mx-0.5" aria-hidden="true" />
                  )}

                  {earnedMilestones.map(m => (
                    <span
                      key={m.id}
                      title={m.desc}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-[#111]/12 bg-white text-[11.5px] font-medium text-[#111]/80 select-none"
                    >
                      <span className="text-[#111]/65">{m.icon}</span>
                      <span>{m.label}</span>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right: Lifetime Earnings Anchor */}
          <div className="md:border-l md:border-[#111]/10 md:pl-8 pt-5 md:pt-0 border-t md:border-t-0 border-[#111]/10 flex flex-row md:flex-col items-center md:items-end justify-between gap-2 shrink-0">
            <span className="font-mono-ui text-[10.5px] uppercase tracking-[0.12em] text-[#111]/45">
              Lifetime Earned
            </span>
            <div className="flex flex-col items-end gap-1.5">
              <div className="flex items-center gap-2">
                <CoinIcon size={22} />
                <span className="font-heading text-[28px] sm:text-[32px] font-extrabold tracking-tight tabular-nums text-[#111] leading-none">
                  ${formatUsdc(earned)}
                </span>
                <span className="font-mono-ui text-[11px] uppercase tracking-wider text-[#111]/45">
                  USDC
                </span>
              </div>

              {pendingEarnings > 0n ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-[11px] font-medium text-amber-900 tabular-nums">
                  <Clock className="w-3 h-3" />
                  <span>+${formatUsdc(pendingEarnings)} pending</span>
                </span>
              ) : (
                <span className="text-[12px] text-[#111]/50 tabular-nums">
                  {wins > 0n
                    ? `${wins.toString()} ${wins === 1n ? 'bounty' : 'bounties'} won`
                    : 'Verified onchain record'}
                </span>
              )}
            </div>
          </div>
        </div>
      </motion.section>

      {/* ── Pending Claims Banner (own profile with pending payouts) ──────── */}
      {hasPendingClaims && allSubmittedIds.length > 0 && (
        <PendingClaimsBanner
          bountyIds={allSubmittedIds}
          profileAddr={address}
          pendingTotal={pendingEarnings}
          onClaimed={handleClaimed}
        />
      )}

      {/* ── 4-Column Executive KPI Strip ──────────────────────────────────── */}
      <section aria-label="Key metrics" className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <MetricCard
          label="Win Rate"
          value={winRatePct !== null ? `${winRatePct}%` : '—'}
          sub={`${wins.toString()} won · ${totalSubmissionsCount} submitted`}
          progress={winRatePct ?? 0}
          progressColor="#111111"
        />
        <MetricCard
          label="Submissions"
          value={totalSubmissionsCount.toString()}
          sub={
            submittedMetaReady
              ? `${activeSubmittedIds.length} active · ${pastSubmittedIds.length} past`
              : 'Syncing status…'
          }
        />
        <MetricCard
          label="Bounties Created"
          value={allPostedIds.length.toString()}
          sub={hasPosted ? `${payoutRatePct}% payout rate` : 'No bounties posted'}
          progress={hasPosted ? payoutRatePct : 0}
          progressColor="#16A34A"
        />
        <MetricCard
          label="Total Paid Out"
          value={`$${formatUsdc(paidOutTotal)}`}
          sub={
            escrowTotal > 0n
              ? `$${formatUsdc(escrowTotal)} locked in escrow`
              : 'USDC distributed'
          }
          accentValue={paidOutTotal > 0n}
        />
      </section>

      {/* ── Main Two-Column Workspace ─────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Primary Column: Activity List */}
        <section
          aria-label="Bounty activity"
          className="lg:col-span-8 bg-white rounded-2xl border border-[#111]/12 shadow-[0_1px_2px_rgba(17,17,17,0.04),0_12px_32px_-16px_rgba(17,17,17,0.08)] overflow-hidden"
        >
          {/* Header + Segmented Control */}
          <div className="px-5 sm:px-6 pt-5 pb-4 border-b border-[#111]/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="font-heading text-[16px] font-bold text-[#111] tracking-tight">
                Activity
              </h2>
              <p className="text-[12px] text-[#111]/50 mt-0.5">
                Onchain &amp; verified bounty participation history
              </p>
            </div>

            <div
              role="tablist"
              aria-label="Activity filter"
              className="inline-flex items-center p-1 rounded-xl bg-[#FAF9F2] border border-[#111]/10 self-start sm:self-auto"
            >
              {TABS.map(t => {
                const isActive = tab === t.id
                return (
                  <button
                    key={t.id}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    onClick={() => handleTabChange(t.id)}
                    className={`relative px-3.5 py-1.5 rounded-lg text-[12.5px] font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
                      isActive ? 'text-[#111]' : 'text-[#111]/55 hover:text-[#111]/85'
                    }`}
                  >
                    {isActive && (
                      <motion.span
                        layoutId="profile-activity-tab"
                        transition={
                          prefersReduced
                            ? { duration: 0.01 }
                            : { type: 'spring', stiffness: 460, damping: 36 }
                        }
                        className="absolute inset-0 bg-white rounded-lg border border-[#111]/10 shadow-sm"
                      />
                    )}
                    <span className="relative z-10">{t.label}</span>
                    <span
                      className={`relative z-10 font-mono-ui text-[10.5px] tabular-nums px-1.5 py-0.5 rounded-md leading-none ${
                        isActive ? 'bg-[#111]/[0.06] text-[#111]' : 'text-[#111]/45'
                      }`}
                    >
                      {t.count}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* List Body */}
          {visibleIds.length === 0 &&
          tab !== 'posted' &&
          !submittedMetaReady &&
          allSubmittedIds.length > 0 ? (
            <div className="divide-y divide-[#111]/8">
              <SkeletonBountyRow />
              <SkeletonBountyRow />
              <SkeletonBountyRow />
            </div>
          ) : visibleIds.length === 0 ? (
            <ActivityEmptyState
              tabMode={tab}
              isOwn={isOwn}
              onBrowseWall={onBrowseWall}
              onCreateBounty={onCreateBounty}
            />
          ) : (
            <>
              <div className="divide-y divide-[#111]/8">
                {visibleIds.map(id => (
                  <BountyListRow
                    key={`${tab}-${id.toString()}`}
                    bountyId={id}
                    profileAddr={address}
                    onSelect={onSelectBounty}
                    tabMode={tab}
                    isOffchainSubmitted={offchainSet.has(id.toString())}
                  />
                ))}
              </div>

              {remainingCount > 0 && (
                <div className="px-5 sm:px-6 py-3.5 border-t border-[#111]/8 bg-[#FAF9F2]/50">
                  <button
                    type="button"
                    onClick={() => setVisibleCount(c => c + PAGE_STEP)}
                    className="w-full py-2 rounded-xl border border-[#111]/12 bg-white hover:border-[#111]/30 text-[12.5px] font-medium text-[#111]/75 hover:text-[#111] transition-colors cursor-pointer"
                  >
                    Show more ({remainingCount} remaining)
                  </button>
                </div>
              )}
            </>
          )}
        </section>

        {/* Secondary Sidebar: Wallet + Track Record */}
        <aside className="lg:col-span-4 flex flex-col gap-5">
          {/* Wallet Panel (own profile only) */}
          {isOwn && (
            <section
              aria-label="Wallet balance"
              className="rounded-2xl bg-[#111111] text-[#FFFDF0] border border-[#111] p-5 sm:p-6 shadow-[0_12px_32px_-12px_rgba(17,17,17,0.28)]"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Wallet className="w-4 h-4 text-white/70" />
                  <h2 className="font-heading text-[15px] font-bold text-white tracking-tight">
                    Wallet
                  </h2>
                </div>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/[0.08] text-[10.5px] font-mono-ui text-white/75">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#C6F23A]" aria-hidden="true" />
                  Arc
                </span>
              </div>

              <div className="mt-5">
                <p className="font-mono-ui text-[10.5px] uppercase tracking-[0.12em] text-white/45">
                  Available Balance
                </p>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="font-heading text-[30px] font-extrabold tracking-tight tabular-nums text-white leading-none">
                    ${formatUsdc(balance)}
                  </span>
                  <span className="font-mono-ui text-[12px] text-white/55">USDC</span>
                </div>
              </div>

              {(hasPosted || escrowTotal > 0n) && (
                <div className="mt-4 pt-4 border-t border-white/10 flex flex-col gap-2">
                  <div className="flex items-center justify-between text-[12px]">
                    <span className="inline-flex items-center gap-1.5 text-white/60">
                      <Lock className="w-3.5 h-3.5" />
                      <span>Locked in Escrow</span>
                    </span>
                    <span className="font-mono-ui text-[12px] text-white tabular-nums">
                      ${formatUsdc(escrowTotal)}
                    </span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-white/12 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-[#C6F23A] transition-all duration-500"
                      style={{ width: `${escrowRatioPct}%` }}
                    />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2.5 mt-5">
                <button
                  type="button"
                  onClick={() => setShowReceive(true)}
                  className="inline-flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-white/10 hover:bg-white/15 border border-white/12 text-[13px] font-medium text-white transition-colors cursor-pointer"
                >
                  <ArrowDownLeft className="w-4 h-4" />
                  <span>Receive</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowSend(true)}
                  className="inline-flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-[#FFFDF0] hover:bg-[#FFE600] text-[13px] font-semibold text-[#111] transition-colors cursor-pointer"
                >
                  <ArrowUpRight className="w-4 h-4" />
                  <span>Send</span>
                </button>
              </div>

              <p className="text-[11px] text-white/40 mt-4 leading-relaxed">
                Self-custodial wallet. Private keys never leave your wallet provider.
              </p>
            </section>
          )}

          {/* Track Record & Credibility Card */}
          <section
            aria-label="Track record and reputation"
            className="bg-white rounded-2xl border border-[#111]/12 p-5 sm:p-6 shadow-[0_1px_2px_rgba(17,17,17,0.04)] flex flex-col gap-5"
          >
            <div className="flex items-center justify-between">
              <h2 className="font-heading text-[15px] font-bold text-[#111] tracking-tight">
                Track Record
              </h2>
              <Trophy className="w-4 h-4 text-[#111]/35" />
            </div>

            {/* Hunter Breakdown */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between text-[12.5px]">
                <span className="font-medium text-[#111]/75">Hunter Win Rate</span>
                <span className="font-mono-bold text-[12px] text-[#111] tabular-nums">
                  {winRatePct !== null ? `${winRatePct}%` : '—'}
                </span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-[#111]/[0.07] overflow-hidden">
                <div
                  className="h-full rounded-full bg-[#111] transition-all duration-500"
                  style={{ width: `${winRatePct ?? 0}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-[11.5px] text-[#111]/50 tabular-nums">
                <span>{wins.toString()} wins</span>
                <span>{totalSubmissionsCount} total entries</span>
              </div>
            </div>

            {/* Creator Breakdown */}
            <div className="pt-4 border-t border-[#111]/8 flex flex-col gap-2">
              <div className="flex items-center justify-between text-[12.5px]">
                <span className="font-medium text-[#111]/75">Creator Payout Rate</span>
                <span className="font-mono-bold text-[12px] text-[#111] tabular-nums">
                  {hasPosted ? `${payoutRatePct}%` : '—'}
                </span>
              </div>
              {hasPosted ? (
                <>
                  <div className="h-1.5 w-full rounded-full bg-[#111]/[0.07] overflow-hidden">
                    <div
                      className="h-full rounded-full bg-emerald-600 transition-all duration-500"
                      style={{ width: `${payoutRatePct}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[11.5px] text-[#111]/50 tabular-nums">
                    <span>${formatUsdc(paidOutTotal)} paid</span>
                    <span>${formatUsdc(escrowTotal)} in escrow</span>
                  </div>
                </>
              ) : (
                <div className="flex items-center justify-between gap-2 pt-0.5">
                  <span className="text-[12px] text-[#111]/45">No bounties created yet</span>
                  {isOwn && onCreateBounty && (
                    <button
                      type="button"
                      onClick={onCreateBounty}
                      className="inline-flex items-center gap-1 text-[12px] font-semibold text-[#111] hover:underline underline-offset-4 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Post</span>
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Reputation Milestones */}
            {(isOwn || earnedMilestones.length > 0) && (
              <div className="pt-4 border-t border-[#111]/8 flex flex-col gap-3">
                <span className="font-mono-ui text-[10.5px] uppercase tracking-[0.11em] text-[#111]/45">
                  Milestones
                </span>
                <div className="flex flex-col gap-2.5">
                  {(isOwn ? milestones : earnedMilestones).map(m => (
                    <div
                      key={m.id}
                      className={`flex items-start gap-2.5 ${m.earned ? 'opacity-100' : 'opacity-45'}`}
                    >
                      <span
                        className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 mt-0.5 border ${
                          m.earned
                            ? 'bg-[#111] text-[#FFFDF0] border-[#111]'
                            : 'bg-[#FAF9F2] text-[#111]/45 border-[#111]/12'
                        }`}
                      >
                        {m.icon}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[12.5px] font-semibold text-[#111] leading-tight">
                            {m.label}
                          </span>
                          {m.earned && (
                            <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          )}
                        </div>
                        <p className="text-[11.5px] text-[#111]/55 leading-snug">{m.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
        </aside>
      </div>

      {/* ── Modals ────────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {showEdit && (
          <EditProfileModal
            key="edit-profile-modal"
            address={address}
            profile={profile}
            onClose={() => setShowEdit(false)}
            onSaved={next => setProfile(next)}
          />
        )}
        {showSend && (
          <SendModal key="send-usdc-modal" balance={balance} onClose={handleSendClose} />
        )}
        {showReceive && (
          <ReceiveModal
            key="receive-usdc-modal"
            address={address}
            onClose={() => setShowReceive(false)}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
