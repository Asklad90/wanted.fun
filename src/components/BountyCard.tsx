import { WindowCard } from './WindowCard'
import { StatusTag } from './StatusTag'
import { LoadingBar } from './LoadingBar'
import { PixelAvatar } from './PixelAvatar'
import { LockIcon, FolderIcon, ClockIcon, ArrowRightIcon } from './Icons'
import { barColor, formatUsdc, formatAddress, timeLeft, bountyStatus, decodeBytes } from '../lib/utils'

export interface BountyData {
  id: bigint
  poster: string
  title: `0x${string}`
  description: `0x${string}`
  rewardPerWinner: bigint
  maxWinners: bigint
  winnersApproved: bigint
  deadline: bigint
  escrowRemaining: bigint
  reclaimedUnused: boolean
  cancelled: boolean
  // augmented client-side
  submissionCount?: bigint
}

interface BountyCardProps {
  bounty: BountyData
  onClick: () => void
}

export function BountyCard({ bounty, onClick }: BountyCardProps) {
  const idNum = Number(bounty.id)
  const titleStr = decodeBytes(bounty.title) || `Bounty #${idNum}`
  const status = bountyStatus({
    winnersApproved: bounty.winnersApproved,
    maxWinners: bounty.maxWinners,
    deadline: bounty.deadline,
    cancelled: bounty.cancelled,
    reclaimedUnused: bounty.reclaimedUnused,
  })
  const totalEscrow = bounty.rewardPerWinner * bounty.maxWinners
  const subCount = bounty.submissionCount !== undefined ? Number(bounty.submissionCount) : '?'

  return (
    <button
      type="button"
      onClick={onClick}
      className="group text-left w-full h-full cursor-pointer"
    >
      <WindowCard
        title={`BOUNTY_${String(idNum).padStart(3, '0')}.EXE`}
        titleBarColor={barColor(idNum)}
        className="h-full flex flex-col transition-all duration-150 group-hover:shadow-[7px_7px_0_#111]"
        bodyClassName="p-4 flex flex-col flex-1"
      >
        {/* Top row: status + time */}
        <div className="flex items-center justify-between gap-2 mb-2.5 flex-wrap">
          <StatusTag status={status} />
          <div className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#111]/5 border border-[#111]/15 text-[#111]/80">
            <ClockIcon size={12} />
            <span className="font-mono-bold text-[10px] uppercase tracking-wider">{timeLeft(bounty.deadline)}</span>
          </div>
        </div>

        {/* Title */}
        <h3 className="font-heading text-[17px] font-extrabold leading-tight text-[#111] mb-3 line-clamp-2 group-hover:underline decoration-2 underline-offset-2">
          {titleStr}
        </h3>

        {/* Reward showcase box */}
        <div className="rounded-xl border-[2px] border-[#111] bg-white p-3 mb-3 shadow-[2px_2px_0_#111]">
          <div className="flex items-baseline justify-between gap-2 flex-wrap">
            <div className="flex items-baseline gap-1.5">
              <span className="font-heading text-[32px] font-extrabold tabular-nums text-[#111] leading-none" style={{ letterSpacing: '-0.02em' }}>
                ${formatUsdc(bounty.rewardPerWinner)}
              </span>
              <span className="font-mono-bold text-[10px] text-[#111]/60 uppercase font-bold">USDC / winner</span>
            </div>
            <div className="inline-flex items-center gap-1 border-[2px] border-[#111] rounded-full px-2 py-0.5 bg-[#C6F23A] shadow-[1px_1px_0_#111]">
              <LockIcon size={10} />
              <span className="font-mono-bold text-[9px] uppercase tracking-wider text-[#111]">
                ${formatUsdc(totalEscrow)} locked
              </span>
            </div>
          </div>
        </div>

        {/* Winners progress bar */}
        <div className="mt-auto">
          <LoadingBar
            current={Number(bounty.winnersApproved)}
            max={Number(bounty.maxWinners)}
            label={`WINNERS ${bounty.winnersApproved}/${bounty.maxWinners}`}
            color="#FF3E9A"
          />

          {/* Footer: creator + submissions + view CTA */}
          <div className="flex items-center justify-between gap-2 mt-3 pt-2.5 border-t-[2px] border-[#111]/12">
            <div className="flex items-center gap-2 min-w-0">
              <span className="inline-flex shrink-0 rounded-full overflow-hidden border-[1.5px] border-[#111]">
                <PixelAvatar address={bounty.poster} size={20} />
              </span>
              <span className="font-mono-ui text-[10px] text-[#111]/70 truncate">
                {formatAddress(bounty.poster)}
              </span>
              <span className="text-[#111]/30">·</span>
              <span className="inline-flex items-center gap-1 font-mono-bold text-[10px] uppercase tracking-wider text-[#111]/70 shrink-0">
                <FolderIcon size={11} />
                {subCount}
              </span>
            </div>
            <span className="inline-flex items-center gap-1 font-mono-bold text-[10px] uppercase text-[#111] bg-[#FFE600] border-[1.5px] border-[#111] rounded-full px-2 py-0.5 shadow-[1px_1px_0_#111] group-hover:translate-x-0.5 transition-transform shrink-0">
              View <ArrowRightIcon size={10} />
            </span>
          </div>
        </div>
      </WindowCard>
    </button>
  )
}
