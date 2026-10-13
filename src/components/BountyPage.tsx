import React, { useState, useEffect, useRef } from 'react'
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt, useSwitchChain } from 'wagmi'
import { toast } from 'sonner'
import { WindowCard } from './WindowCard'
import { PillButton } from './PillButton'
import { StatusTag } from './StatusTag'
import { LoadingBar } from './LoadingBar'
import { TxStatus } from './TxStatus'
import { SubmissionViewer } from './SubmissionViewer'
import { ClockIcon, TrophyIcon, LockIcon, CoinIcon, FolderIcon } from './Icons'
import { BOUNTY_BOARD_ABI } from '../bounty-abi'
import { CHAIN_ID, CONTRACT_ADDRESS } from '../bounty-config'
import { barColor, formatUsdc, formatAddress, timeLeft, bountyStatus, parseOnchainError } from '../lib/utils'
import { BountyData } from './BountyCard'
import {
  registerBounty,
  fetchSubmissions,
  postSubmission,
  setVisibility,
  type OffchainSubmission,
} from '../lib/submissions-api'

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

export function BountyPage({ bountyId, onBack, onDataChange }: BountyPageProps) {
  const { address, chainId } = useAccount()
  const { switchChain } = useSwitchChain()
  const [submissionText, setSubmissionText] = useState('')
  const [submitMode, setSubmitMode] = useState<'text' | 'file'>('text')
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploadPreview, setUploadPreview] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const isWrongChain = chainId !== CHAIN_ID

  // Off-chain submission state
  const [offchainSubs, setOffchainSubs] = useState<OffchainSubmission[]>([])
  const [isPublic, setIsPublic] = useState(false)
  const [subsLoading, setSubsLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  const { data: bounty, refetch: refetchBounty } = useReadContract({
    address: CONTRACT_ADDRESS, abi: BOUNTY_BOARD_ABI, functionName: 'getBounty',
    args: [bountyId], chainId: CHAIN_ID,
  }) as { data: BountyData | undefined; refetch: () => void }

  const { data: userPayoutStatus, refetch: refetchPayoutStatus } = useReadContract({
    address: CONTRACT_ADDRESS, abi: BOUNTY_BOARD_ABI, functionName: 'payoutStatus',
    args: [bountyId, address ?? '0x0000000000000000000000000000000000000000'],
    chainId: CHAIN_ID, query: { enabled: !!address },
  }) as { data: number | undefined; refetch: () => void }

  const { data: reviewWindowRaw } = useReadContract({
    address: CONTRACT_ADDRESS, abi: BOUNTY_BOARD_ABI, functionName: 'reviewWindow',
    chainId: CHAIN_ID,
  }) as { data: number | undefined }

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
    } catch {
      // silently ignore — the onchain path is the fallback
    } finally {
      setSubsLoading(false)
    }
  }

  // Register bounty + load subs when bounty data arrives
  useEffect(() => {
    if (!bounty) return
    void registerBounty(bountyId.toString()).then(() => loadSubs())
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

    let content: string
    if (submitMode === 'file') {
      if (!uploadPreview) { toast.error('Please select a file first.'); return }
      content = uploadPreview
    } else {
      if (!submissionText.trim()) { toast.error('Please write your submission first.'); return }
      if (submissionText.length > 1000) { toast.error('Submission is too long (max 1000 chars).'); return }
      content = submissionText.trim()
    }

    setSubmitting(true)
    try {
      const result = await postSubmission(bountyId.toString(), address, content)
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
    try {
      await setVisibility(bountyId.toString(), next)
      setIsPublic(next)
      toast.success(next ? 'Submissions are now public.' : 'Submissions are now private.')
    } catch {
      toast.error('Failed to update visibility.')
    }
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

  return (
    <div className="flex flex-col gap-5 max-w-2xl mx-auto">
      <button onClick={onBack} className="font-mono-bold text-[12px] uppercase tracking-widest text-[#1A1AE6] hover:underline self-start">← Back to wall</button>

      {/* Main bounty window */}
      <WindowCard title={`BOUNTY_${String(idNum).padStart(3, '0')}.EXE`} titleBarColor={barColor(idNum)} bodyClassName="flex flex-col gap-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <StatusTag status={status} />
          <div className="flex items-center gap-1.5 text-[#111]/60">
            <ClockIcon size={13} />
            <span className="font-mono-bold text-[10px] uppercase tracking-wider">{timeLeft(bounty.deadline)}</span>
          </div>
        </div>

        <h1 className="font-heading text-[26px] font-extrabold leading-tight text-[#111]">{titleStr}</h1>
        <p className="font-body text-[14px] leading-relaxed text-[#111]/80 whitespace-pre-wrap">{descStr}</p>

        {/* Stats grid */}
        <div className="grid grid-cols-3 gap-3">
          <div className="border-[3px] border-[#111] rounded-lg p-3 bg-[#FFE600]/30 flex flex-col gap-1">
            <CoinIcon size={14} />
            <div className="font-heading text-[20px] font-extrabold tabular-nums">{formatUsdc(bounty.rewardPerWinner)}</div>
            <div className="font-mono-ui text-[10px] uppercase tracking-wider text-[#111]/60">USDC / winner</div>
          </div>
          <div className="border-[3px] border-[#111] rounded-lg p-3 bg-[#7FF3F0]/30 flex flex-col gap-1">
            <TrophyIcon size={14} />
            <div className="font-heading text-[20px] font-extrabold tabular-nums">{bounty.winnersApproved.toString()}/{bounty.maxWinners.toString()}</div>
            <div className="font-mono-ui text-[10px] uppercase tracking-wider text-[#111]/60">Winners</div>
          </div>
          <div className="border-[3px] border-[#111] rounded-lg p-3 bg-[#C6F23A]/30 flex flex-col gap-1">
            <FolderIcon size={14} />
            <div className="font-heading text-[20px] font-extrabold tabular-nums">{offchainSubs.length}</div>
            <div className="font-mono-ui text-[10px] uppercase tracking-wider text-[#111]/60">Submissions</div>
          </div>
        </div>

        {/* Escrow panel */}
        <div className="border-[3px] border-[#111] rounded-lg p-3 bg-[#C6F23A]/20 flex flex-col gap-1.5">
          <div className="flex items-center gap-1.5">
            <LockIcon size={14} className="text-[#111]" />
            <span className="font-mono-bold text-[11px] uppercase tracking-widest text-[#111]">Escrow</span>
          </div>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex flex-col">
              <span className="font-mono-bold text-[10px] uppercase text-[#111]/50">Locked</span>
              <span className="font-heading text-[18px] font-extrabold tabular-nums text-[#111]">{formatUsdc(bounty.escrowRemaining)} USDC</span>
            </div>
            <div className="flex flex-col">
              <span className="font-mono-bold text-[10px] uppercase text-[#111]/50">Paid out</span>
              <span className="font-heading text-[18px] font-extrabold tabular-nums text-[#111]">{formatUsdc(paidOut)} USDC</span>
            </div>
          </div>
        </div>

        <LoadingBar current={Number(bounty.winnersApproved)} max={Number(bounty.maxWinners)} label={`Winners ${bounty.winnersApproved}/${bounty.maxWinners}`} color="#FF3E9A" />

        <div className="font-mono-ui text-[11px] text-[#111]/50">
          Posted by <span className="text-[#1A1AE6]">{formatAddress(bounty.poster)}</span>
        </div>
      </WindowCard>

      {/* Pending payout — winner can claim */}
      {userPayoutStatus === PAYOUT_PENDING && (
        <WindowCard title="CLAIM_REWARD.EXE" titleBarColor="#C6F23A">
          <div className="flex flex-col gap-3">
            <div className="font-heading text-[22px] font-extrabold text-[#111]">You have a pending payout!</div>
            <div className="font-body text-[14px] text-[#111]/70">The automatic transfer failed (e.g. address blocklisted). Claim your reward manually.</div>
            <TxStatus hash={claimHash} isPending={claimPending} isConfirming={claimConfirming} isSuccess={claimSuccess} isError={!!claimErr} error={claimErr ? parseOnchainError(claimErr) : undefined} successMessage="Payout claimed!" />
            {!claimSuccess && <PillButton onClick={handleClaim} loading={claimPending || claimConfirming} variant="lime">Claim {formatUsdc(bounty.rewardPerWinner)} USDC →</PillButton>}
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
            <div className="font-mono-ui text-[11px] text-[#111]/60 border-2 border-[#111] rounded-lg p-2 bg-[#C6F23A]/20">
              <strong>Free submission</strong> — no gas, stored off-chain.
            </div>

            {/* Mode toggle */}
            <div className="flex gap-0 border-[2px] border-[#111] rounded-lg overflow-hidden w-fit">
              <button
                onClick={() => setSubmitMode('text')}
                className="px-4 py-2 font-mono-bold text-[11px] uppercase tracking-widest text-[#111] border-r-[2px] border-[#111] transition-colors"
                style={{ backgroundColor: submitMode === 'text' ? '#A78BFA' : '#FFFDF0' }}
              >
                ✏️ Text / Link
              </button>
              <button
                onClick={() => setSubmitMode('file')}
                className="px-4 py-2 font-mono-bold text-[11px] uppercase tracking-widest text-[#111] transition-colors"
                style={{ backgroundColor: submitMode === 'file' ? '#A78BFA' : '#FFFDF0' }}
              >
                📎 Upload File
              </button>
            </div>

            {/* Text/link input */}
            {submitMode === 'text' && (
              <>
                <textarea
                  value={submissionText}
                  onChange={e => setSubmissionText(e.target.value)}
                  placeholder="Paste a link, YouTube URL, or describe your work..."
                  rows={5}
                  className="border-[3px] border-[#111] rounded-lg px-3 py-2.5 text-[15px] font-body bg-white focus:outline-none focus:bg-[#FFFDF0] w-full resize-none"
                />
                <div className={`font-mono-ui text-[10px] text-right ${submissionText.length > 1000 ? 'text-[#FF6B57]' : 'text-[#111]/40'}`}>
                  {submissionText.length}/1000
                </div>
              </>
            )}

            {/* File upload input */}
            {submitMode === 'file' && (
              <div className="flex flex-col gap-2">
                {/* Drop zone / picker */}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="border-[3px] border-dashed border-[#111] rounded-lg p-6 flex flex-col items-center gap-2 bg-[#FFFDF0] hover:bg-[#A78BFA]/10 transition-colors cursor-pointer"
                >
                  <UploadIcon />
                  <span className="font-mono-bold text-[11px] uppercase tracking-widest text-[#111]/60">
                    {uploadFile ? uploadFile.name : 'Tap to choose image or video'}
                  </span>
                  <span className="font-mono-ui text-[10px] text-[#111]/40">Max 3 MB · JPG, PNG, GIF, WEBP, MP4, MOV, WEBM</span>
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/gif,image/webp,video/mp4,video/quicktime,video/webm"
                  onChange={handleFileChange}
                  className="hidden"
                />

                {/* Preview */}
                {uploadPreview && (
                  <div className="relative border-[2px] border-[#111] rounded-lg overflow-hidden">
                    {uploadFile?.type.startsWith('video/') ? (
                      // eslint-disable-next-line jsx-a11y/media-has-caption
                      <video src={uploadPreview} controls className="w-full max-h-48 bg-black" />
                    ) : (
                      <img src={uploadPreview} alt="Preview" className="w-full max-h-48 object-contain bg-[#FFFDF0]" />
                    )}
                    <button
                      onClick={clearFile}
                      className="absolute top-2 right-2 bg-[#FF3E9A] border-[2px] border-[#111] rounded-full w-6 h-6 flex items-center justify-center font-mono-bold text-[11px] text-white shadow-hard-sm"
                    >
                      ×
                    </button>
                  </div>
                )}
              </div>
            )}

            <PillButton
              onClick={() => { void handleSubmit() }}
              loading={submitting}
              disabled={submitting || (submitMode === 'text' && submissionText.length > 1000) || (submitMode === 'file' && !uploadPreview)}
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
          <div className="font-mono-bold text-[12px] uppercase tracking-wider text-[#111]/70">You submitted to this bounty. Waiting for poster review.</div>
        </WindowCard>
      )}

      {/* Poster actions */}
      {isPoster && (
        <>
          {/* Reclaim after review window */}
          {afterReviewWindow && !bounty.reclaimedUnused && bounty.escrowRemaining > 0n && (
            <WindowCard title="RECLAIM_UNUSED.EXE" titleBarColor="#FF6B57">
              <div className="flex flex-col gap-3">
                <div className="font-body text-[14px] text-[#111]">Review window ended. Reclaim unclaimed prize slots ({formatUsdc(bounty.escrowRemaining)} USDC).</div>
                <TxStatus hash={reclaimHash} isPending={reclaimPending} isConfirming={reclaimConfirming} isSuccess={reclaimSuccess} isError={!!reclaimErr} error={reclaimErr ? parseOnchainError(reclaimErr) : undefined} successMessage="Escrow reclaimed!" />
                {!reclaimSuccess && <PillButton onClick={handleReclaim} loading={reclaimPending || reclaimConfirming} variant="pink">Reclaim unused prize →</PillButton>}
              </div>
            </WindowCard>
          )}

          {/* Cancel — only with 0 submissions */}
          {offchainSubs.length === 0 && !bounty.cancelled && (
            <WindowCard title="CANCEL_BOUNTY.EXE" titleBarColor="#CCCCCC">
              <div className="flex flex-col gap-3">
                <div className="font-body text-[14px] text-[#111]">No submissions yet. You can cancel and get your full escrow back.</div>
                <TxStatus hash={cancelHash} isPending={cancelPending} isConfirming={cancelConfirming} isSuccess={cancelSuccess} isError={!!cancelErr} error={cancelErr ? parseOnchainError(cancelErr) : undefined} successMessage="Bounty cancelled, escrow refunded." />
                {!cancelSuccess && <PillButton onClick={handleCancel} loading={cancelPending || cancelConfirming} variant="ink" showArrow={false}>Cancel bounty</PillButton>}
              </div>
            </WindowCard>
          )}
        </>
      )}

      {/* Submissions list */}
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
  const title = loading
    ? 'SUBMISSIONS.EXE'
    : `SUBMISSIONS.EXE (${submissions.length})`

  return (
    <WindowCard title={title} titleBarColor="#7FF3F0">
      {/* Visibility toggle (poster only) */}
      {isPoster && onToggleVisibility && (
        <div className="flex items-center justify-between mb-3 pb-3 border-b-[2px] border-[#111]/20">
          <span className="font-mono-bold text-[10px] uppercase tracking-widest text-[#111]/60">
            Submissions are <strong>{isPublic ? 'public' : 'private'}</strong>
          </span>
          <button
            onClick={onToggleVisibility}
            className="font-mono-bold text-[10px] uppercase tracking-widest border-[2px] border-[#111] rounded-full px-3 py-1 transition-colors btn-press"
            style={{ backgroundColor: isPublic ? '#C6F23A' : '#FFFDF0' }}
          >
            {isPublic ? 'Make private' : 'Make public'}
          </button>
        </div>
      )}

      {loading ? (
        <div className="py-8 flex justify-center">
          <span className="font-mono-bold text-[11px] uppercase tracking-widest text-[#111]/50 animate-pulse">Loading...</span>
        </div>
      ) : submissions.length === 0 ? (
        <div className="checkerboard rounded-lg py-10 flex flex-col items-center gap-3">
          <FolderIcon size={36} />
          <div className="font-mono-bold text-[12px] uppercase tracking-widest text-[#111]/50">No submissions yet</div>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {submissions.map(sub => (
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
  const { chainId } = useAccount()
  const { switchChain } = useSwitchChain()
  const isWrongChain = chainId !== CHAIN_ID

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

  // Short address display
  const shortAddr = `${sub.submitter.slice(0, 6)}…${sub.submitter.slice(-4)}`

  return (
    <div className={`border-[3px] border-[#111] rounded-lg p-3 ${isWinner ? 'bg-[#C6F23A]/20' : 'bg-white'}`}>
      <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
        <span className="font-mono-bold text-[10px] uppercase tracking-wider text-[#111]">
          SUB #{String(sub.id).padStart(2, '0')} — {shortAddr}
        </span>
        {isPaid && (
          <span className="font-mono-bold text-[10px] uppercase bg-[#C6F23A] border-2 border-[#111] px-2 py-0.5 rounded-full">PAID {formatUsdc(rewardPerWinner)} USDC</span>
        )}
        {isPending && (
          <span className="font-mono-bold text-[10px] uppercase bg-[#FFE600] border-2 border-[#111] px-2 py-0.5 rounded-full">PAYOUT PENDING</span>
        )}
        {!isWinner && isPoster && canApprove && (
          <PillButton size="sm" variant="lime" onClick={handleApprove} loading={approvePending || approveConfirming} disabled={approveSuccess} showArrow={false}>
            Approve &amp; pay →
          </PillButton>
        )}
      </div>

      {/* Rich submission viewer */}
      <SubmissionViewer content={sub.content} />

      {(approvePending || approveConfirming || approveSuccess || approveErr) && (
        <div className="mt-2">
          <TxStatus hash={approveHash} isPending={approvePending} isConfirming={approveConfirming} isSuccess={approveSuccess} isError={!!approveErr} error={approveErr ? parseOnchainError(approveErr) : undefined} successMessage="Winner approved & paid!" />
        </div>
      )}
    </div>
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
