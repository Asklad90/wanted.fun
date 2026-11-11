import React, { useState, useEffect, useRef, useCallback } from 'react'
import confetti from 'canvas-confetti'
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt, useSwitchChain } from 'wagmi'
import { toast } from 'sonner'
import { WindowCard } from './WindowCard'
import { PillButton } from './PillButton'
import { StatusTag } from './StatusTag'
import { LoadingBar } from './LoadingBar'
import { TxStatus } from './TxStatus'
import { SubmissionViewer } from './SubmissionViewer'
import { ClockIcon, LockIcon, CoinIcon, FolderIcon, CheckCircleIcon, WalletIcon, XIcon } from './Icons'
import { PixelAvatar } from './PixelAvatar'
import { fetchProfile, type OffchainProfile } from '../lib/submissions-api'
import { BOUNTY_BOARD_ABI } from '../bounty-abi'
import { CHAIN_ID, CONTRACT_ADDRESS } from '../bounty-config'
import { barColor, formatUsdc, formatAddress, timeLeft, bountyStatus, parseOnchainError } from '../lib/utils'
import { BountyData } from './BountyCard'
import {
  registerBounty,
  fetchSubmissions,
  postSubmission,
  fetchExamples,
  setVisibility,
  type OffchainSubmission,
  type BountyExample,
  type BountyRequirements,
} from '../lib/submissions-api'

// Confetti is drawn on the main thread on purpose. The default `confetti()` renders inside a
// blob: Web Worker, which our Content-Security-Policy blocks (no worker-src / blob:), so it
// silently showed nothing. useWorker:false needs no policy changes.
const fireBurst = confetti.create(undefined, { resize: true, useWorker: false })

