import React from 'react'
import { WindowCard } from './WindowCard'
import { PillButton } from './PillButton'
import { UsdcCoinIcon } from './StatIcons'

interface HowItWorksPageProps {
  onCreateBounty: () => void
  onBrowse: () => void
}

const OVERVIEW: { n: string; title: string; color: string }[] = [
  { n: '01', title: 'Post',     color: '#FFE600' },
  { n: '02', title: 'Submit',   color: '#FF3E9A' },
  { n: '03', title: 'Approve',  color: '#A78BFA' },
  { n: '04', title: 'Get paid', color: '#C6F23A' },
]

interface GuideStepData { n: number; title: string; text: string; color: string }

const POSTER_STEPS: GuideStepData[] = [
  { n: 1, title: 'Sign in',      text: 'Use Google or connect a wallet. Keep some USDC handy for the prize.', color: '#FFE600' },
  { n: 2, title: 'Post & fund',  text: 'Add a title, the task, the prize per winner, how many winners and a deadline. The full prize is locked in escrow before your bounty goes live.', color: '#FF3E9A' },
  { n: 3, title: 'Review',       text: 'Open every submission privately (links, images, videos) before you decide.', color: '#A78BFA' },
  { n: 4, title: 'Pick winners', text: 'Approve your winners and the USDC is sent straight from escrow. Any unused prize comes back to you after the review window.', color: '#C6F23A' },
]

const WORKER_STEPS: GuideStepData[] = [
  { n: 1, title: 'Find a bounty',    text: 'Browse the wall. The prize is already locked in escrow, so you know it is real.', color: '#FFE600' },
  { n: 2, title: 'Sign in',          text: 'Use Google or connect a wallet. Submitting costs no gas.', color: '#FF3E9A' },
  { n: 3, title: 'Submit your work', text: 'Send text, links, images or videos. Only you and the poster can see it.', color: '#A78BFA' },
  { n: 4, title: 'Get paid',         text: 'If the poster picks you, the USDC lands in your wallet. If a payout is ever pending, claim it on the bounty page.', color: '#C6F23A' },
]

function GuideCard({ title, color, steps, note, action }: {
  title: string
  color: string
  steps: GuideStepData[]
  note?: string
  action: React.ReactNode
}) {
  return (
    <WindowCard title={title} titleBarColor={color} className="h-full flex flex-col" bodyClassName="flex flex-col gap-3.5 p-5 flex-1">
      {steps.map(s => (
        <div
          key={s.n}
          className="flex items-start gap-3.5 p-3 rounded-xl border-[2px] border-[#111] bg-white shadow-hard-xs transition-transform duration-150 hover:-translate-y-0.5"
        >
          <span
            className="shrink-0 w-9 h-9 rounded-lg border-[2.5px] border-[#111] shadow-[2px_2px_0_#111] flex items-center justify-center font-heading text-[16px] font-extrabold text-[#111]"
            style={{ backgroundColor: s.color, color: s.color === '#FF3E9A' ? '#FFFFFF' : '#111111' }}
          >
            0{s.n}
          </span>
          <div className="min-w-0">
            <div className="font-heading text-[17px] font-extrabold text-[#111] leading-tight">{s.title}</div>
            <div className="font-mono-ui text-[12px] leading-relaxed text-[#111]/75 mt-1">{s.text}</div>
          </div>
        </div>
      ))}
      {note && (
        <p className="font-mono-ui text-[11px] leading-relaxed text-[#111]/80 bg-[#FFE600]/25 border-[2px] border-dashed border-[#111] rounded-xl px-3.5 py-2.5">
          <strong>Tip:</strong> {note}
        </p>
      )}
      <div className="mt-auto pt-2">{action}</div>
    </WindowCard>
  )
}

