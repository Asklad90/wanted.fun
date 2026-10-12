import { useEffect, useState } from 'react'
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
import { barColor, formatUsdc, formatAddress, timeLeft, bountyStatus, parseOnchainError, decodeBytes } from '../lib/utils'
import { BountyData } from './BountyCard'
import { SubmissionForm } from './SubmissionForm'
import { SubmissionsPanel } from './SubmissionsPanel'
import { fetchCounts } from '../lib/submissions-api'

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
  const [subCountRemote, setSubCountRemote] = useState(0)
  const [refreshKey, setRefreshKey] = useState(0)
  const isWrongChain = chainId !== CHAIN_ID

  const { data: bounty, refetch: refetchBounty } = useReadContract({
    address: CONTRACT_ADDRESS, abi: BOUNTY_BOARD_ABI, functionName: 'getBounty',
    args: [bountyId], chainId: CHAIN_ID,
  }) as { data: BountyData | undefined; refetch: () => void }

  const { data: createdAtRaw } = useReadContract({
    address: CONTRACT_ADDRESS, abi: BOUNTY_BOARD_ABI, functionName: 'createdAt',
    args: [bountyId], chainId: CHAIN_ID,
  }) as { data: bigint | undefined }

  const { data: cancelWindowRaw } = useReadContract({
    address: CONTRACT_ADDRESS, abi: BOUNTY_BOARD_ABI, functionName: 'CANCEL_WINDOW',
    chainId: CHAIN_ID,
  }) as { data: bigint | undefined }

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

  function refetchAll() {
    refetchBounty(); refetchPayoutStatus(); setRefreshKey((k) => k + 1); loadCount(); onDataChange?.()
  }

  function loadCount() {
    fetchCounts([Number(bountyId)]).then((c) => setSubCountRemote(c[String(Number(bountyId))] ?? 0))
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { loadCount() }, [bountyId])

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
  const subCount = subCountRemote

  // Timing — snapshot at mount, good enough for deadline comparisons
  const now = Math.floor(_getNowSec())
  const reviewWindowSec = reviewWindowRaw ?? 0
  const approvalCutoff = Number(bounty.deadline) + reviewWindowSec
  const afterReviewWindow = now > approvalCutoff
  const totalPrize = bounty.rewardPerWinner * bounty.maxWinners
  const paidOut = totalPrize - bounty.escrowRemaining
  const cancelDeadline = createdAtRaw !== undefined && cancelWindowRaw !== undefined ? Number(createdAtRaw) + Number(cancelWindowRaw) : 0
  const canCancel = !bounty.cancelled && bounty.winnersApproved === 0n && now <= cancelDeadline

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

      {/* Free submit form (no gas, wallet signature only) */}
      {!isPoster && status === 'OPEN' && address && (userPayoutStatus === undefined || userPayoutStatus === 0) && (
        <SubmissionForm bountyId={bountyId} onSubmitted={() => { loadCount(); setRefreshKey((k) => k + 1) }} />
      )}

      {/* Not connected  prompt */}
      {!address && status === 'OPEN' && (
        <WindowCard title="SUBMIT_WORK.EXE" titleBarColor="#A78BFA">
          <div className="font-mono-bold text-[13px] uppercase tracking-wider text-[#111]/60 text-center py-4">Connect your wallet to submit work (it&apos;s free)</div>
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
          {canCancel && (
            <WindowCard title="CANCEL_BOUNTY.EXE" titleBarColor="#CCCCCC">
              <div className="flex flex-col gap-3">
                <div className="font-body text-[14px] text-[#111]">You can cancel and get your full escrow back during the first 10 minutes after posting. After that the prize stays locked so workers can trust it.</div>
                <TxStatus hash={cancelHash} isPending={cancelPending} isConfirming={cancelConfirming} isSuccess={cancelSuccess} isError={!!cancelErr} error={cancelErr ? parseOnchainError(cancelErr) : undefined} successMessage="Bounty cancelled, escrow refunded." />
                {!cancelSuccess && <PillButton onClick={handleCancel} loading={cancelPending || cancelConfirming} variant="ink" showArrow={false}>Cancel bounty</PillButton>}
              </div>
            </WindowCard>
          )}
        </>
      )}

      {/* Submissions: poster opens everything, workers see their own */}
      <SubmissionsPanel bountyId={bountyId} isPoster={isPoster} rewardPerWinner={bounty.rewardPerWinner}
        canApprove={!afterReviewWindow && bounty.winnersApproved < bounty.maxWinners} count={subCount}
        refreshKey={refreshKey} onApproved={refetchAll} />
    </div>
  )
}