function linkify(text: string): React.ReactNode {
  const urlRegex = /(https?:\/\/[^\s]+)/g
  const parts = text.split(urlRegex)
  return parts.map((part, i) => {
    if (part.match(/^https?:\/\//i)) {
      return (
        <a
          key={i}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[#1A1AE6] underline hover:text-[#111] break-all font-mono-ui font-semibold"
          onClick={e => e.stopPropagation()}
        >
          {part}
        </a>
      )
    }
    return part
  })
}

// Snapshot current unix seconds — defined outside components to avoid purity lint
const _getNowSec = (): number => Date.now() / 1000

// PayoutStatus enum: 0=None, 1=Pending, 2=Paid
const PAYOUT_PENDING = 1
const PAYOUT_PAID = 2

interface BountyPageProps {
  bountyId: bigint
  onBack: () => void
  onDataChange?: () => void
}

const TURNSTILE_SITE_KEY = (import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined) ?? ''

function TurnstileWidget({ onToken }: { onToken: (token: string) => void }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const widgetIdRef = useRef<string | null>(null)

  useEffect(() => {
    if (!TURNSTILE_SITE_KEY || !containerRef.current) return

    const SCRIPT_ID = 'cf-turnstile-script'
    if (!document.getElementById(SCRIPT_ID)) {
      const script = document.createElement('script')
      script.id = SCRIPT_ID
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
      script.async = true
      script.defer = true
      document.head.appendChild(script)
    }

    const interval = setInterval(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const turnstile = (window as any).turnstile
      if (turnstile && containerRef.current && !widgetIdRef.current) {
        clearInterval(interval)
        try {
          widgetIdRef.current = turnstile.render(containerRef.current, {
            sitekey: TURNSTILE_SITE_KEY,
            callback: (token: string) => onToken(token),
            theme: 'light',
          })
        } catch {
          // ignore render error
        }
      }
    }, 200)

    return () => {
      clearInterval(interval)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const turnstile = (window as any).turnstile
      if (turnstile && widgetIdRef.current) {
        try {
          turnstile.remove(widgetIdRef.current)
        } catch {
          /* ignore */
        }
        widgetIdRef.current = null
      }
    }
  }, [onToken])

  if (!TURNSTILE_SITE_KEY) return null

  return (
    <div className="my-2 flex justify-center">
      <div ref={containerRef} />
    </div>
  )
}

export function BountyPage({ bountyId, onBack, onDataChange }: BountyPageProps) {
  const { address, chainId } = useAccount()
  const { switchChain } = useSwitchChain()
  const [submissionText, setSubmissionText] = useState('')

  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploadPreview, setUploadPreview] = useState<string | null>(null)
  const [bountyRequirements, setBountyRequirements] = useState<BountyRequirements | null>(null)
  const [turnstileToken, setTurnstileToken] = useState<string>('')
  const [userProfile, setUserProfile] = useState<OffchainProfile | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const isWrongChain = chainId !== CHAIN_ID

  useEffect(() => {
    if (!address) { setUserProfile(null); return }
    fetchProfile(address).then(setUserProfile).catch(() => {})
  }, [address])

  const userHasSocial = !!(userProfile?.twitter?.trim() || userProfile?.github?.trim())
  const userMissingSocial = !!(bountyRequirements?.require_social && !userHasSocial)

  // Off-chain submission state
  const [offchainSubs, setOffchainSubs] = useState<OffchainSubmission[]>([])
  const [isPublic, setIsPublic] = useState(false)
  const [subsLoading, setSubsLoading] = useState(true)
  const [subsLoadedFor, setSubsLoadedFor] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [examples, setExamples] = useState<BountyExample[]>([])
  const [showAttachments, setShowAttachments] = useState(false)
  const [copied, setCopied] = useState(false)

  // Confetti — fires once per bounty visit when user is a winner
  const confettiFired = useRef(false)
  useEffect(() => { confettiFired.current = false }, [bountyId])
  const fireConfetti = useCallback(() => {
    if (confettiFired.current) return
    confettiFired.current = true
    const colors = ['#FF3E9A', '#FFE600', '#A78BFA', '#C6F23A', '#7FF3F0', '#FF6B57']
    void fireBurst({ particleCount: 120, spread: 80, origin: { y: 0.55 }, colors, scalar: 1.1 })
    setTimeout(() => { void fireBurst({ particleCount: 60, spread: 120, origin: { y: 0.4 }, colors, scalar: 0.9 }) }, 200)
    setTimeout(() => { void fireBurst({ particleCount: 40, angle: 60, spread: 60, origin: { x: 0, y: 0.6 }, colors }) }, 350)
    setTimeout(() => { void fireBurst({ particleCount: 40, angle: 120, spread: 60, origin: { x: 1, y: 0.6 }, colors }) }, 350)
  }, [])

  const { data: bounty, isError: bountyError, refetch: refetchBounty } = useReadContract({
    address: CONTRACT_ADDRESS, abi: BOUNTY_BOARD_ABI, functionName: 'getBounty',
    args: [bountyId], chainId: CHAIN_ID,
  }) as { data: BountyData | undefined; isError: boolean; refetch: () => void }

  const { data: userPayoutStatus, refetch: refetchPayoutStatus } = useReadContract({
    address: CONTRACT_ADDRESS, abi: BOUNTY_BOARD_ABI, functionName: 'payoutStatus',
    args: [bountyId, address ?? '0x0000000000000000000000000000000000000000'],
    chainId: CHAIN_ID, query: { enabled: !!address },
  }) as { data: number | undefined; refetch: () => void }

  const { data: reviewWindowRaw } = useReadContract({
    address: CONTRACT_ADDRESS, abi: BOUNTY_BOARD_ABI, functionName: 'reviewWindow',
    chainId: CHAIN_ID,
  }) as { data: number | undefined }

  const { data: createdAtRaw } = useReadContract({
    address: CONTRACT_ADDRESS, abi: BOUNTY_BOARD_ABI, functionName: 'createdAt',
    args: [bountyId], chainId: CHAIN_ID,
  }) as { data: bigint | undefined }

  const { data: cancelWindowRaw } = useReadContract({
    address: CONTRACT_ADDRESS, abi: BOUNTY_BOARD_ABI, functionName: 'CANCEL_WINDOW',
    chainId: CHAIN_ID,
  }) as { data: bigint | undefined }

  // Write: claim (pending payout)
  const { writeContract: claimReward, data: claimHash, isPending: claimPending, error: claimErr } = useWriteContract()
  const { isLoading: claimConfirming, isSuccess: claimSuccess } = useWaitForTransactionReceipt({ hash: claimHash })

  // Write: reclaimUnused
  const { writeContract: reclaimUnused, data: reclaimHash, isPending: reclaimPending, error: reclaimErr } = useWriteContract()
  const { isLoading: reclaimConfirming, isSuccess: reclaimSuccess } = useWaitForTransactionReceipt({ hash: reclaimHash })

  // Write: cancel
  const { writeContract: cancelBounty, data: cancelHash, isPending: cancelPending, error: cancelErr } = useWriteContract()
  const { isLoading: cancelConfirming, isSuccess: cancelSuccess } = useWaitForTransactionReceipt({ hash: cancelHash })

  // ── Load off-chain submissions ─────────────────────────────────────────────
  async function loadSubs() {
    if (!bounty) return
    setSubsLoading(true)
    try {
      const poster = bounty.poster.toLowerCase()
      const viewer = address?.toLowerCase()
      const res = await fetchSubmissions(bountyId.toString(), viewer, poster)
      setOffchainSubs(res.submissions)
      setIsPublic(res.is_public)
      if (res.requirements) setBountyRequirements(res.requirements)
    } catch {
      // silently ignore — the onchain path is the fallback
    } finally {
      setSubsLoadedFor((address ?? '').toLowerCase())
      setSubsLoading(false)
    }
  }

  // Fire confetti when user is a winner on this bounty (pending OR paid)
  useEffect(() => {
    if (userPayoutStatus === PAYOUT_PENDING || userPayoutStatus === PAYOUT_PAID) {
      // Small delay so the page renders first, then confetti pops
      const t = setTimeout(() => fireConfetti(), 400)
      return () => clearTimeout(t)
    }
  }, [userPayoutStatus, fireConfetti])

  // Register bounty + load subs + load examples when bounty data arrives
  useEffect(() => {
    if (!bounty) return
    void registerBounty(bountyId.toString(), bounty.poster.toLowerCase()).then(() => loadSubs())
    fetchExamples(bountyId.toString()).then(setExamples).catch(() => {})
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bountyId, bounty?.poster, address])

  function refetchAll() {
    refetchBounty(); refetchPayoutStatus(); void loadSubs(); onDataChange?.()
  }

  // ── File picker helpers ────────────────────────────────────────────────────
  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null
    setUploadFile(file)
    setUploadPreview(null)
    if (!file) return
    if (file.size > 3 * 1024 * 1024) {
      toast.error('File is too large. Max 3 MB.')
      setUploadFile(null)
      return
    }
    const reader = new FileReader()
    reader.onload = () => setUploadPreview(reader.result as string)
    reader.readAsDataURL(file)
  }

  function clearFile() {
    setUploadFile(null)
    setUploadPreview(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  // ── Off-chain submit ───────────────────────────────────────────────────────
  async function handleSubmit() {
    if (!address) { toast.error('Connect your wallet first.'); return }

    const hasText = submissionText.trim().length > 0
    const hasFile = !!uploadPreview

    if (!hasText && !hasFile) { toast.error('Add some text or attach a file.'); return }
    if (hasText && submissionText.length > 1000) { toast.error('Text is too long (max 1000 chars).'); return }

    // Encode as JSON if both present, otherwise plain string
    let content: string
    if (hasText && hasFile) {
      content = JSON.stringify({ text: submissionText.trim(), file: uploadPreview })
    } else if (hasFile) {
      content = uploadPreview!
    } else {
      content = submissionText.trim()
    }

    setSubmitting(true)
    try {
      const result = await postSubmission(bountyId.toString(), address, content, turnstileToken)
      if (!result.ok) {
        toast.error(result.error ?? 'Submission failed.')
        return
      }
      toast.success('Submission sent — free, no gas!')
      setSubmissionText('')
      clearFile()
      await loadSubs()
    } catch {
      toast.error('Network error. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  function handleClaim() {
    if (isWrongChain) { switchChain({ chainId: CHAIN_ID }); return }
    claimReward(
      { address: CONTRACT_ADDRESS, abi: BOUNTY_BOARD_ABI, functionName: 'claim', args: [bountyId], chainId: CHAIN_ID },
      { onSuccess: () => { toast.success('Payout claimed!'); refetchAll() }, onError: (err) => toast.error(parseOnchainError(err)) }
    )
  }

  function handleReclaim() {
    if (isWrongChain) { switchChain({ chainId: CHAIN_ID }); return }
    reclaimUnused(
      { address: CONTRACT_ADDRESS, abi: BOUNTY_BOARD_ABI, functionName: 'reclaimUnused', args: [bountyId], chainId: CHAIN_ID },
      { onSuccess: () => { toast.success('Unused escrow reclaimed!'); refetchAll() }, onError: (err) => toast.error(parseOnchainError(err)) }
    )
  }

  function handleCancel() {
    if (isWrongChain) { switchChain({ chainId: CHAIN_ID }); return }
    cancelBounty(
      { address: CONTRACT_ADDRESS, abi: BOUNTY_BOARD_ABI, functionName: 'cancel', args: [bountyId], chainId: CHAIN_ID },
      { onSuccess: () => { toast.success('Bounty cancelled, escrow refunded.'); refetchAll() }, onError: (err) => toast.error(parseOnchainError(err)) }
    )
  }

  async function handleToggleVisibility() {
    const next = !isPublic
    setIsPublic(next) // optimistic
    try {
      await setVisibility(bountyId.toString(), next)
      toast.success(next ? 'Submissions are now public.' : 'Submissions are now private.')
    } catch {
      setIsPublic(!next) // revert on failure
      toast.error('Failed to update visibility.')
    }
  }

  if (bountyError) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-20 text-center max-w-md mx-auto px-4">
        <div className="font-heading text-[24px] font-extrabold text-[#111]">Bounty Not Found</div>
        <p className="font-mono-ui text-[12px] text-[#111]/70 leading-relaxed">
          We couldn't load Bounty #{bountyId.toString()}. It may not exist yet or there was a network connection issue.
        </p>
        <button
          onClick={onBack}
          className="font-mono-bold text-[11px] uppercase tracking-wider bg-[#FFE600] border-[2px] border-[#111] px-4 py-2 rounded-full shadow-hard-sm hover:bg-[#FFE600]/80 transition-colors btn-press cursor-pointer"
        >
          ← Back to wall
        </button>
      </div>
    )
  }

  if (!bounty) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="font-mono-bold text-[13px] uppercase tracking-widest text-[#111]/60 animate-pulse">Loading bounty...</div>
      </div>
    )
  }

  const status = bountyStatus({ winnersApproved: bounty.winnersApproved, maxWinners: bounty.maxWinners, deadline: bounty.deadline, cancelled: bounty.cancelled })
  const isPoster = !!(address && address.toLowerCase() === bounty.poster.toLowerCase())
  const idNum = Number(bounty.id)

  // Decode title/description from bytes
  function decodeBytes(hex: string | undefined): string {
    if (!hex || hex === '0x') return ''
    try {
      const clean = hex.startsWith('0x') ? hex.slice(2) : hex
      const bytes = new Uint8Array(clean.match(/.{1,2}/g)!.map(b => parseInt(b, 16)))
      return new TextDecoder().decode(bytes)
    } catch { return '' }
  }

  const titleStr = decodeBytes(bounty.title) || `Bounty #${idNum}`
  const descStr = decodeBytes(bounty.description)

  // Timing
  const now = Math.floor(_getNowSec())
  const reviewWindowSec = reviewWindowRaw ?? 0
  const approvalCutoff = Number(bounty.deadline) + reviewWindowSec
  const afterReviewWindow = now > approvalCutoff
  const totalPrize = bounty.rewardPerWinner * bounty.maxWinners
  const paidOut = totalPrize - bounty.escrowRemaining

  // Check if connected user already submitted
  const alreadySubmitted = !!offchainSubs.find(s => s.submitter.toLowerCase() === address?.toLowerCase())

  function getShareUrl(): string {
    if (typeof window !== 'undefined') {
      return `${window.location.origin}/#/bounty/${bountyId.toString()}`
    }
    return `https://want.fun/#/bounty/${bountyId.toString()}`
  }

  function handleCopyLink() {
    const url = getShareUrl()
    navigator.clipboard.writeText(url)
      .then(() => {
        setCopied(true)
        toast.success('Bounty link copied!')
        setTimeout(() => setCopied(false), 2000)
      })
      .catch(() => toast.error('Failed to copy link'))
  }

  function handleShareX() {
    const url = getShareUrl()
    const cleanDesc = descStr.replace(/\s+/g, ' ').trim()
    const descSnippet = cleanDesc
      ? cleanDesc.length > 120
        ? `"${cleanDesc.slice(0, 117)}..."`
        : `"${cleanDesc}"`
      : ''

    const parts = [
      `Check out this bounty on @wantdotfun:\n"${titleStr}"`,
      descSnippet,
      `💰 ${formatUsdc(bounty.rewardPerWinner)} USDC prize locked in escrow!\n\n${url}`,
    ].filter(Boolean)

    const text = encodeURIComponent(parts.join('\n\n'))
    window.open(`https://twitter.com/intent/tweet?text=${text}`, '_blank', 'noopener,noreferrer')
  }

  return (
    <div className="flex flex-col gap-6 max-w-2xl desk:max-w-[1120px] mx-auto">
      {/* Neo-Brutalist Top Action Bar */}
      <div className="border-[3px] border-[#111] rounded-2xl bg-white shadow-hard px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-1.5 font-mono-bold text-[11px] uppercase tracking-wider text-[#111] bg-[#FFE600] hover:bg-[#FFE600]/85 border-[2.5px] border-[#111] px-3.5 py-1.5 rounded-full shadow-hard-xs transition-colors btn-press cursor-pointer"
          >
            <span aria-hidden="true">←</span>
            <span>Back to Wall</span>
          </button>
          <span className="hidden sm:inline-flex items-center gap-1.5 font-mono-bold text-[10px] uppercase tracking-widest text-[#111] bg-[#FFFDF0] border-[2px] border-[#111] rounded-full px-3 py-1">
            <span className="w-2 h-2 rounded-full bg-[#10B981] border border-[#111]" />
            Bounty #{String(idNum).padStart(3, '0')} · Onchain Escrow
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleCopyLink}
            className="inline-flex items-center gap-1.5 font-mono-bold text-[11px] uppercase tracking-wider bg-[#FFFDF0] border-[2.5px] border-[#111] px-3.5 py-1.5 rounded-full shadow-hard-xs hover:bg-[#FFE600] transition-colors btn-press cursor-pointer"
            title="Copy link to this bounty"
          >
            {copied ? (
              <span>✓ Copied</span>
            ) : (
              <>
                <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                  <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                </svg>
                <span>Copy link</span>
              </>
            )}
          </button>
          <button
            type="button"
            onClick={handleShareX}
            className="inline-flex items-center gap-1.5 font-mono-bold text-[11px] uppercase tracking-wider bg-[#111] text-white border-[2.5px] border-[#111] px-3.5 py-1.5 rounded-full shadow-hard-xs hover:bg-[#222] hover:text-[#FFE600] transition-colors btn-press cursor-pointer"
            title="Share on X"
          >
            <XIcon size={11} />
            <span>Share</span>
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-6 desk:grid desk:grid-cols-[1fr_340px] desk:gap-6 desk:items-start">
      <div className="flex flex-col gap-6 min-w-0">

      {/* Main bounty window */}
      <WindowCard
        title={`BOUNTY_${String(idNum).padStart(3, '0')}.EXE`}
        titleBarColor="#4EFA96"
        bodyClassName="flex flex-col gap-0 !p-0"
      >
        {/* Hero Checkerboard Header Zone */}
        <div className="checkerboard border-b-[3px] border-[#111] p-4 sm:p-6 flex flex-col gap-3.5">
          {/* Status + Deadline row */}
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              <StatusTag status={status} />
              <span className="inline-flex items-center gap-1.5 border-[2px] border-[#111] rounded-full px-2.5 py-1 bg-[#C6F23A] font-mono-bold text-[10px] uppercase tracking-wider text-[#111] shadow-hard-xs">
                <LockIcon size={11} />
                ${formatUsdc(totalPrize)} Pool Locked
              </span>
            </div>
            <div className="inline-flex items-center gap-1.5 border-[2px] border-[#111] rounded-full px-3 py-1 bg-white text-[#111] shadow-hard-xs">
              <ClockIcon size={14} className="text-[#111]" />
              <span className="font-mono-bold text-[11px] sm:text-[12px] uppercase tracking-wider">{timeLeft(bounty.deadline)}</span>
            </div>
          </div>

          {/* Framed White Headline Card */}
          <div className="bg-white border-[3px] border-[#111] rounded-2xl p-4 sm:p-6 shadow-hard-sm flex flex-col gap-3">
            <div>
              <h1 className="font-heading font-black text-[30px] sm:text-[40px] leading-[1.08] text-[#111] tracking-tight text-balance">
                {titleStr}
              </h1>
              <div className="w-28 sm:w-36 h-2 bg-[#A3E635] border border-[#111] rounded-full mt-2.5" />
            </div>

            {/* Creator attribution pill */}
            <div className="flex items-center justify-between gap-2 flex-wrap pt-2 border-t-[2px] border-[#111]/10">
              <a
                href={`#/profile/${bounty.poster}`}
                className="inline-flex items-center gap-2 group cursor-pointer"
              >
                <span className="inline-flex rounded-lg overflow-hidden border-[2px] border-[#111] shadow-hard-xs">
                  <PixelAvatar address={bounty.poster} size={24} />
                </span>
                <span className="font-mono-ui text-[11px] text-[#111]/70">
                  Created by <strong className="font-mono-bold text-[#111] group-hover:text-[#1A1AE6] group-hover:underline">{formatAddress(bounty.poster)}</strong>
                </span>
                <span className="font-mono-bold text-[11px] text-[#111] group-hover:translate-x-0.5 transition-transform">↗</span>
              </a>
              <span className="font-mono-bold text-[10px] uppercase tracking-widest text-[#111]/60 bg-[#FFFDF0] border-[1.5px] border-[#111] rounded-md px-2 py-0.5">
                ID #{idNum}
              </span>
            </div>
          </div>
        </div>

        {/* Body Content inside BOUNTY.EXE */}
        <div className="p-4 sm:p-6 flex flex-col gap-5 bg-[#FFFDF0]">
          {/* Framed Task Brief Document Box */}
          <div className="border-[2.5px] border-[#111] rounded-2xl bg-white shadow-hard-sm overflow-hidden">
            <div className="bg-[#111] text-[#FFFDF0] px-4 py-2 flex items-center justify-between border-b-[2.5px] border-[#111]">
              <span className="font-mono-bold text-[10px] uppercase tracking-widest text-[#FFE600]">
                TASK_BRIEF.TXT — Instructions &amp; Deliverables
              </span>
              {examples.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowAttachments(true)}
                  className="font-mono-bold text-[10px] uppercase tracking-wider text-[#7FF3F0] hover:underline cursor-pointer"
                >
                  {examples.length} Reference File{examples.length === 1 ? '' : 's'} ↗
                </button>
              )}
            </div>
            <div className="p-4 sm:p-5 flex flex-col gap-4">
              <p className="font-body text-[15px] sm:text-[16px] leading-relaxed text-[#111]/90 whitespace-pre-wrap">
                {linkify(descStr)}
              </p>

              {/* Inline preview of the first attachment, with a button to view them all */}
              {examples.length > 0 && (
                <div className="flex flex-col gap-2 pt-3 border-t-[2px] border-dashed border-[#111]/15">
                  <span className="font-mono-bold text-[10px] uppercase tracking-widest text-[#111]/60">
                    Attached Reference Material
                  </span>
                  <div className="flex items-center gap-3 flex-wrap">
                    <button
                      type="button"
                      onClick={() => setShowAttachments(true)}
                      className="relative self-start border-[3px] border-[#111] rounded-xl overflow-hidden shadow-hard-sm btn-press cursor-pointer"
                    >
                      {examples[0].content.startsWith('data:video') ? (
                        // eslint-disable-next-line jsx-a11y/media-has-caption
                        <video src={examples[0].content} className="w-full max-w-xs max-h-48 object-cover bg-black" muted />
                      ) : (
                        <img src={examples[0].content} alt="Bounty requirement attachment preview" className="w-full max-w-xs max-h-48 object-cover" />
                      )}
                      <span className="absolute top-2 right-2 w-6 h-6 rounded-md border-2 border-[#111] bg-[#FFE600] flex items-center justify-center shadow-hard-xs">
                        <AttachmentIcon />
                      </span>
                    </button>
                    {examples.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setShowAttachments(true)}
                        className="font-mono-bold text-[11px] uppercase tracking-wider bg-[#FFFDF0] border-[2px] border-[#111] px-3.5 py-2 rounded-full shadow-hard-xs hover:bg-[#FFE600] transition-colors cursor-pointer"
                      >
                        View all {examples.length} files →
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 2x2 Stat Grid with Neo-Brutalist Icon Badges & Hard Shadows */}
          <div className="grid grid-cols-2 gap-3.5">
            {/* Box 1: USDC / WINNER (Top-Left) */}
            <div className="relative overflow-hidden border-[3px] border-[#111] rounded-2xl p-4 bg-[#111] flex flex-col justify-between min-h-[108px] shadow-hard-sm">
              <div className="bounty-glass-shine" aria-hidden="true">
                <div className="bounty-glass-beam-bloom" style={{ animationDelay: '0s' }} />
                <div className="bounty-glass-beam" style={{ animationDelay: '0s' }} />
              </div>
              <div className="flex items-center justify-between relative z-1">
                <span className="w-8 h-8 rounded-lg bg-[#FFE600] border-[2px] border-white flex items-center justify-center">
                  <CoinIcon size={18} className="text-[#111]" />
                </span>
                <span className="font-mono-bold text-[9px] uppercase tracking-widest px-2 py-0.5 rounded bg-white/10 text-[#FFE600] border border-white/15">
                  PRIZE
                </span>
              </div>
              <div className="relative z-1 mt-3">
                <div className="font-heading text-[28px] sm:text-[34px] font-black leading-tight text-white tabular-nums">
                  ${formatUsdc(bounty.rewardPerWinner)}
                </div>
                <div className="font-mono-bold text-[10px] sm:text-[11px] uppercase tracking-wider text-white/70 mt-0.5">
                  USDC / WINNER
                </div>
              </div>
            </div>

            {/* Box 2: DEADLINE (Top-Right) */}
            <div className="relative overflow-hidden border-[3px] border-[#111] rounded-2xl p-4 bg-[#111] flex flex-col justify-between min-h-[108px] shadow-hard-sm">
              <div className="bounty-glass-shine" aria-hidden="true">
                <div className="bounty-glass-beam-bloom" style={{ animationDelay: '0.7s' }} />
                <div className="bounty-glass-beam" style={{ animationDelay: '0.7s' }} />
              </div>
              <div className="flex items-center justify-between relative z-1">
                <span className="w-8 h-8 rounded-lg bg-[#7FF3F0] border-[2px] border-white flex items-center justify-center">
                  <ClockIcon size={18} className="text-[#111]" />
                </span>
                <span className="font-mono-bold text-[9px] uppercase tracking-widest px-2 py-0.5 rounded bg-white/10 text-[#7FF3F0] border border-white/15">
                  TIMER
                </span>
              </div>
              <div className="relative z-1 mt-3">
                <div className="font-heading text-[24px] sm:text-[30px] font-black leading-tight text-white truncate">
                  {timeLeft(bounty.deadline)}
                </div>
                <div className="font-mono-bold text-[10px] sm:text-[11px] uppercase tracking-wider text-white/70 mt-0.5">
                  DEADLINE
                </div>
              </div>
            </div>

            {/* Box 3: SUBMISSIONS (Bottom-Left) */}
            <div className="relative overflow-hidden border-[3px] border-[#111] rounded-2xl p-4 bg-[#111] flex flex-col justify-between min-h-[108px] shadow-hard-sm">
              <div className="bounty-glass-shine" aria-hidden="true">
                <div className="bounty-glass-beam-bloom" style={{ animationDelay: '1.4s' }} />
                <div className="bounty-glass-beam" style={{ animationDelay: '1.4s' }} />
              </div>
              <div className="flex items-center justify-between relative z-1">
                <span className="w-8 h-8 rounded-lg bg-[#A78BFA] border-[2px] border-white flex items-center justify-center">
                  <FolderIcon size={18} className="text-[#111]" />
                </span>
                <span className="font-mono-bold text-[9px] uppercase tracking-widest px-2 py-0.5 rounded bg-white/10 text-[#A78BFA] border border-white/15">
                  ENTRIES
                </span>
              </div>
              <div className="relative z-1 mt-3">
                <div className="font-heading text-[28px] sm:text-[34px] font-black leading-tight text-white tabular-nums">
                  {offchainSubs.length}
                </div>
                <div className="font-mono-bold text-[10px] sm:text-[11px] uppercase tracking-wider text-white/70 mt-0.5">
                  SUBMISSIONS
                </div>
              </div>
            </div>

            {/* Box 4: WINNERS (Bottom-Right) */}
            <div className="relative overflow-hidden border-[3px] border-[#111] rounded-2xl p-4 bg-[#111] flex flex-col justify-between min-h-[108px] shadow-hard-sm">
              <div className="bounty-glass-shine" aria-hidden="true">
                <div className="bounty-glass-beam-bloom" style={{ animationDelay: '2.1s' }} />
                <div className="bounty-glass-beam" style={{ animationDelay: '2.1s' }} />
              </div>
              <div className="flex items-center justify-between relative z-1">
                <span className="w-8 h-8 rounded-lg bg-[#C6F23A] border-[2px] border-white flex items-center justify-center">
                  <LockIcon size={18} className="text-[#111]" />
                </span>
                <span className="font-mono-bold text-[9px] uppercase tracking-widest px-2 py-0.5 rounded bg-white/10 text-[#C6F23A] border border-white/15">
                  SLOTS
                </span>
              </div>
              <div className="relative z-1 mt-3">
                <div className="font-heading text-[28px] sm:text-[34px] font-black leading-tight text-white tabular-nums">
                  {Number(bounty.maxWinners)}
                </div>
                <div className="font-mono-bold text-[10px] sm:text-[11px] uppercase tracking-wider text-white/70 mt-0.5">
                  WINNER{Number(bounty.maxWinners) !== 1 ? 'S' : ''}
                </div>
              </div>
            </div>
          </div>

          {/* Escrow Vault Panel with Halftone Texture & Framed Sub-Boxes */}
          <div className="relative overflow-hidden border-[3px] border-[#111] rounded-2xl p-4 sm:p-5 bg-gradient-to-r from-[#EAFCDA] via-[#E8FCD8] to-[#DEFBAE] shadow-hard-sm">
            <div
              className="absolute right-0 top-0 bottom-0 w-2/5 opacity-20 pointer-events-none"
              style={{
                backgroundImage: 'radial-gradient(#111 2px, transparent 2px)',
                backgroundSize: '8px 8px',
              }}
            />
            <div className="flex items-center justify-between gap-2 mb-3 relative z-1 flex-wrap">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-md bg-[#111] text-[#C6F23A] flex items-center justify-center">
                  <LockIcon size={13} />
                </span>
                <span className="font-mono-bold text-[12px] uppercase tracking-wider text-[#111]">ONCHAIN ESCROW VAULT</span>
              </div>
              <span className="font-mono-bold text-[9px] uppercase tracking-widest px-2.5 py-0.5 rounded-full bg-white border-[2px] border-[#111] text-[#111] shadow-hard-xs">
                100% Funded Upfront
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 relative z-1">
              <div className="bg-white/95 border-[2px] border-[#111] rounded-xl p-3 shadow-hard-xs flex flex-col">
                <span className="font-mono-bold text-[10px] uppercase tracking-wider text-[#111]/60">LOCKED IN CONTRACT</span>
                <span className="font-heading text-[22px] sm:text-[26px] font-black tabular-nums text-[#111] mt-0.5">
                  ${formatUsdc(bounty.escrowRemaining)} <span className="text-[14px] font-bold">USDC</span>
                </span>
              </div>
              <div className="bg-white/95 border-[2px] border-[#111] rounded-xl p-3 shadow-hard-xs flex flex-col">
                <span className="font-mono-bold text-[10px] uppercase tracking-wider text-[#111]/60">PAID TO WINNERS</span>
                <span className="font-heading text-[22px] sm:text-[26px] font-black tabular-nums text-[#16a34a] mt-0.5">
                  ${formatUsdc(paidOut)} <span className="text-[14px] font-bold text-[#111]">USDC</span>
                </span>
              </div>
            </div>
          </div>

          {/* Framed Winners Segmented Bar */}
          <div className="border-[2.5px] border-[#111] rounded-2xl p-4 bg-white shadow-hard-xs">
            <div className="flex items-center justify-between gap-2 mb-2.5">
              <span className="font-heading font-black text-[13px] uppercase tracking-wider text-[#111]">
                WINNERS APPROVED ({Number(bounty.winnersApproved)} / {Number(bounty.maxWinners)})
              </span>
              <span className="font-mono-bold text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#FF2E93]/15 text-[#111] border border-[#111]/30">
                {Number(bounty.maxWinners) > 0 ? Math.round((Number(bounty.winnersApproved) / Number(bounty.maxWinners)) * 100) : 0}% Filled
              </span>
            </div>
            {Number(bounty.maxWinners) <= 12 ? (
              <div className="flex gap-2">
                {Array.from({ length: Number(bounty.maxWinners) }, (_, i) => {
                  const isFilled = i < Number(bounty.winnersApproved)
                  return (
                    <div
                      key={i}
                      className={`h-6 sm:h-7 flex-1 border-[2.5px] border-[#111] rounded-lg transition-all ${
                        isFilled ? 'bg-[#FF2E93] shadow-[2px_2px_0_#111]' : 'bg-[#FFFDF0]'
                      }`}
                    />
                  )
                })}
              </div>
            ) : (
              <div className="h-6 sm:h-7 w-full border-[2.5px] border-[#111] rounded-lg bg-[#FFFDF0] overflow-hidden p-0.5">
                <div
                  className="h-full bg-[#FF2E93] rounded-md transition-all duration-500"
                  style={{
                    width: `${Number(bounty.maxWinners) > 0 ? Math.min(100, (Number(bounty.winnersApproved) / Number(bounty.maxWinners)) * 100) : 0}%`,
                  }}
                />
              </div>
            )}
          </div>
        </div>
      </WindowCard>

      <div id="work-area" className="flex flex-col gap-5 scroll-mt-24">
      {/* Pending payout — winner can claim */}
      {userPayoutStatus === PAYOUT_PENDING && (
        <WindowCard title="CLAIM_REWARD.EXE" titleBarColor="#C6F23A">
          <div className="flex flex-col gap-3">
            <div className="font-heading text-[22px] font-extrabold text-[#111]">You have a pending payout!</div>
            <div className="font-body text-[14px] text-[#111]/70">The automatic transfer failed (e.g. address blocklisted). Claim your reward manually.</div>
            <TxStatus hash={claimHash} isPending={claimPending} isConfirming={claimConfirming} isSuccess={claimSuccess} isError={!!claimErr} error={claimErr ? parseOnchainError(claimErr) : undefined} successMessage="Payout claimed!" />
            {!claimSuccess && <PillButton onClick={handleClaim} loading={claimPending || claimConfirming} variant="lime">Claim {formatUsdc(bounty.rewardPerWinner)} USDC</PillButton>}
          </div>
        </WindowCard>
      )}

      {/* Auto-paid notice */}
      {userPayoutStatus === PAYOUT_PAID && (
        <WindowCard title="YOU_WON.EXE" titleBarColor="#C6F23A">
          <div className="font-heading text-[20px] font-extrabold text-[#111]">Paid! {formatUsdc(bounty.rewardPerWinner)} USDC sent to your wallet.</div>
        </WindowCard>
      )}

      {/* Submit form — free, off-chain */}
      {!isPoster && status === 'OPEN' && !alreadySubmitted && address && (userPayoutStatus === undefined || userPayoutStatus === 0) && (
        <WindowCard title="SUBMIT_WORK.EXE" titleBarColor="#A78BFA">
          <div className="flex flex-col gap-3">
            {/* Info banner */}
            <div className="font-mono-ui text-[11px] text-[#111] border-[2px] border-[#111] rounded-xl p-2.5 bg-[#C6F23A]/25 shadow-hard-xs">
              <strong>Free submission</strong> — no gas required, stored off-chain.
            </div>

            {/* Text / link */}
            <div className="flex flex-col gap-1">
              <span className="font-mono-bold text-[10px] uppercase tracking-widest text-[#111]/60">Text / Link</span>
              <textarea
                value={submissionText}
                onChange={e => setSubmissionText(e.target.value)}
                placeholder="Paste a link, YouTube URL, or describe your work..."
                rows={4}
                className="input-neo rounded-xl px-3.5 py-2.5 text-[15px] font-body w-full resize-none"
              />
              <div className={`font-mono-ui text-[10px] text-right ${submissionText.length > 1000 ? 'text-[#FF6B57]' : 'text-[#111]/50'}`}>
                {submissionText.length}/1000
              </div>
            </div>

            {/* File upload */}
            <div className="flex flex-col gap-2">
              <span className="font-mono-bold text-[10px] uppercase tracking-widest text-[#111]/60">Attach image or video (optional)</span>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="border-[3px] border-dashed border-[#111] rounded-xl p-4 flex flex-col items-center gap-1.5 bg-[#FFFDF0] hover:bg-[#A78BFA]/15 transition-colors cursor-pointer"
              >
                <UploadIcon />
                <span className="font-mono-bold text-[10px] uppercase tracking-widest text-[#111]/70">
                  {uploadFile ? uploadFile.name : 'Tap to choose image or video'}
                </span>
                <span className="font-mono-ui text-[9px] text-[#111]/50">Max 3 MB · JPG, PNG, GIF, WEBP, MP4, MOV, WEBM</span>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp,video/mp4,video/quicktime,video/webm"
                onChange={handleFileChange}
                className="hidden"
              />
              {uploadPreview && (
                <div className="relative border-[2px] border-[#111] rounded-xl overflow-hidden">
                  {uploadFile?.type.startsWith('video/') ? (
                    // eslint-disable-next-line jsx-a11y/media-has-caption
                    <video src={uploadPreview} controls className="w-full max-h-48 bg-black" />
                  ) : (
                    <img src={uploadPreview} alt="Upload file preview" className="w-full max-h-48 object-contain bg-[#FFFDF0]" />
                  )}
                  <button
                    onClick={clearFile}
                    className="absolute top-2 right-2 bg-[#FF3E9A] border-[2px] border-[#111] rounded-full w-6 h-6 flex items-center justify-center font-mono-bold text-[11px] text-white shadow-hard-sm cursor-pointer"
                  >×</button>
                </div>
              )}
            </div>

            {userMissingSocial && (
              <div className="border-[2px] border-[#111] rounded-xl p-3 bg-[#FFE600]/35 flex items-center justify-between gap-2.5 shadow-hard-xs">
                <span className="font-mono-ui text-[11px] text-[#111] flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-[#FF6B57] border-[1.5px] border-[#111] text-white font-mono-bold text-[11px] inline-flex items-center justify-center shrink-0">!</span>
                  <span>This bounty requires a connected Twitter/X or GitHub profile.</span>
                </span>
                <a
                  href={address ? `#/profile/${address}` : '#/'}
                  className="font-mono-bold text-[10px] uppercase tracking-wider text-[#1A1AE6] underline shrink-0"
                >
                  Add socials →
                </a>
              </div>
            )}

            <TurnstileWidget onToken={setTurnstileToken} />

            <PillButton
              onClick={() => { void handleSubmit() }}
              loading={submitting}
              disabled={submitting || submissionText.length > 1000 || userMissingSocial || (!!TURNSTILE_SITE_KEY && !turnstileToken)}
            >
              Submit work — free →
            </PillButton>
          </div>
        </WindowCard>
      )}

      {/* Not connected — prompt */}
      {!address && status === 'OPEN' && (
        <WindowCard title="SUBMIT_WORK.EXE" titleBarColor="#A78BFA">
          <div className="font-mono-bold text-[13px] uppercase tracking-wider text-[#111]/60 text-center py-4">Connect your wallet to submit work</div>
        </WindowCard>
      )}

      {/* Already submitted notice */}
      {!isPoster && alreadySubmitted && (userPayoutStatus === 0 || userPayoutStatus === undefined) && (
        <WindowCard title="SUBMITTED.EXE" titleBarColor="#7FF3F0">
          <div className="font-mono-bold text-[12px] uppercase tracking-wider text-[#111]/70">You submitted to this bounty. Waiting for creator review.</div>
        </WindowCard>
      )}

      </div>

      {/* Poster actions */}
      {isPoster && (
        <>
          {/* Reclaim after review window */}
          {afterReviewWindow && !bounty.reclaimedUnused && bounty.escrowRemaining > 0n && (
            <WindowCard title="RECLAIM_UNUSED.EXE" titleBarColor="#FF6B57">
              <div className="flex flex-col gap-3">
                <div className="font-body text-[14px] text-[#111]">Review window ended. Reclaim unclaimed prize slots ({formatUsdc(bounty.escrowRemaining)} USDC).</div>
                <TxStatus hash={reclaimHash} isPending={reclaimPending} isConfirming={reclaimConfirming} isSuccess={reclaimSuccess} isError={!!reclaimErr} error={reclaimErr ? parseOnchainError(reclaimErr) : undefined} successMessage="Escrow reclaimed!" />
                {!reclaimSuccess && <PillButton onClick={handleReclaim} loading={reclaimPending || reclaimConfirming} variant="pink">Reclaim unused prize</PillButton>}
              </div>
            </WindowCard>
          )}

          {/* Cancel — only within the cancel window after posting, with no submissions or winners */}
          {offchainSubs.length === 0 && !bounty.cancelled && Number(bounty.winnersApproved) === 0 &&
            createdAtRaw !== undefined && cancelWindowRaw !== undefined &&
            Date.now() / 1000 <= Number(createdAtRaw) + Number(cancelWindowRaw) && (
            <WindowCard title="CANCEL_BOUNTY.EXE" titleBarColor="#CCCCCC">
              <div className="flex flex-col gap-3">
                <div className="font-body text-[14px] text-[#111]">No submissions yet. You can cancel and get your full escrow back during the first hour after posting.</div>
                <TxStatus hash={cancelHash} isPending={cancelPending} isConfirming={cancelConfirming} isSuccess={cancelSuccess} isError={!!cancelErr} error={cancelErr ? parseOnchainError(cancelErr) : undefined} successMessage="Bounty cancelled, escrow refunded." />
                {!cancelSuccess && <PillButton onClick={handleCancel} loading={cancelPending || cancelConfirming} variant="ink" showArrow={false}>Cancel bounty</PillButton>}
              </div>
            </WindowCard>
          )}
        </>
      )}

      {/* Submissions list */}
      <div id="submissions-list" className="scroll-mt-24">
      <OffchainSubmissionList
        submissions={offchainSubs}
        bountyId={bountyId}
        isPoster={isPoster}
        isPublic={isPublic}
        loading={subsLoading}
        rewardPerWinner={bounty.rewardPerWinner}
        afterReviewWindow={afterReviewWindow}
        approvalCutoff={approvalCutoff}
        onApproved={refetchAll}
        onToggleVisibility={isPoster ? () => { void handleToggleVisibility() } : undefined}
      />
      </div>

      </div>

      {/* ── Sidebar (desktop) ──────────────────────────────────────────────── */}
      <div className="flex flex-col gap-5">
        {/* Reward card */}
        <WindowCard title="REWARD.EXE" titleBarColor="#A78BFA" bodyClassName="flex flex-col gap-3.5">
          <div className="dark-grid-surface bg-[#111] border-[2.5px] border-[#111] rounded-xl p-4 flex flex-col gap-2 text-white shadow-hard-sm">
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono-bold text-[10px] uppercase tracking-widest text-white/60">Reward Payout</span>
              <span className="font-mono-bold text-[9px] uppercase tracking-widest px-2 py-0.5 rounded-full bg-[#FFE600] text-[#111] border-[1.5px] border-[#111]">
                FIXED PER WINNER
              </span>
            </div>
            <div className="flex items-center gap-2.5 pt-0.5">
              <div className="w-9 h-9 rounded-lg bg-[#FFE600] border-[2px] border-[#111] flex items-center justify-center shrink-0">
                <CoinIcon size={24} />
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="font-heading text-[28px] font-extrabold tabular-nums text-[#FFE600] leading-none">{formatUsdc(bounty.rewardPerWinner)}</span>
                <span className="font-mono-bold text-[12px] uppercase tracking-wider text-white/80">USDC</span>
              </div>
            </div>
          </div>

          {isPoster ? (
            <PillButton onClick={() => document.getElementById('submissions-list')?.scrollIntoView({ behavior: 'smooth', block: 'start' })} variant="lime">
              View submissions →
            </PillButton>
          ) : status === 'OPEN' ? (
            <PillButton onClick={() => document.getElementById('work-area')?.scrollIntoView({ behavior: 'smooth', block: 'start' })} variant="yellow">
              Start working →
            </PillButton>
          ) : null}

          <div className="flex items-start gap-2.5 border-[2px] border-[#111] rounded-xl p-3 bg-[#C6F23A]/30 shadow-hard-xs">
            <div className="w-6 h-6 rounded-md bg-[#C6F23A] border-[1.5px] border-[#111] flex items-center justify-center shrink-0 mt-0.5">
              <LockIcon size={13} className="shrink-0 text-[#111]" />
            </div>
            <p className="font-mono-ui text-[11px] leading-snug text-[#111]/80">
              <strong className="font-mono-bold text-[#111]">Escrow Guaranteed.</strong> Smart contract releases USDC immediately on approval.
            </p>
          </div>
        </WindowCard>

        {/* Creator card */}
        <PosterCard poster={bounty.poster} />

        {/* Requirements card — shows ONLY what the creator chose */}
        <WindowCard title="REQUIREMENTS.EXE" titleBarColor="#7FF3F0" bodyClassName="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="font-mono-bold text-[10px] uppercase tracking-widest text-[#111]/60">
              Hunter Requirements
            </span>
            <span className="font-mono-bold text-[9px] uppercase tracking-widest px-2 py-0.5 rounded-full bg-[#7FF3F0] border-[1.5px] border-[#111] text-[#111]">
              VERIFIED GATE
            </span>
          </div>

          <div className="flex flex-col gap-2.5">
            {bountyRequirements?.require_social && (
              <div className="flex items-start gap-2.5 border-[2px] border-[#111] rounded-xl p-3 bg-white shadow-hard-xs">
                <div className="w-6 h-6 rounded-md bg-[#111] flex items-center justify-center text-white shrink-0 mt-0.5">
                  <XIcon size={12} />
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="font-mono-bold text-[11px] uppercase tracking-wider text-[#111]">
                    Connected Social Account
                  </span>
                  <span className="font-mono-ui text-[11px] leading-snug text-[#111]/70">
                    Hunters must link a Twitter/X or GitHub profile on WANT.fun to submit.
                  </span>
                </div>
              </div>
            )}

            {bountyRequirements?.min_account_age_days ? (
              <div className="flex items-start gap-2.5 border-[2px] border-[#111] rounded-xl p-3 bg-white shadow-hard-xs">
                <div className="w-6 h-6 rounded-md bg-[#FFE600] border-[1.5px] border-[#111] flex items-center justify-center text-[#111] shrink-0 mt-0.5">
                  <ClockIcon size={13} className="shrink-0 text-[#111]" />
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="font-mono-bold text-[11px] uppercase tracking-wider text-[#111]">
                    Minimum Account Age: {bountyRequirements.min_account_age_days} Day{bountyRequirements.min_account_age_days === 1 ? '' : 's'}
                  </span>
                  <span className="font-mono-ui text-[11px] leading-snug text-[#111]/70">
                    Must have joined WANT.fun at least {bountyRequirements.min_account_age_days} day{bountyRequirements.min_account_age_days === 1 ? '' : 's'} ago.
                  </span>
                </div>
              </div>
            ) : null}

            {bountyRequirements?.min_onchain_tx && (
              <div className="flex items-start gap-2.5 border-[2px] border-[#111] rounded-xl p-3 bg-white shadow-hard-xs">
                <div className="w-6 h-6 rounded-md bg-[#A78BFA] border-[1.5px] border-[#111] flex items-center justify-center text-[#111] shrink-0 mt-0.5">
                  <WalletIcon size={13} className="shrink-0 text-[#111]" />
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="font-mono-bold text-[11px] uppercase tracking-wider text-[#111]">
                    Active Onchain History
                  </span>
                  <span className="font-mono-ui text-[11px] leading-snug text-[#111]/70">
                    Wallet must have prior transaction activity on Arc (empty burner wallets rejected).
                  </span>
                </div>
              </div>
            )}

            {!bountyRequirements?.require_social &&
             !bountyRequirements?.min_account_age_days &&
             !bountyRequirements?.min_onchain_tx && (
              <div className="flex items-start gap-2.5 border-[2px] border-[#111] rounded-xl p-3 bg-white shadow-hard-xs">
                <div className="w-6 h-6 rounded-md bg-[#C6F23A] border-[1.5px] border-[#111] flex items-center justify-center text-[#111] shrink-0 mt-0.5">
                  <CheckCircleIcon size={14} className="shrink-0 text-[#111]" />
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="font-mono-bold text-[11px] uppercase tracking-wider text-[#111]">
                    Open to All Hunters
                  </span>
                  <span className="font-mono-ui text-[11px] leading-snug text-[#111]/70">
                    No special gating restrictions. Any connected wallet can submit proof of work.
                  </span>
                </div>
              </div>
            )}

            <div className="border-[2px] border-[#111] rounded-xl px-3 py-2 bg-[#111] flex items-center justify-between text-white font-mono-bold text-[10px] uppercase tracking-wider">
              <span className="text-white/80">1 Entry / Wallet</span>
              <span className="text-[#C6F23A]">Free &amp; Gasless</span>
            </div>

            {examples.length > 0 && (
              <div className="flex items-start gap-2.5 border-[2px] border-[#111] rounded-xl p-3 bg-[#FFE600]/20 shadow-hard-xs">
                <span className="mt-0.5 shrink-0 inline-flex items-center justify-center w-6 h-6 rounded-md border-[1.5px] border-[#111] bg-[#FFE600]">
                  <AttachmentIcon />
                </span>
                <div className="flex flex-col gap-0.5">
                  <span className="font-mono-bold text-[11px] uppercase tracking-wider text-[#111]">Reference Files</span>
                  <button
                    type="button"
                    onClick={() => setShowAttachments(true)}
                    className="font-mono-bold text-[11px] text-[#1A1AE6] underline text-left hover:text-[#111] transition-colors cursor-pointer"
                  >
                    View {examples.length} reference attachment{examples.length === 1 ? '' : 's'} →
                  </button>
                </div>
              </div>
            )}
          </div>
        </WindowCard>
      </div>
      </div>

      {/* Attachments modal */}
      {showAttachments && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(17,17,17,0.75)' }}
          onClick={() => setShowAttachments(false)}
        >
          <div
            className="relative w-full max-w-lg max-h-[85vh] flex flex-col border-[3px] border-[#111] rounded-2xl overflow-hidden shadow-hard-lg"
            onClick={e => e.stopPropagation()}
          >
            {/* Title bar */}
            <div className="flex items-center justify-between px-4 py-2 border-b-[3px] border-[#111]" style={{ backgroundColor: '#A78BFA' }}>
              <span className="font-mono-bold text-[11px] uppercase tracking-widest text-[#111]">
                ATTACHMENTS.EXE ({examples.length})
              </span>
              <button
                onClick={() => setShowAttachments(false)}
                className="w-6 h-6 rounded-full border-[2px] border-[#111] bg-[#FF3E9A] flex items-center justify-center font-mono-bold text-[12px] text-white leading-none cursor-pointer"
                aria-label="Close"
              >×</button>
            </div>

            {/* Grid of files */}
            <div className="overflow-y-auto bg-[#FFFDF0] p-4">
              <div className="grid grid-cols-2 gap-3">
                {examples.map((ex, idx) => (
                  <div
                    key={idx}
                    className="border-[2px] border-[#111] rounded-xl overflow-hidden bg-white shadow-hard-xs"
                  >
                    {ex.content.startsWith('data:video') ? (
                      // eslint-disable-next-line jsx-a11y/media-has-caption
                      <video
                        src={ex.content}
                        controls
                        className="w-full max-h-48 object-contain bg-black"
                      />
                    ) : (
                      <img
                        src={ex.content}
                        alt={`Attachment ${idx + 1}`}
                        className="w-full max-h-48 object-contain"
                      />                    )}
                    <div className="px-2 py-1 border-t-[2px] border-[#111] font-mono-ui text-[9px] uppercase tracking-widest text-[#111]/60">
                      File {idx + 1}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Off-chain SubmissionList ──────────────────────────────────────────────────

interface OffchainSubmissionListProps {
  submissions: OffchainSubmission[]
  bountyId: bigint
  isPoster: boolean
  isPublic: boolean
  loading: boolean
  rewardPerWinner: bigint
  afterReviewWindow: boolean
  approvalCutoff: number
  onApproved: () => void
  onToggleVisibility?: () => void
}

function formatTimeAgo(epochSec?: number): string {
  if (!epochSec) return ''
  const diff = Math.floor(Date.now() / 1000) - Number(epochSec)
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)}d ago`
  return new Date(epochSec * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function OffchainSubmissionList({
  submissions,
  bountyId,
  isPoster,
  isPublic,
  loading,
  rewardPerWinner,
  afterReviewWindow,
  onApproved,
  onToggleVisibility,
}: OffchainSubmissionListProps) {
  const isPrivateForViewer = !isPublic && !isPoster
  const title = loading
    ? 'SUBMISSIONS.EXE'
    : isPrivateForViewer
      ? 'SUBMISSIONS.EXE (PRIVATE)'
      : `SUBMISSIONS.EXE (${submissions.length})`

  const [query, setQuery] = useState('')
  const [newestFirst, setNewestFirst] = useState(true)
  const q = query.trim().toLowerCase()
  const shown = submissions
    .filter(s => !q || s.submitter.toLowerCase().includes(q))
    .slice()
    .sort((a, b) => (newestFirst ? (b.created_at ?? 0) - (a.created_at ?? 0) : (a.created_at ?? 0) - (b.created_at ?? 0)))

  return (
    <WindowCard title={title} titleBarColor={isPrivateForViewer ? '#CCCCCC' : '#7FF3F0'}>
      {/* Comment Section Header Toolbar */}
      <div className="flex items-center justify-between pb-3 mb-3 border-b-[2px] border-[#111]/15 gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-[#10B981] border border-[#111] animate-pulse" />
          <span className="font-mono-bold text-[11px] uppercase tracking-wider text-[#111]">
            {submissions.length} {submissions.length === 1 ? 'Submission' : 'Submissions'}
          </span>
          {submissions.length > 0 && (
            <span className="font-mono-ui text-[10px] text-[#111]/50 hidden sm:inline">
              · Scroll feed
            </span>
          )}
        </div>

        {/* Visibility toggle (creator only) */}
        {isPoster && onToggleVisibility && (
          <div className="flex items-center gap-2 ml-auto">
            <span className="font-mono-ui text-[10px] text-[#111]/70 hidden sm:inline">
              Visibility: <strong>{isPublic ? 'Public' : 'Private'}</strong>
            </span>
            <button
              onClick={onToggleVisibility}
              className="font-mono-bold text-[10px] uppercase tracking-wider border-[2px] border-[#111] rounded-full px-3 py-1 transition-colors btn-press shadow-hard-xs cursor-pointer"
              style={{
                backgroundColor: isPublic ? '#1A1AE6' : '#FFFDF0',
                color: isPublic ? '#fff' : '#111',
              }}
            >
              {isPublic ? 'Make private' : 'Make public'}
            </button>
          </div>
        )}
      </div>

      {loading ? (
        <div className="py-12 flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-[3px] border-[#111]/20 border-t-[#A3E635] rounded-full animate-spin" />
          <span className="font-mono-bold text-[11px] uppercase tracking-widest text-[#111]/50">Loading submissions…</span>
        </div>
      ) : isPrivateForViewer ? (
        <div className="checkerboard rounded-xl py-10 flex flex-col items-center gap-3 text-center px-4 border-[2px] border-[#111]">
          <LockIcon size={36} />
          <div className="font-mono-bold text-[12px] uppercase tracking-widest text-[#111]">
            The submissions for this bounty are private
          </div>
          <p className="font-mono-ui text-[11px] text-[#111]/70 max-w-sm">
            Only the bounty creator can view submissions for this bounty.
          </p>
        </div>
      ) : submissions.length === 0 ? (
        <div className="checkerboard rounded-xl py-10 flex flex-col items-center gap-3 text-center px-4 border-[2px] border-[#111]">
          <FolderIcon size={36} />
          <div className="font-mono-bold text-[12px] uppercase tracking-widest text-[#111]/70">No submissions yet</div>
          <p className="font-mono-ui text-[11px] text-[#111]/70 max-w-xs">
            Be the first hunter to submit proof of work and claim the bounty!
          </p>
        </div>
      ) : (
        <>
          {/* Search + sort (shown once the feed gets long) */}
          {submissions.length > 3 && (
            <div className="flex items-center gap-2 mb-3">
              <input
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Search by wallet address…"
                className="flex-1 min-w-0 input-neo rounded-full px-3.5 py-1.5 font-mono-ui text-[12px]"
              />
              <button
                type="button"
                onClick={() => setNewestFirst(v => !v)}
                className="shrink-0 font-mono-bold text-[10px] uppercase tracking-wider border-[2px] border-[#111] rounded-full px-3 py-1.5 bg-white hover:bg-[#FFE600] shadow-hard-xs transition-colors btn-press cursor-pointer"
              >
                {newestFirst ? 'Newest ↓' : 'Oldest ↑'}
              </button>
            </div>
          )}

          {shown.length === 0 ? (
            <div className="py-8 text-center font-mono-ui text-[12px] text-[#111]/60">No submissions match “{query}”.</div>
          ) : (
            /* Self-contained scrollable comment stream */
            <div className="max-h-[520px] sm:max-h-[580px] overflow-y-auto overscroll-contain submissions-scroll pr-1.5 pb-7 flex flex-col gap-3.5">
              {shown.map(sub => (
                <SingleOffchainSubmission
                  key={sub.id}
                  sub={sub}
                  bountyId={bountyId}
                  isPoster={isPoster}
                  rewardPerWinner={rewardPerWinner}
                  canApprove={!afterReviewWindow}
                  onApproved={onApproved}
                />
              ))}
            </div>
          )}
        </>
      )}
    </WindowCard>
  )
}

interface SingleOffchainSubmissionProps {
  sub: OffchainSubmission
  bountyId: bigint
  isPoster: boolean
  rewardPerWinner: bigint
  canApprove: boolean
  onApproved: () => void
}

function SingleOffchainSubmission({ sub, bountyId, isPoster, rewardPerWinner, canApprove, onApproved }: SingleOffchainSubmissionProps) {
  const { chainId, address } = useAccount()
  const { switchChain } = useSwitchChain()
  const isWrongChain = chainId !== CHAIN_ID
  const [expanded, setExpanded] = useState(false)
  const bodyRef = useRef<HTMLDivElement>(null)
  const [bodyOpen, setBodyOpen] = useState(false)
  const [bodyOverflowing, setBodyOverflowing] = useState(false)
  const hasMedia = /data:(image|video)\/|\.(png|jpe?g|gif|webp|svg)|youtu/i.test(sub.content)

  useEffect(() => {
    const el = bodyRef.current
    if (el && !hasMedia) setBodyOverflowing(el.scrollHeight > 220)
  }, [sub.content, hasMedia])

  const { data: winnerStatus } = useReadContract({
    address: CONTRACT_ADDRESS, abi: BOUNTY_BOARD_ABI, functionName: 'payoutStatus',
    args: [bountyId, sub.submitter as `0x${string}`], chainId: CHAIN_ID,
  }) as { data: number | undefined }

  const { writeContract: approve, data: approveHash, isPending: approvePending, error: approveErr } = useWriteContract()
  const { isLoading: approveConfirming, isSuccess: approveSuccess } = useWaitForTransactionReceipt({ hash: approveHash })

  function handleApprove() {
    if (isWrongChain) { switchChain({ chainId: CHAIN_ID }); return }
    approve(
      { address: CONTRACT_ADDRESS, abi: BOUNTY_BOARD_ABI, functionName: 'approveWinner', args: [bountyId, sub.submitter as `0x${string}`], chainId: CHAIN_ID },
      {
        onSuccess: () => { toast.success('Winner approved & paid!'); onApproved() },
        onError: (err) => toast.error(parseOnchainError(err)),
      }
    )
  }

  const isPending = winnerStatus === 1
  const isPaid = winnerStatus === 2
  const isWinner = (winnerStatus ?? 0) > 0
  const isOwnSub = !!address && address.toLowerCase() === sub.submitter.toLowerCase()
  const canExpand = isPoster || isOwnSub

  // Short address display
  const shortAddr = `${sub.submitter.slice(0, 6)}…${sub.submitter.slice(-4)}`

  return (
    <>
      <div className={`border-[2.5px] border-[#111] rounded-2xl p-3.5 shadow-hard-sm transition-all duration-150 hover:shadow-[5px_5px_0_#111] ${isWinner ? 'bg-[#C6F23A]/20' : 'bg-white'}`}>
        {/* Author / Comment Row with Avatar */}
        <div className="flex items-start gap-3">
          <a
            href={`#/profile/${sub.submitter}`}
            className="border-[2px] border-[#111] rounded-xl overflow-hidden shrink-0 shadow-hard-xs mt-0.5 bg-[#FFFDF0] hover:scale-105 transition-transform"
          >
            <PixelAvatar address={sub.submitter} size={36} />
          </a>

          <div className="flex-1 min-w-0">
            {/* Header info */}
            <div className="flex items-center justify-between gap-2 flex-wrap mb-1.5">
              <div className="flex items-center gap-2 flex-wrap min-w-0">
                <a
                  href={`#/profile/${sub.submitter}`}
                  className="font-heading font-black text-[13px] text-[#111] hover:text-[#1A1AE6] hover:underline truncate"
                >
                  {shortAddr}
                </a>
                {isOwnSub && (
                  <span className="font-mono-bold text-[8.5px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#FFE600] text-[#111] border-[1.5px] border-[#111]">
                    You
                  </span>
                )}
                {sub.created_at && (
                  <span className="font-mono-ui text-[10px] text-[#111]/60">
                    {formatTimeAgo(Number(sub.created_at))}
                  </span>
                )}
                <span className="font-mono-bold text-[9px] text-[#111]/45 bg-[#111]/5 px-1.5 py-0.5 rounded border border-[#111]/15">
                  #{String(sub.id).padStart(2, '0')}
                </span>
              </div>

              {/* Badges & Actions */}
              <div className="flex items-center gap-1.5 shrink-0">
                {isPaid && (
                  <span className="font-mono-bold text-[9px] uppercase bg-[#C6F23A] border-[2px] border-[#111] px-2.5 py-0.5 rounded-full text-[#111] shadow-hard-xs">
                    ✓ Paid {formatUsdc(rewardPerWinner)} USDC
                  </span>
                )}
                {isPending && (
                  <span className="font-mono-bold text-[9px] uppercase bg-[#FFE600] border-[2px] border-[#111] px-2.5 py-0.5 rounded-full text-[#111] shadow-hard-xs">
                    Payout pending
                  </span>
                )}
                {!isWinner && isPoster && canApprove && (
                  <PillButton size="sm" variant="lime" onClick={handleApprove} loading={approvePending || approveConfirming} disabled={approveSuccess} showArrow={false}>
                    Approve &amp; pay →
                  </PillButton>
                )}
                {canExpand && (
                  <button
                    onClick={() => setExpanded(true)}
                    className="w-7 h-7 rounded-lg border-[2px] border-[#111] bg-white hover:bg-[#FFE600] flex items-center justify-center font-mono-bold text-[12px] text-[#111] transition-colors shadow-hard-xs cursor-pointer"
                    aria-label="Expand submission"
                    title="View full submission"
                  >
                    ⤢
                  </button>
                )}
              </div>
            </div>

            {/* Content body — long text is clamped with a Show more toggle */}
            <div
              ref={bodyRef}
              className={`text-[#111]/90 pt-0.5 relative ${!bodyOpen && bodyOverflowing ? 'max-h-[200px] overflow-hidden' : ''}`}
            >
              <SubmissionViewer content={sub.content} />
              {!bodyOpen && bodyOverflowing && (
                <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-white to-transparent pointer-events-none" />
              )}
            </div>
            {bodyOverflowing && (
              <button
                type="button"
                onClick={() => setBodyOpen(v => !v)}
                className="mt-1.5 font-mono-bold text-[10px] uppercase tracking-wider text-[#1A1AE6] hover:underline cursor-pointer"
              >
                {bodyOpen ? 'Show less ↑' : 'Show more ↓'}
              </button>
            )}

            {(approvePending || approveConfirming || approveSuccess || approveErr) && (
              <div className="mt-2.5">
                <TxStatus hash={approveHash} isPending={approvePending} isConfirming={approveConfirming} isSuccess={approveSuccess} isError={!!approveErr} error={approveErr ? parseOnchainError(approveErr) : undefined} successMessage="Winner approved & paid!" />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Expanded full-view modal */}
      {expanded && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(17,17,17,0.75)' }}
          onClick={() => setExpanded(false)}
        >
          <div
            className="relative w-full max-w-lg max-h-[85vh] flex flex-col border-[3px] border-[#111] rounded-2xl overflow-hidden bg-white shadow-hard-lg"
            onClick={e => e.stopPropagation()}
          >
            {/* Title bar */}
            <div className="flex items-center justify-between px-4 py-2 border-b-[3px] border-[#111] shrink-0" style={{ backgroundColor: isWinner ? '#C6F23A' : '#7FF3F0' }}>
              <span className="font-mono-bold text-[11px] uppercase tracking-widest text-[#111]">
                SUB_{String(sub.id).padStart(3, '0')}.EXE — {shortAddr}
              </span>
              <button
                onClick={() => setExpanded(false)}
                className="w-6 h-6 rounded-full border-[2px] border-[#111] bg-[#FF3E9A] flex items-center justify-center font-mono-bold text-[12px] text-white leading-none cursor-pointer"
                aria-label="Close"
              >×</button>
            </div>

            {/* Scrollable body */}
            <div className="overflow-y-auto p-4 flex flex-col gap-3">
              {/* Status badges */}
              {(isPaid || isPending || isWinner) && (
                <div className="flex gap-2 flex-wrap">
                  {isPaid && <span className="font-mono-bold text-[10px] uppercase bg-[#C6F23A] border-2 border-[#111] px-2 py-0.5 rounded-full">PAID {formatUsdc(rewardPerWinner)} USDC</span>}
                  {isPending && <span className="font-mono-bold text-[10px] uppercase bg-[#FFE600] border-2 border-[#111] px-2 py-0.5 rounded-full">PAYOUT PENDING</span>}
                </div>
              )}

              {/* Full content */}
              <SubmissionViewer content={sub.content} />

              {/* Approve button inside modal (poster only) */}
              {!isWinner && isPoster && canApprove && (
                <div className="pt-2 border-t-[2px] border-[#111]/20 flex flex-col gap-2">
                  <TxStatus hash={approveHash} isPending={approvePending} isConfirming={approveConfirming} isSuccess={approveSuccess} isError={!!approveErr} error={approveErr ? parseOnchainError(approveErr) : undefined} successMessage="Winner approved & paid!" />
                  <PillButton variant="lime" onClick={handleApprove} loading={approvePending || approveConfirming} disabled={approveSuccess} showArrow={false}>
                    Approve &amp; pay →
                  </PillButton>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}

// ── Posted-by sidebar card ──────────────────────────────────────────────────
function PosterCard({ poster }: { poster: string }) {
  const [profile, setProfile] = useState<OffchainProfile>({ bio: '', avatar_variant: 0 })

  useEffect(() => {
    let cancelled = false
    fetchProfile(poster).then(p => { if (!cancelled) setProfile(p) })
    return () => { cancelled = true }
  }, [poster])

  const { data: postedIds } = useReadContract({
    address: CONTRACT_ADDRESS, abi: BOUNTY_BOARD_ABI, functionName: 'getBountiesByPoster',
    args: [poster as `0x${string}`], chainId: CHAIN_ID,
  }) as { data: readonly bigint[] | undefined }

  const shortAddr = `${poster.slice(0, 6)}…${poster.slice(-4)}`

  return (
    <WindowCard title="CREATOR.EXE" titleBarColor="#FF3E9A" bodyClassName="flex flex-col gap-0 !p-0">
      <div className="checkerboard p-3.5 border-b-[2.5px] border-[#111]">
        <a
          href={`#/profile/${poster}`}
          className="group flex items-center gap-3 p-2.5 bg-white border-[2.5px] border-[#111] rounded-xl shadow-hard-xs hover:translate-x-[-1px] hover:translate-y-[-1px] transition-transform"
        >
          <div className="border-[2px] border-[#111] rounded-xl overflow-hidden shrink-0 shadow-hard-xs bg-[#FFFDF0]">
            <PixelAvatar address={poster} size={46} variant={profile.avatar_variant} />
          </div>
          <div className="flex flex-col min-w-0 flex-1">
            <span className="font-heading text-[15px] font-extrabold text-[#111] group-hover:text-[#1A1AE6] truncate">
              {shortAddr}
            </span>
            <span className="font-mono-bold text-[10px] uppercase tracking-wider text-[#111]/60">
              {(postedIds?.length ?? 0)} bount{(postedIds?.length ?? 0) === 1 ? 'y' : 'ies'} created
            </span>
          </div>
          <span className="w-7 h-7 rounded-full bg-[#FFE600] border-[2px] border-[#111] flex items-center justify-center font-mono-bold text-[11px] text-[#111] group-hover:translate-x-0.5 transition-transform">
            →
          </span>
        </a>
      </div>
      <div className="p-3.5 flex flex-col gap-3">
        {profile.bio && (
          <p className="font-mono-ui text-[11px] font-bold text-[#111] bg-white border-[2px] border-[#111] rounded-xl px-3 py-2 leading-snug shadow-hard-xs">
            {profile.bio}
          </p>
        )}
        <div className="flex items-center justify-between gap-2">
          <span className="font-mono-bold text-[9px] uppercase tracking-widest border-[2px] border-[#111] rounded-full px-2.5 py-0.5 bg-[#FF3E9A] text-white shadow-hard-xs">
            WANT CREATOR
          </span>
          <a
            href={`#/profile/${poster}`}
            className="inline-flex items-center gap-1 font-mono-bold text-[10px] uppercase tracking-wider text-[#111] bg-[#FFE600] hover:bg-[#111] hover:text-[#FFE600] border-[2px] border-[#111] rounded-full px-3 py-1 shadow-hard-xs transition-colors"
          >
            <span>Creator Profile</span>
            <span>↗</span>
          </a>
        </div>
      </div>
    </WindowCard>
  )
}

function UploadIcon() {
  return (
    <svg width={28} height={28} viewBox="0 0 24 24" fill="none">
      <path d="M12 16V8M12 8l-3 3M12 8l3 3" stroke="#A78BFA" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="3" y="16" width="18" height="5" rx="2" fill="#A78BFA" stroke="#111" strokeWidth="1.5" />
    </svg>
  )
}

function AttachmentIcon() {
  return (
    <svg width={12} height={12} viewBox="0 0 24 24" fill="none">
      <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66L9.41 17.41a2 2 0 01-2.83-2.83l8.49-8.48" stroke="#111" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
