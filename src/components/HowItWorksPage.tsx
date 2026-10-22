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
    <WindowCard title={title} titleBarColor={color} className="h-full flex flex-col" bodyClassName="flex flex-col gap-4 p-5 flex-1">
      {steps.map(s => (
        <div key={s.n} className="flex items-start gap-3">
          <span
            className="shrink-0 w-9 h-9 rounded-full border-[3px] border-[#111] flex items-center justify-center font-heading text-[15px] font-extrabold text-[#111]"
            style={{ backgroundColor: s.color }}
          >
            {s.n}
          </span>
          <div className="min-w-0">
            <div className="font-heading text-[18px] font-extrabold text-[#111] leading-tight">{s.title}</div>
            <div className="font-mono-ui text-[13px] leading-snug text-[#111]/75 mt-0.5">{s.text}</div>
          </div>
        </div>
      ))}
      {note && (
        <p className="font-mono-ui text-[12px] leading-snug text-[#111]/70 border-2 border-dashed border-[#111]/40 rounded-lg px-3 py-2">
          {note}
        </p>
      )}
      <div className="mt-auto pt-1">{action}</div>
    </WindowCard>
  )
}

export function HowItWorksPage({ onCreateBounty, onBrowse }: HowItWorksPageProps) {
  return (
    <div className="flex flex-col gap-8">
      {/* Header */}
      <div className="checkerboard border-[3px] border-[#111] rounded-xl shadow-hard overflow-hidden">
        <div className="bg-[#FFFDF0]/92 px-6 py-10 desk:px-12 desk:py-12 flex flex-col gap-6">
          <div className="flex items-center gap-3">
            <UsdcCoinIcon size={44} />
            <h1 className="font-heading text-[34px] sm:text-[44px] font-extrabold leading-[1.05] text-[#111]" style={{ letterSpacing: '-0.02em' }}>
              How Want.fun works
            </h1>
          </div>
          <p className="font-heading text-[16px] font-bold text-[#111] max-w-xl leading-relaxed">
            The full USDC prize is locked in escrow before a single worker lifts a finger. Nobody has to trust anybody.
          </p>
          <div className="flex gap-3 flex-wrap">
            {OVERVIEW.map(s => (
              <div
                key={s.n}
                className="flex items-center gap-2 border-[3px] border-[#111] rounded-lg shadow-hard-sm px-3 py-2"
                style={{ backgroundColor: s.color }}
              >
                <span className="font-heading text-[16px] font-extrabold text-[#111]">{s.n}</span>
                <span className="font-mono-bold text-[11px] uppercase tracking-wider text-[#111]">{s.title}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Detailed guides */}
      <div className="grid grid-cols-1 desk:grid-cols-2 gap-6 items-stretch">
        <GuideCard
          title="FOR_POSTERS.EXE"
          color="#FF3E9A"
          steps={POSTER_STEPS}
          note="Changed your mind? You can cancel for a full refund within 1 hour of posting, as long as no winner has been picked."
          action={<PillButton onClick={onCreateBounty} variant="yellow">Post a bounty</PillButton>}
        />
        <div id="for-workers" className="scroll-mt-24 h-full">
          <GuideCard
            title="FOR_WORKERS.EXE"
            color="#C6F23A"
            steps={WORKER_STEPS}
            action={<PillButton onClick={onBrowse} variant="lime">Browse bounties</PillButton>}
          />
        </div>
      </div>
    </div>
  )
}
