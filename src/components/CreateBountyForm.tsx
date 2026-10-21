import { useState, useRef, useEffect } from 'react'
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useSwitchChain } from 'wagmi'
import { erc20Abi, parseUnits, parseEventLogs } from 'viem'
import { toast } from 'sonner'
import { ImageIcon, VideoIcon, XIcon, PlusIcon } from 'lucide-react'
import { WindowCard } from './WindowCard'
import { PillButton } from './PillButton'
import { TxStatus } from './TxStatus'
import { LockIcon } from './Icons'
import { BOUNTY_BOARD_ABI } from '../bounty-abi'
import { CHAIN_ID, CONTRACT_ADDRESS, USDC_ADDRESS, USDC_DECIMALS, CONTRACT_DEPLOYED } from '../bounty-config'
import { parseOnchainError, encodeText } from '../lib/utils'
import { registerBounty, saveExamples } from '../lib/submissions-api'

// Deadline minimum: 1 hour from module load
const MIN_DEADLINE_DATE: string = new Date(Date.now() + 3600_000).toISOString().slice(0, 16)

const MAX_TITLE = 80
const MAX_DESC = 500
const MAX_EXAMPLES = 5
const MAX_EXAMPLE_BYTES = 4_000_000 // 4 MB per file

interface CreateBountyFormProps {
  onClose?: () => void
  onSuccess?: () => void
}

interface ExampleAttachment {
  dataUrl: string
  name: string
  type: string
}

