import { useState } from 'react'
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt, useSwitchChain } from 'wagmi'
import { toast } from 'sonner'
import { WindowCard } from './WindowCard'
import { PillButton } from './PillButton'
import { StatusTag } from './StatusTag'
import { LoadingBar } from './LoadingBar'
import { TxStatus } from './TxStatus'
import { ClockIcon, TrophyIcon, LockIcon, CoinIcon, FolderIcon } from './Icons'
import { BOUNTY_BOARD_ABI } from '../bounty-abi'
import { CHAIN_ID, CONTRACT_ADDRESS } from '../bounty-config'
import { barColor, formatUsdc, formatAddress, timeLeft, bountyStatus, parseOnchainError, encodeText, decodeBytes } from '../lib/utils'
import { BountyData } from './BountyCard'

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
  const isWrongChain = chainId !== CHAIN_ID

  const { data: bounty, refetch: refetchBounty } = useReadContract({
    address: CONTRACT_ADDRESS, abi: BOUNTY_BOARD_ABI, functionName: 'getBounty',
    args: [bountyId], chainId: CHAIN_ID,
  }) as { data: BountyData | undefined; refetch: () => void }

  const { data: submissions, refetch: refetchSubs } = useReadContract({
    address: CONTRACT_ADDRESS, abi: BOUNTY_BOARD_ABI, functionName: 'getSubmissions',
    args: [bountyId, 0n, 50n], chainId: CHAIN_ID,
  }) as { data: Array<{ id: bigint; submitter: string; bountyId: bigint; content: `0x${string}` }> | undefined; refetch: () => void }

  const { data: userHasSubmitted, refetch: refetchHasSubmitted } = useReadContract({
    address: CONTRACT_ADDRESS, abi: BOUNTY_BOARD_ABI, functionName: 'hasSubmitted',
    args: [bountyId, address ?? '0x0000000000000000000000000000000000000000'],
    chainId: CHAIN_ID, query: { enabled: !!address },
  }) as { data: boolean | undefined; refetch: () => void }

  const { data: userPayoutStatus, refetch: refetchPayoutStatus } = useReadContract({
    address: CONTRACT_ADDRESS, abi: BOUNTY_BOARD_ABI, functionName: 'payoutStatus',
    args: [bountyId, address ?? '0x0000000000000000000000000000000000000000'],
    chainId: CHAIN_ID, query: { enabled: !!address },
  }) as { data: number | undefined; refetch: () => void }

  const { data: reviewWindowRaw } = useReadContract({
    address: CONTRACT_ADDRESS, abi: BOUNTY_BOARD_ABI, functionName: 'reviewWindow',
    chainId: CHAIN_ID,
  }) as { data: number | undefined }

  // Write: submit
  const { writeContract: submitWork, data: submitHash, isPending: submitPending, error: submitErr } = useWriteContract()
  const { isLoading: submitConfirming, isSuccess: submitSuccess } = useWaitForTransactionReceipt({ hash: submitHash })

  // Write: claim (pending payout)
  const { writeContract: claimReward, data: claimHash, isPending: claimPending, error: claimErr } = useWriteContract()
  const { isLoading: claimConfirming, isSuccess: claimSuccess } = useWaitForTransactionReceipt({ hash: claimHash })

  // Write: reclaimUnused
  const { writeContract: reclaimUnused, data: reclaimHash, isPending: reclaimPending, error: reclaimErr } = useWriteContract()
  const { isLoading: reclaimConfirming, isSuccess: reclaimSuccess } = useWaitForTransactionReceipt({ hash: reclaimHash })

  // Write: cancel
  const { writeContract: cancelBounty, data: cancelHash, isPending: cancelPending, error: cancelErr } = useWriteContract()
  const { isLoading: cancelConfirming, isSuccess: cancelSuccess } = useWaitForTransactionReceipt({ hash: cancelHash })

  function refetchAll() {
    refetchBounty(); refetchSubs(); refetchHasSubmitted(); refetchPayoutStatus(); onDataChange?.()
  }

  function handleSubmit() {
    if (isWrongChain) { switchChain({ chainId: CHAIN_ID }); return }
    if (!submissionText.trim()) { toast.error('Please write your submission first.'); return }
    if (new TextEncoder().encode(submissionText).length > 300) { toast.error('Submission is too long (max 300 chars).'); return }
    submitWork(
      { address: CONTRACT_ADDRESS, abi: BOUNTY_BOARD_ABI, functionName: 'submit', args: [bountyId, encodeText(submissionText)], chainId: CHAIN_ID },
      { onSuccess: () => { toast.success('Submission sent!'); refetchAll() }, onError: (err) => toast.error(parseOnchainError(err)) }
    )
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
  const titleStr = decodeBytes(bounty.title) || `Bounty #${idNum}`
  const descStr = decodeBytes(bounty.description)
  const subList = submissions ?? []
  const subCount = subList.length

  // Timing — snapshot at mount, good enough for deadline comparisons
  const now = Math.floor(_getNowSec())
  const reviewWindowSec = reviewWindowRaw ?? 0
  const approvalCutoff = Number(bounty.deadline) + reviewWindowSec
  const afterReviewWindow = now > approvalCutoff
  const totalPrize = bounty.rewardPerWinner * bounty.maxWinners
  const paidOut = totalPrize - bounty.escrowRemaining

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
            <div className="font-heading text-[20px] font-extrabold tabular-nums">{subCount}</div>
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

      {/* Submit form */}
      {!isPoster && status === 'OPEN' && !userHasSubmitted && address && (userPayoutStatus === undefined || userPayoutStatus === 0) && (
        <WindowCard title="SUBMIT_WORK.EXE" titleBarColor="#A78BFA">
          <div className="flex flex-col gap-3">
            <div className="font-mono-ui text-[11px] text-[#111]/60 border-2 border-[#111] rounded-lg p-2 bg-[#FFE600]/20">
              Text you post is <strong>permanent and public</strong> onchain. Max 300 chars.
            </div>
            <textarea value={submissionText} onChange={e => setSubmissionText(e.target.value)}
              placeholder="Paste a link or describe your work..." rows={5}
              className="border-[3px] border-[#111] rounded-lg px-3 py-2.5 text-[15px] font-body bg-white focus:outline-none focus:bg-[#FFFDF0] w-full resize-none"
            />
            <div className={`font-mono-ui text-[10px] text-right ${new TextEncoder().encode(submissionText).length > 300 ? 'text-[#FF6B57]' : 'text-[#111]/40'}`}>
              {new TextEncoder().encode(submissionText).length}/300
            </div>
            <TxStatus hash={submitHash} isPending={submitPending} isConfirming={submitConfirming} isSuccess={submitSuccess} isError={!!submitErr} error={submitErr ? parseOnchainError(submitErr) : undefined} successMessage="Submission sent!" />
            {isWrongChain ? (
              <PillButton variant="pink" onClick={() => switchChain({ chainId: CHAIN_ID })} showArrow={false}>Switch Network</PillButton>
            ) : (
              <PillButton onClick={handleSubmit} loading={submitPending || submitConfirming} disabled={submitSuccess}>Submit work →</PillButton>
            )}
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
      {!isPoster && userHasSubmitted && (userPayoutStatus === 0 || userPayoutStatus === undefined) && (
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
          {subCount === 0 && !bounty.cancelled && (
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
      <SubmissionList submissions={subList} bountyId={bountyId} isPoster={isPoster} rewardPerWinner={bounty.rewardPerWinner} afterReviewWindow={afterReviewWindow} approvalCutoff={approvalCutoff} onApproved={refetchAll} />
    </div>
  )
}

interface SubmissionListProps {
  submissions: Array<{ id: bigint; submitter: string; bountyId: bigint; content: `0x${string}` }>
  bountyId: bigint
  isPoster: boolean
  rewardPerWinner: bigint
  afterReviewWindow: boolean
  approvalCutoff: number
  onApproved: () => void
}

function SubmissionList({ submissions, bountyId, isPoster, rewardPerWinner, afterReviewWindow, approvalCutoff: _approvalCutoff, onApproved }: SubmissionListProps) {
  if (submissions.length === 0) {
    return (
      <WindowCard title="SUBMISSIONS.EXE" titleBarColor="#7FF3F0">
        <div className="checkerboard rounded-lg py-10 flex flex-col items-center gap-3">
          <FolderIcon size={36} />
          <div className="font-mono-bold text-[12px] uppercase tracking-widest text-[#111]/50">No submissions yet</div>
        </div>
      </WindowCard>
    )
  }

  return (
    <WindowCard title={`SUBMISSIONS.EXE (${submissions.length})`} titleBarColor="#7FF3F0">
      <div className="flex flex-col gap-3">
        {submissions.map((sub) => (
          <SingleSubmission key={sub.id.toString()} sub={sub} bountyId={bountyId} isPoster={isPoster} rewardPerWinner={rewardPerWinner} canApprove={!afterReviewWindow} onApproved={onApproved} />
        ))}
      </div>
    </WindowCard>
  )
}

interface SingleSubmissionProps {
  sub: { id: bigint; submitter: string; content: `0x${string}` }
  bountyId: bigint
  isPoster: boolean
  rewardPerWinner: bigint
  canApprove: boolean
  onApproved: () => void
}

function SingleSubmission({ sub, bountyId, isPoster, rewardPerWinner, canApprove, onApproved }: SingleSubmissionProps) {
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
      { address: CONTRACT_ADDRESS, abi: BOUNTY_BOARD_ABI, functionName: 'approveWinner', args: [bountyId, sub.submitter as unknown as `0x${string}`], chainId: CHAIN_ID },
      {
        onSuccess: () => { toast.success('Winner approved & paid!'); onApproved() },
        onError: (err) => toast.error(parseOnchainError(err)),
      }
    )
  }

  const isWinner = winnerStatus !== undefined && winnerStatus > 0
  const isPending = winnerStatus === PAYOUT_PENDING
  const isPaid = winnerStatus === PAYOUT_PAID
  const contentStr = decodeBytes(sub.content)

  return (
    <div className={`border-[3px] border-[#111] rounded-lg p-3 ${isWinner ? 'bg-[#C6F23A]/20' : 'bg-white'}`}>
      <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
        <span className="font-mono-bold text-[10px] uppercase tracking-wider text-[#111]">
          SUB #{String(Number(sub.id)).padStart(2, '0')} — {formatAddress(sub.submitter)}
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
      <p className="font-body text-[13px] text-[#111]/80 whitespace-pre-wrap leading-relaxed">{contentStr}</p>
      {(approvePending || approveConfirming || approveSuccess || approveErr) && (
        <div className="mt-2">
          <TxStatus hash={approveHash} isPending={approvePending} isConfirming={approveConfirming} isSuccess={approveSuccess} isError={!!approveErr} error={approveErr ? parseOnchainError(approveErr) : undefined} successMessage="Winner approved & paid!" />
        </div>
      )}
    </div>
  )
}