export function HowItWorksPage({ onCreateBounty, onBrowse }: HowItWorksPageProps) {
  return (
    <div className="flex flex-col gap-7">
      <div>
        <button
          type="button"
          onClick={onBrowse}
          className="inline-flex items-center gap-1.5 font-mono-bold text-[11px] uppercase tracking-wider text-[#111] bg-white hover:bg-[#FFE600] border-[2.5px] border-[#111] px-3.5 py-1.5 rounded-full shadow-hard-sm transition-colors btn-press cursor-pointer"
        >
          <span aria-hidden="true">←</span>
          <span>Back to Wall</span>
        </button>
      </div>

      {/* Header */}
      <div className="checkerboard border-[3px] border-[#111] rounded-2xl shadow-hard overflow-hidden p-4 sm:p-6">
        <div className="bg-[#FFFDF0] border-[3px] border-[#111] rounded-xl shadow-hard-sm px-6 py-8 desk:px-10 desk:py-10 flex flex-col gap-5">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#C6F23A] border-[2px] border-[#111] shadow-hard-xs w-fit font-mono-bold text-[10px] uppercase tracking-wider text-[#111]">
            Trustless Onchain Escrow Protocol
          </div>
          <div className="flex items-center gap-3.5 flex-wrap">
            <UsdcCoinIcon size={48} />
            <h1 className="font-heading text-[34px] sm:text-[46px] font-extrabold leading-[1.05] text-[#111]" style={{ letterSpacing: '-0.02em' }}>
              How Want.fun works
            </h1>
          </div>
          <p className="font-heading text-[16px] sm:text-[18px] font-bold text-[#111]/85 max-w-2xl leading-relaxed">
            The full USDC prize is locked in smart-contract escrow before a single contributor lifts a finger. Nobody has to trust anybody.
          </p>
          <div className="flex items-center gap-2.5 flex-wrap pt-1">
            {OVERVIEW.map((s, idx) => (
              <React.Fragment key={s.n}>
                <div
                  className="flex items-center gap-2 border-[2.5px] border-[#111] rounded-xl shadow-hard-sm px-3.5 py-2"
                  style={{ backgroundColor: s.color, color: s.color === '#FF3E9A' ? '#FFFFFF' : '#111111' }}
                >
                  <span className="font-heading text-[16px] font-extrabold">{s.n}</span>
                  <span className="font-mono-bold text-[11px] uppercase tracking-wider">{s.title}</span>
                </div>
                {idx < OVERVIEW.length - 1 && (
                  <span className="font-mono-bold text-[14px] text-[#111]/50 hidden sm:inline" aria-hidden="true">→</span>
                )}
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>

      {/* Detailed guides */}
      <div className="grid grid-cols-1 desk:grid-cols-2 gap-6 items-stretch">
        <GuideCard
          title="FOR_CREATORS.EXE"
          color="#FF3E9A"
          steps={POSTER_STEPS}
          note="Changed your mind? You can cancel for a full refund within 1 hour of posting, as long as no submissions or winners exist."
          action={<PillButton onClick={onCreateBounty} variant="yellow" className="w-full">Post a bounty</PillButton>}
        />
        <div id="for-workers" className="scroll-mt-24 h-full">
          <GuideCard
            title="FOR_HUNTERS.EXE"
            color="#C6F23A"
            steps={WORKER_STEPS}
            note="Submitting proof of work is 100% gasless and free. You only need a connected wallet to receive your USDC prize."
            action={<PillButton onClick={onBrowse} variant="lime" className="w-full">Browse open bounties</PillButton>}
          />
        </div>
      </div>

      {/* Protocol Guarantees Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-2xl border-[3px] border-[#111] bg-white p-5 shadow-hard flex flex-col gap-2">
          <span className="inline-flex items-center justify-center w-9 h-9 rounded-xl border-[2px] border-[#111] bg-[#FFE600] font-mono-bold text-[13px] text-[#111] shadow-hard-xs">
            01
          </span>
          <h3 className="font-heading text-[18px] font-extrabold text-[#111]">100% Upfront Escrow</h3>
          <p className="font-mono-ui text-[12px] text-[#111]/75 leading-relaxed">
            Every bounty on the wall has its entire USDC prize pool locked inside the smart contract before going live.
          </p>
        </div>
        <div className="rounded-2xl border-[3px] border-[#111] bg-white p-5 shadow-hard flex flex-col gap-2">
          <span className="inline-flex items-center justify-center w-9 h-9 rounded-xl border-[2px] border-[#111] bg-[#7FF3F0] font-mono-bold text-[13px] text-[#111] shadow-hard-xs">
            02
          </span>
          <h3 className="font-heading text-[18px] font-extrabold text-[#111]">Gasless Submissions</h3>
          <p className="font-mono-ui text-[12px] text-[#111]/75 leading-relaxed">
            Hunters submit links, text, images, or videos off-chain with zero gas fees. Creators can toggle visibility between private and public.
          </p>
        </div>
        <div className="rounded-2xl border-[3px] border-[#111] bg-white p-5 shadow-hard flex flex-col gap-2">
          <span className="inline-flex items-center justify-center w-9 h-9 rounded-xl border-[2px] border-[#111] bg-[#C6F23A] font-mono-bold text-[13px] text-[#111] shadow-hard-xs">
            03
          </span>
          <h3 className="font-heading text-[18px] font-extrabold text-[#111]">Direct Instant Payouts</h3>
          <p className="font-mono-ui text-[12px] text-[#111]/75 leading-relaxed">
            When a creator approves a winner, the smart contract transfers USDC directly from escrow to the winner's wallet.
          </p>
        </div>
      </div>
    </div>
  )
}