export function CreateBountyForm({ onClose, onSuccess }: CreateBountyFormProps) {
  const { address, chainId } = useAccount()
  const { switchChain } = useSwitchChain()

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [rewardPerWinner, setRewardPerWinner] = useState('')
  const [maxWinners, setMaxWinners] = useState('1')
  const [deadlineDate, setDeadlineDate] = useState('')
  const [examples, setExamples] = useState<ExampleAttachment[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Approve USDC
  const { writeContract: approveUsdc, data: approveHash, isPending: approvePending, error: approveErr, reset: resetApprove } = useWriteContract()
  const { isLoading: approveConfirming, isSuccess: approveSuccess } = useWaitForTransactionReceipt({ hash: approveHash })

  // Create bounty
  const { writeContract: createBounty, data: createHash, isPending: createPending, error: createErr, reset: resetCreate } = useWriteContract()
  const { isLoading: createConfirming, isSuccess: createSuccess, data: createReceipt } = useWaitForTransactionReceipt({ hash: createHash })

  // Once the tx confirms, save examples under the real onchain bounty ID from the BountyCreated event
  useEffect(() => {
    if (!createSuccess || !createReceipt || examples.length === 0) return
    try {
      const logs = parseEventLogs({ abi: BOUNTY_BOARD_ABI, logs: createReceipt.logs, eventName: 'BountyCreated' })
      const bountyId = logs[0]?.args?.id
      if (bountyId == null) return
      const idStr = bountyId.toString()
      void saveExamples(idStr, examples.map(e => e.dataUrl)).catch(() => {
        toast.error('Examples could not be saved — try re-uploading from the bounty page.')
      })
      void registerBounty(idStr, address?.toLowerCase())
    } catch {
      // If log parsing fails, examples are silently skipped
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [createSuccess, createReceipt])

  const rewardRaw = rewardPerWinner ? parseUnits(rewardPerWinner, USDC_DECIMALS) : 0n
  const maxWinnersNum = Math.max(1, Math.min(50, parseInt(maxWinners) || 1))
  const totalEscrow = rewardRaw * BigInt(maxWinnersNum)
  const totalEscrowDisplay = rewardPerWinner ? (parseFloat(rewardPerWinner) * maxWinnersNum).toFixed(2) : '0.00'
  const deadlineTs = deadlineDate ? BigInt(Math.floor(new Date(deadlineDate).getTime() / 1000)) : 0n

  const isWrongChain = chainId !== CHAIN_ID
  const titleBytes = new TextEncoder().encode(title).length
  const descBytes = new TextEncoder().encode(description).length

  const canApprove = !!(
    address &&
    title.trim() &&
    titleBytes <= MAX_TITLE &&
    description.trim() &&
    descBytes <= MAX_DESC &&
    rewardPerWinner &&
    parseFloat(rewardPerWinner) > 0 &&
    maxWinnersNum >= 1 &&
    deadlineDate
  )

  // ── Example attachment handlers ──────────────────────────────────────────────
  function handleAddExample(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    if (!files.length) return
    const remaining = MAX_EXAMPLES - examples.length
    const toAdd = files.slice(0, remaining)
    toAdd.forEach(file => {
      if (file.size > MAX_EXAMPLE_BYTES) {
        toast.error(`${file.name} is too large (max 3 MB)`)
        return
      }
      const reader = new FileReader()
      reader.onload = () => {
        setExamples(prev => [
          ...prev,
          { dataUrl: reader.result as string, name: file.name, type: file.type },
        ])
      }
      reader.readAsDataURL(file)
    })
    // Reset input so same file can be re-added after removal
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function removeExample(idx: number) {
    setExamples(prev => prev.filter((_, i) => i !== idx))
  }

  // ── Approve ──────────────────────────────────────────────────────────────────
  function handleApprove() {
    if (isWrongChain) { switchChain({ chainId: CHAIN_ID }); return }
    if (!CONTRACT_DEPLOYED) { toast.error('Contract not yet deployed.'); return }
    resetApprove()
    approveUsdc(
      { address: USDC_ADDRESS, abi: erc20Abi, functionName: 'approve', args: [CONTRACT_ADDRESS, totalEscrow], chainId: CHAIN_ID },
      { onError: (err) => toast.error(parseOnchainError(err)) }
    )
  }

  // ── Create bounty + upload examples ─────────────────────────────────────────
  function handleCreate() {
    if (isWrongChain) { switchChain({ chainId: CHAIN_ID }); return }
    resetCreate()
    createBounty(
      {
        address: CONTRACT_ADDRESS,
        abi: BOUNTY_BOARD_ABI,
        functionName: 'createBounty',
        args: [encodeText(title), encodeText(description), rewardRaw, BigInt(maxWinnersNum), deadlineTs],
        chainId: CHAIN_ID,
      },
      {
        onSuccess: () => {
          toast.success('Bounty posted — prize locked in escrow!')
        },
        onError: (err) => toast.error(parseOnchainError(err)),
      }
    )
  }

  // ── Success screen ───────────────────────────────────────────────────────────
  if (createSuccess) {
    return (
      <WindowCard title="BOUNTY_POSTED.EXE" titleBarColor="#C6F23A" onClose={onClose}>
        <div className="flex flex-col gap-4 items-center text-center py-4">
          <div className="font-heading text-[44px] font-extrabold leading-none" style={{ letterSpacing: '-0.02em' }}>
            IT'S LIVE!
          </div>
          <div className="font-mono-bold text-[12px] uppercase tracking-wider text-[#111]/70">
            Prize is locked in escrow. Workers can now submit.
          </div>
          <TxStatus hash={createHash} isPending={false} isConfirming={false} isSuccess isError={false} successMessage="Prize locked!" />
          <PillButton variant="lime" onClick={() => { onSuccess?.(); onClose?.() }}>View wall</PillButton>
        </div>
      </WindowCard>
    )
  }

  // ── Form ─────────────────────────────────────────────────────────────────────
  return (
    <WindowCard title="NEW_BOUNTY.EXE" titleBarColor="#FF3E9A" onClose={onClose}>
      <div className="flex flex-col gap-5">

        {/* Trust notice */}
        <div className="border-[3px] border-[#111] rounded-lg bg-[#C6F23A]/40 px-3 py-3 flex items-start gap-2">
          <LockIcon size={16} className="shrink-0 mt-0.5 text-[#111]" />
          <p className="font-mono-bold text-[11px] text-[#111] leading-relaxed uppercase tracking-wide">
            Your bounty goes live <strong>only after the prize is locked in escrow.</strong> Workers can never submit to an unfunded bounty.
          </p>
        </div>

        {/* ── Section: Details ── */}
        <div className="flex flex-col gap-4">
          <div className="font-mono-bold text-[10px] uppercase tracking-widest text-[#111]/40 border-b-[2px] border-[#111]/10 pb-1">
            Bounty details
          </div>

          {/* Title */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label className="font-mono-bold text-[11px] uppercase tracking-widest text-[#111]">Title *</label>
              <span className={`font-mono-ui text-[10px] ${titleBytes > MAX_TITLE ? 'text-[#FF6B57]' : 'text-[#111]/40'}`}>{titleBytes}/{MAX_TITLE}</span>
            </div>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g. Write a blog post about Arc"
              maxLength={MAX_TITLE}
              className="border-[3px] border-[#111] rounded-lg px-3 py-2.5 text-[15px] font-body bg-white focus:outline-none focus:bg-[#FFFDF0] w-full"
            />
          </div>

          {/* Description */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label className="font-mono-bold text-[11px] uppercase tracking-widest text-[#111]">Description *</label>
              <span className={`font-mono-ui text-[10px] ${descBytes > MAX_DESC ? 'text-[#FF6B57]' : 'text-[#111]/40'}`}>{descBytes}/{MAX_DESC}</span>
            </div>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Describe what workers need to do and how to submit. What does good work look like?"
              rows={4}
              className="border-[3px] border-[#111] rounded-lg px-3 py-2.5 text-[15px] font-body bg-white focus:outline-none focus:bg-[#FFFDF0] w-full resize-none"
            />
          </div>

          {/* Example attachments */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <label className="font-mono-bold text-[11px] uppercase tracking-widest text-[#111]">
                Example attachments
                <span className="ml-1.5 font-mono-ui text-[10px] normal-case tracking-normal text-[#111]/40">(optional · max {MAX_EXAMPLES})</span>
              </label>
              <span className="font-mono-ui text-[10px] text-[#111]/40">{examples.length}/{MAX_EXAMPLES}</span>
            </div>

            {/* Thumbnails row */}
            {examples.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {examples.map((ex, idx) => (
                  <div key={idx} className="relative border-[2px] border-[#111] rounded-lg overflow-hidden w-20 h-20 bg-[#FFFDF0] flex items-center justify-center shrink-0">
                    {ex.type.startsWith('video/') ? (
                      // eslint-disable-next-line jsx-a11y/media-has-caption
                      <video src={ex.dataUrl} className="w-full h-full object-cover" muted />
                    ) : (
                      <img src={ex.dataUrl} alt={ex.name} className="w-full h-full object-cover" />
                    )}
                    {/* Type badge */}
                    <div className="absolute bottom-1 left-1 bg-[#111]/70 rounded px-1 py-0.5 flex items-center gap-0.5">
                      {ex.type.startsWith('video/') ? (
                        <VideoIcon size={8} className="text-white" />
                      ) : (
                        <ImageIcon size={8} className="text-white" />
                      )}
                    </div>
                    {/* Remove */}
                    <button
                      onClick={() => removeExample(idx)}
                      className="absolute top-1 right-1 bg-[#FF3E9A] border-[1.5px] border-[#111] rounded-full w-5 h-5 flex items-center justify-center shadow"
                      aria-label="Remove"
                    >
                      <XIcon size={10} className="text-white" strokeWidth={3} />
                    </button>
                  </div>
                ))}

                {/* Add more slot */}
                {examples.length < MAX_EXAMPLES && (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="border-[2px] border-dashed border-[#111]/40 rounded-lg w-20 h-20 flex flex-col items-center justify-center gap-1 bg-[#FFFDF0] hover:bg-[#A78BFA]/10 hover:border-[#111]/70 transition-colors shrink-0"
                  >
                    <PlusIcon size={16} className="text-[#111]/50" />
                    <span className="font-mono-ui text-[9px] text-[#111]/40 uppercase tracking-wider">Add</span>
                  </button>
                )}
              </div>
            )}

            {/* Empty drop zone */}
            {examples.length === 0 && (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="border-[3px] border-dashed border-[#111]/30 rounded-lg p-5 flex flex-col items-center gap-2 bg-[#FFFDF0] hover:bg-[#A78BFA]/10 hover:border-[#111]/50 transition-colors"
              >
                <div className="flex gap-2">
                  <ImageIcon size={22} className="text-[#A78BFA]" />
                  <VideoIcon size={22} className="text-[#A78BFA]" />
                </div>
                <span className="font-mono-bold text-[11px] uppercase tracking-widest text-[#111]/50">
                  Add images or videos
                </span>
                <span className="font-mono-ui text-[10px] text-[#111]/35">
                  Show workers what great submissions look like · max 3 MB each
                </span>
              </button>
            )}

            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/jpeg,image/png,image/gif,image/webp,video/mp4,video/quicktime,video/webm"
              onChange={handleAddExample}
              className="hidden"
            />
          </div>
        </div>

        {/* ── Section: Reward ── */}
        <div className="flex flex-col gap-4">
          <div className="font-mono-bold text-[10px] uppercase tracking-widest text-[#111]/40 border-b-[2px] border-[#111]/10 pb-1">
            Prize &amp; deadline
          </div>

          {/* Reward + winners */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="font-mono-bold text-[11px] uppercase tracking-widest text-[#111]">Reward / winner (USDC) *</label>
              <input type="number" value={rewardPerWinner} onChange={e => setRewardPerWinner(e.target.value)}
                placeholder="25" min="0.000001" step="0.000001"
                className="border-[3px] border-[#111] rounded-lg px-3 py-2.5 text-[15px] font-heading font-bold bg-white focus:outline-none focus:bg-[#FFFDF0] w-full tabular-nums"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="font-mono-bold text-[11px] uppercase tracking-widest text-[#111]">Max winners (1–50) *</label>
              <input type="number" value={maxWinners} onChange={e => setMaxWinners(e.target.value)}
                placeholder="1" min="1" max="50" step="1"
                className="border-[3px] border-[#111] rounded-lg px-3 py-2.5 text-[15px] font-heading font-bold bg-white focus:outline-none focus:bg-[#FFFDF0] w-full tabular-nums"
              />
            </div>
          </div>

          {/* Deadline */}
          <div className="flex flex-col gap-1.5">
            <label className="font-mono-bold text-[11px] uppercase tracking-widest text-[#111]">Deadline *</label>
            <input type="datetime-local" value={deadlineDate} onChange={e => setDeadlineDate(e.target.value)}
              min={MIN_DEADLINE_DATE}
              className="border-[3px] border-[#111] rounded-lg px-3 py-2.5 text-[15px] font-body bg-white focus:outline-none focus:bg-[#FFFDF0] w-full"
            />
          </div>
        </div>

        {/* Total escrow preview */}
        {canApprove && (
          <div className="border-[3px] border-[#111] rounded-lg bg-[#7FF3F0]/40 px-4 py-3">
            <div className="flex items-center justify-between">
              <span className="font-mono-bold text-[11px] uppercase tracking-widest text-[#111]">Total to lock in escrow</span>
              <span className="font-heading text-[28px] font-extrabold text-[#111] tabular-nums" style={{ letterSpacing: '-0.02em' }}>
                {totalEscrowDisplay} USDC
              </span>
            </div>
            <div className="font-mono-ui text-[10px] text-[#111]/50 mt-1">
              {rewardPerWinner} USDC × {maxWinnersNum} winner{maxWinnersNum > 1 ? 's' : ''} = {totalEscrowDisplay} USDC locked upfront
            </div>
          </div>
        )}

        {/* CTA flow */}
        {!address ? (
          <div className="font-mono-ui text-[12px] text-[#111]/60 text-center py-2">Connect your wallet to post a bounty</div>
        ) : isWrongChain ? (
          <PillButton variant="pink" onClick={() => switchChain({ chainId: CHAIN_ID })} showArrow={false}>Switch Network</PillButton>
        ) : !approveSuccess ? (
          <div className="flex flex-col gap-3">
            <TxStatus hash={approveHash} isPending={approvePending} isConfirming={approveConfirming}
              isSuccess={approveSuccess} isError={!!approveErr}
              error={approveErr ? parseOnchainError(approveErr) : undefined}
              successMessage="USDC approved!"
            />
            <PillButton onClick={handleApprove} disabled={!canApprove} loading={approvePending || approveConfirming} variant="yellow">
              Step 1: Approve USDC
            </PillButton>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="border-2 border-[#C6F23A] border-dashed rounded-lg px-3 py-2 bg-[#C6F23A]/20">
              <span className="font-mono-bold text-[11px] uppercase tracking-wider text-[#111]">USDC approved. Ready to lock prize.</span>
            </div>
            <TxStatus hash={createHash} isPending={createPending} isConfirming={createConfirming}
              isSuccess={createSuccess} isError={!!createErr}
              error={createErr ? parseOnchainError(createErr) : undefined}
              successMessage="Prize locked & bounty live!"
            />
            <PillButton onClick={handleCreate} loading={createPending || createConfirming} variant="lime">
              Step 2: Lock prize &amp; publish →
            </PillButton>
          </div>
        )}

        {/* Permanent notice */}
        <p className="font-mono-ui text-[10px] text-[#111]/40 text-center">
          Text posted onchain is permanent and public.
        </p>
      </div>
    </WindowCard>
  )
}
