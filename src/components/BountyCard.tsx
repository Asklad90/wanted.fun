import { WindowCard } from './WindowCard'
import { StatusTag } from './StatusTag'
import { LockIcon, FolderIcon, ClockIcon, CoinIcon } from './Icons'
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
  index?: number
}

export function BountyCard({ bounty, onClick, index = 0 }: BountyCardProps) {
  const idNum = Number(bounty.id)
  const titleStr = decodeBytes(bounty.title) || `Bounty #${idNum}`
  const descStr = decodeBytes(bounty.description)
  const status = bountyStatus({
    winnersApproved: bounty.winnersApproved,
    maxWinners: bounty.maxWinners,
    deadline: bounty.deadline,
    cancelled: bounty.cancelled,
    reclaimedUnused: bounty.reclaimedUnused,
  })

  const totalPrize = bounty.rewardPerWinner * bounty.maxWinners
  const paidOut = totalPrize >= bounty.escrowRemaining ? totalPrize - bounty.escrowRemaining : 0n
  const subCount = bounty.submissionCount !== undefined ? Number(bounty.submissionCount) : 0
  const maxWinnersNum = Number(bounty.maxWinners)
  const approvedNum = Number(bounty.winnersApproved)
  const sweepDelay = (index % 4) * 1.1

  return (
    <button
      type="button"
      onClick={onClick}
      className="text-left w-full h-full block group focus:outline-none focus-visible:ring-2 focus-visible:ring-[#111] cursor-pointer"
    >
      <WindowCard
        title={`BOUNTY_${String(idNum).padStart(3, '0')}.EXE`}
        titleBarColor={barColor(idNum)}
        className="h-full transition-all duration-150 group-hover:shadow-[8px_8px_0_#111] group-hover:-translate-y-0.5"
        showStarBadge={true}
        showGlassSweep={true}
        sweepDelay={sweepDelay}
        bodyClassName="flex flex-col h-[calc(100%-41px)] justify-between"
      >
        <div>
          {/* Top row: Status + Time */}
          <div className="flex items-center justify-between gap-2 mb-2.5 flex-wrap">
            <StatusTag status={status} />
            <div className="flex items-center gap-1.5 text-[#111]">
              <ClockIcon size={14} className="text-[#111]" />
              <span className="font-mono-bold text-[11px] sm:text-[12px] uppercase tracking-wider">
                {timeLeft(bounty.deadline)}
              </span>
            </div>
          </div>

          {/* Main Title & Neon Accent Underline */}
          <div className="mb-2.5">
            <h3 className="font-heading text-[22px] sm:text-[25px] font-black leading-tight text-[#111] tracking-tight line-clamp-2">
              {titleStr}
            </h3>
            <div className="w-16 sm:w-20 h-1.5 bg-[#C6F23A] rounded-full mt-1.5" />
          </div>

          {/* Description */}
          {descStr && (
            <p className="font-body text-[12px] sm:text-[13px] leading-snug text-[#111]/75 line-clamp-2 mb-3">
              {descStr}
            </p>
          )}

          {/* 2x2 Vibrant Stat Grid */}
          <div className="grid grid-cols-2 gap-2 mb-3">
            {/* Box 1: USDC / WINNER (Soft Green) */}
            <div className="border-2 border-[#111] rounded-xl p-2.5 bg-[#EAFCDA] flex flex-col justify-between min-h-[72px]">
              <div className="flex items-center">
                <CoinIcon size={18} />
              </div>
              <div>
                <div className="font-heading text-[19px] sm:text-[21px] font-black leading-none text-[#111] tabular-nums">
                  {formatUsdc(bounty.rewardPerWinner)}
                </div>
                <div className="font-mono-bold text-[9px] uppercase tracking-wider text-[#111]/70 mt-1">
                  USDC / WINNER
                </div>
              </div>
            </div>

            {/* Box 2: DEADLINE (Soft Lavender) */}
            <div className="border-2 border-[#111] rounded-xl p-2.5 bg-[#EDE4FF] flex flex-col justify-between min-h-[72px]">
              <div className="flex items-center">
                <ClockIcon size={16} className="text-[#111]" />
              </div>
              <div>
                <div className="font-heading text-[17px] sm:text-[19px] font-black leading-none text-[#111] truncate">
                  {timeLeft(bounty.deadline)}
                </div>
                <div className="font-mono-bold text-[9px] uppercase tracking-wider text-[#111]/70 mt-1">
                  DEADLINE
                </div>
              </div>
            </div>

            {/* Box 3: SUBMISSIONS (Soft Yellow) */}
            <div className="border-2 border-[#111] rounded-xl p-2.5 bg-[#FFF6E0] flex flex-col justify-between min-h-[72px]">
              <div className="flex items-center">
                <FolderIcon size={16} />
              </div>
              <div>
                <div className="font-heading text-[19px] sm:text-[21px] font-black leading-none text-[#111] tabular-nums">
                  {subCount}
                </div>
                <div className="font-mono-bold text-[9px] uppercase tracking-wider text-[#111]/70 mt-1">
                  SUBMISSIONS
                </div>
              </div>
            </div>

            {/* Box 4: PAYMENT (Soft Cyan) */}
            <div className="border-2 border-[#111] rounded-xl p-2.5 bg-[#D4FAF5] flex flex-col justify-between min-h-[72px]">
              <div className="flex items-center">
                <LockIcon size={16} className="text-[#111]" />
              </div>
              <div>
                <div className="font-heading text-[15px] sm:text-[16px] font-black leading-none text-[#111] truncate">
                  {bounty.escrowRemaining > 0n ? 'in escrow' : 'paid out'}
                </div>
                <div className="font-mono-bold text-[9px] uppercase tracking-wider text-[#111]/70 mt-1">
                  PAYMENT
                </div>
              </div>
            </div>
          </div>

          {/* Escrow Panel with Halftone Dot Pattern */}
          <div className="border-2 border-[#111] rounded-xl p-2.5 bg-gradient-to-r from-[#E6FCD2] via-[#E8FCD8] to-[#DEFBAE] relative overflow-hidden mb-3">
            <div
              className="absolute right-0 top-0 bottom-0 w-2/5 opacity-20 pointer-events-none"
              style={{
                backgroundImage: 'radial-gradient(#111 1.5px, transparent 1.5px)',
                backgroundSize: '6px 6px',
              }}
            />
            <div className="flex items-center gap-1.5 mb-1.5 relative z-1">
              <LockIcon size={12} className="text-[#111]" />
              <span className="font-mono-bold text-[9px] sm:text-[10px] uppercase tracking-wider text-[#111]">
                ESCROW
              </span>
            </div>
            <div className="grid grid-cols-[1fr_auto_1fr] items-center relative z-1">
              <div className="flex flex-col">
                <span className="font-mono-bold text-[8px] sm:text-[9px] uppercase tracking-wider text-[#111]/60">
                  LOCKED
                </span>
                <span className="font-heading font-black text-[14px] sm:text-[15px] text-[#111] tabular-nums">
                  {formatUsdc(bounty.escrowRemaining)} USDC
                </span>
              </div>
              <div className="w-[1px] h-6 bg-[#111]/20 mx-2" />
              <div className="flex flex-col">
                <span className="font-mono-bold text-[8px] sm:text-[9px] uppercase tracking-wider text-[#111]/60">
                  PAID OUT
                </span>
                <span className="font-heading font-black text-[14px] sm:text-[15px] text-[#111] tabular-nums">
                  {formatUsdc(paidOut)} USDC
                </span>
              </div>
            </div>
          </div>

          {/* Winners Segmented Progress Bar */}
          <div className="mb-3">
            <div className="font-mono-bold text-[10px] uppercase tracking-wider text-[#111] mb-1.5">
              WINNERS {approvedNum}/{maxWinnersNum}
            </div>
            {maxWinnersNum <= 10 ? (
              <div className="flex gap-1.5">
                {Array.from({ length: maxWinnersNum }, (_, i) => {
                  const isFilled = i < approvedNum
                  return (
                    <div
                      key={i}
                      className={`h-3.5 flex-1 border-2 border-[#111] rounded-full transition-all ${
                        isFilled ? 'bg-[#FF2E93]' : 'bg-white'
                      }`}
                    />
                  )
                })}
              </div>
            ) : (
              <div className="h-3.5 w-full border-2 border-[#111] rounded-full bg-white overflow-hidden p-0.5">
                <div
                  className="h-full bg-[#FF2E93] rounded-full transition-all duration-500"
                  style={{
                    width: `${maxWinnersNum > 0 ? Math.min(100, (approvedNum / maxWinnersNum) * 100) : 0}%`,
                  }}
                />
              </div>
            )}
          </div>
        </div>

        {/* Footer: Posted By */}
        <div className="flex items-center justify-between text-[#111]/75 font-mono-ui text-[10px] sm:text-[11px] pt-1 border-t border-[#111]/10">
          <span className="inline-flex items-center gap-1">
            <span>Posted by</span>
            <span className="font-mono-bold text-[#111] underline underline-offset-2">
              {formatAddress(bounty.poster)}
            </span>
            <svg
              className="w-3 h-3 text-[#111]/80 inline-block ml-0.5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="7" y1="17" x2="17" y2="7" />
              <polyline points="7 7 17 7 17 17" />
            </svg>
          </span>
        </div>
      </WindowCard>
    </button>
  )
}
