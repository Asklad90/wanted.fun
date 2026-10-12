import { useCallback, useEffect, useState } from 'react'
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt, useSwitchChain, useSignMessage } from 'wagmi'
import { toast } from 'sonner'
import { WindowCard } from './WindowCard'
import { PillButton } from './PillButton'
import { TxStatus } from './TxStatus'
import { FolderIcon } from './Icons'
import { BOUNTY_BOARD_ABI } from '../bounty-abi'
import { CHAIN_ID, CONTRACT_ADDRESS } from '../bounty-config'
import { formatAddress, formatUsdc, parseOnchainError } from '../lib/utils'
import { hasCachedAuth, listSubmissions, type RemoteSubmission } from '../lib/submissions-api'

const PAYOUT_PENDING = 1
const PAYOUT_PAID = 2

interface Props {
  bountyId: bigint
  isPoster: boolean
  rewardPerWinner: bigint
  canApprove: boolean
  count: number
  refreshKey?: number
  onApproved: () => void
}

/** Poster: opens every submission (notes, links, images, videos) and approves winners.
 *  Worker: sees only their own submission. Both unlock with a free signature. */
export function SubmissionsPanel({ bountyId, isPoster, rewardPerWinner, canApprove, count, refreshKey, onApproved }: Props) {
  const { address } = useAccount()
  const { signMessageAsync } = useSignMessage()
  const [subs, setSubs] = useState<RemoteSubmission[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const scope = `bounty:${Number(bountyId)}`

  const load = useCallback(async () => {
    if (!address) return
    setLoading(true); setError('')
    try {
      const r = await listSubmissions(Number(bountyId), address, (m) => signMessageAsync({ message: m }))
      setSubs(r.submissions)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Could not load submissions.'
      setError(/rejected|denied/i.test(msg) ? 'Signature cancelled.' : msg)
    } finally { setLoading(false) }
  }, [address, bountyId, signMessageAsync])

  // Auto-load when the viewer already signed in this session
  useEffect(() => {
    if (address && hasCachedAuth(scope, address)) void load()
  }, [address, scope, load, refreshKey])

  if (!address) {
    return (
      <WindowCard title="SUBMISSIONS.EXE" titleBarColor="#7FF3F0">
        <div className="font-mono-bold text-[12px] uppercase tracking-wider text-[#111]/60 text-center py-4">
          {count} submission{count === 1 ? '' : 's'}. Connect your wallet to {isPoster ? 'review them' : 'see yours'}.
        </div>
      </WindowCard>
    )
  }

  if (subs === null) {
    if (!isPoster && count === 0) {
      return (
        <WindowCard title="SUBMISSIONS.EXE" titleBarColor="#7FF3F0">
          <div className="checkerboard rounded-lg py-8 flex flex-col items-center gap-3">
            <FolderIcon size={32} />
            <div className="font-mono-bold text-[12px] uppercase tracking-widest text-[#111]/50">No submissions yet</div>
          </div>
        </WindowCard>
      )
    }
    return (
      <WindowCard title={`SUBMISSIONS.EXE (${count})`} titleBarColor="#7FF3F0">
        <div className="flex flex-col gap-3 items-start">
          <div className="font-body text-[14px] text-[#111]/80">
            {isPoster
              ? 'Unlock to open every submission: read notes, open links, view images and play videos. Free signature, no gas.'
              : 'Unlock to see your own submission. Other people\'s work stays private.'}
          </div>
          {error && <div className="font-mono-bold text-[12px] text-[#FF3E9A]">{error}</div>}
          <PillButton onClick={load} loading={loading} variant="cyan">Unlock submissions </PillButton>
        </div>
      </WindowCard>
    )
  }

  if (subs.length === 0) {
    return (
      <WindowCard title="SUBMISSIONS.EXE" titleBarColor="#7FF3F0">
        <div className="checkerboard rounded-lg py-8 flex flex-col items-center gap-3">
          <FolderIcon size={32} />
          <div className="font-mono-bold text-[12px] uppercase tracking-widest text-[#111]/50">{isPoster ? 'No submissions yet' : 'You have not submitted yet'}</div>
          <PillButton size="sm" variant="yellow" showArrow={false} onClick={load} loading={loading}>Refresh</PillButton>
        </div>
      </WindowCard>
    )
  }

  return (
    <WindowCard title={`SUBMISSIONS.EXE (${subs.length})`} titleBarColor="#7FF3F0">
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="font-mono-ui text-[10px] text-[#111]/50">Links open other sites in a new tab. Only open ones you trust.</div>
          <PillButton size="sm" variant="yellow" showArrow={false} onClick={load} loading={loading}>Refresh</PillButton>
        </div>
        {subs.map((s, i) => (
          <SubmissionCard key={s.id} index={i + 1} sub={s} bountyId={bountyId} isPoster={isPoster}
            rewardPerWinner={rewardPerWinner} canApprove={canApprove} onApproved={onApproved} />
        ))}
      </div>
    </WindowCard>
  )
}

function hostOf(link: string) {
  try { return new URL(link).hostname.replace(/^www\./, '') } catch { return link }
}

function SubmissionCard({ index, sub, bountyId, isPoster, rewardPerWinner, canApprove, onApproved }: {
  index: number; sub: RemoteSubmission; bountyId: bigint; isPoster: boolean
  rewardPerWinner: bigint; canApprove: boolean; onApproved: () => void
}) {
  const { chainId } = useAccount()
  const { switchChain } = useSwitchChain()
  const isWrongChain = chainId !== CHAIN_ID

  const { data: payout, refetch: refetchPayout } = useReadContract({
    address: CONTRACT_ADDRESS, abi: BOUNTY_BOARD_ABI, functionName: 'payoutStatus',
    args: [bountyId, sub.submitter as `0x${string}`], chainId: CHAIN_ID,
  }) as { data: number | undefined; refetch: () => void }

  const { writeContract: approve, data: approveHash, isPending, error: approveErr } = useWriteContract()
  const { isLoading: confirming, isSuccess } = useWaitForTransactionReceipt({ hash: approveHash })

  function handleApprove() {
    if (isWrongChain) { switchChain({ chainId: CHAIN_ID }); return }
    approve(
      { address: CONTRACT_ADDRESS, abi: BOUNTY_BOARD_ABI, functionName: 'approveWinner', args: [bountyId, sub.submitter as `0x${string}`], chainId: CHAIN_ID },
      { onSuccess: () => { toast.success('Winner approved & paid!'); refetchPayout(); onApproved() }, onError: (e) => toast.error(parseOnchainError(e)) },
    )
  }

  const isWinner = payout !== undefined && payout > 0
  const images = sub.files.filter((f) => f.type.startsWith('image/'))
  const videos = sub.files.filter((f) => f.type.startsWith('video/'))

  return (
    <div className={`border-[3px] border-[#111] rounded-lg p-3 flex flex-col gap-3 ${isWinner ? 'bg-[#C6F23A]/20' : 'bg-white'}`}>
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <span className="font-mono-bold text-[10px] uppercase tracking-wider text-[#111]">
          SUB #{String(index).padStart(2, '0')} · {formatAddress(sub.submitter)}
        </span>
        {payout === PAYOUT_PAID && <span className="font-mono-bold text-[10px] uppercase bg-[#C6F23A] border-2 border-[#111] px-2 py-0.5 rounded-full">PAID {formatUsdc(rewardPerWinner)} USDC</span>}
        {payout === PAYOUT_PENDING && <span className="font-mono-bold text-[10px] uppercase bg-[#FFE600] border-2 border-[#111] px-2 py-0.5 rounded-full">PAYOUT PENDING</span>}
        {!isWinner && isPoster && canApprove && (
          <PillButton size="sm" variant="lime" onClick={handleApprove} loading={isPending || confirming} disabled={isSuccess} showArrow={false}>
            Approve &amp; pay
          </PillButton>
        )}
      </div>

      {sub.note && <p className="font-body text-[14px] text-[#111]/90 whitespace-pre-wrap leading-relaxed break-words">{sub.note}</p>}

      {sub.links.length > 0 && (
        <div className="flex flex-col gap-2">
          {sub.links.map((l) => (
            <a key={l} href={l} target="_blank" rel="noopener noreferrer nofollow"
              className="flex items-center justify-between gap-2 border-[3px] border-[#111] rounded-lg px-3 py-2 bg-[#FFE600]/40 hover:bg-[#FFE600] transition-colors">
              <span className="min-w-0">
                <span className="block font-mono-bold text-[11px] uppercase tracking-wider">{hostOf(l)}</span>
                <span className="block font-mono-ui text-[10px] text-[#111]/60 truncate">{l}</span>
              </span>
              <span className="font-mono-bold text-[11px] shrink-0">Open ↗</span>
            </a>
          ))}
        </div>
      )}

      {images.map((f, i) => (f.url
        ? (
          <a key={i} href={f.url} target="_blank" rel="noopener noreferrer" title="Open full size">
            <img src={f.url} alt={f.name} loading="lazy" className="w-full max-h-80 object-contain border-[3px] border-[#111] rounded-lg bg-[#FFFDF0]" />
          </a>
        )
        : <div key={i} className="font-mono-ui text-[11px] text-[#111]/50">Image unavailable: {f.name}</div>))}

      {videos.map((f, i) => (f.url
        ? <video key={i} src={f.url} controls preload="metadata" playsInline className="w-full max-h-96 border-[3px] border-[#111] rounded-lg bg-black" />
        : <div key={i} className="font-mono-ui text-[11px] text-[#111]/50">Video unavailable: {f.name}</div>))}

      {(isPending || confirming || isSuccess || approveErr) && (
        <TxStatus hash={approveHash} isPending={isPending} isConfirming={confirming} isSuccess={isSuccess} isError={!!approveErr}
          error={approveErr ? parseOnchainError(approveErr) : undefined} successMessage="Winner approved & paid!" />
      )}
    </div>
  )
}
