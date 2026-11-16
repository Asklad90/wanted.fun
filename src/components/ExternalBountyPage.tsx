import React, { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { WindowCard } from './WindowCard'
import { StatusTag } from './StatusTag'
import { ClockIcon, CoinIcon, FolderIcon, CheckCircleIcon, GlobeIcon, ArrowRightIcon, XIcon } from './Icons'
import { PixelAvatar } from './PixelAvatar'
import { formatUsdc, timeLeft } from '../lib/utils'
import {
  fetchSingleExternalBounty,
  handleToPseudoAddress,
  isExactXStatusUrl,
  type ExternalBounty,
} from '../lib/submissions-api'

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

const _getNowSec = (): number => Date.now() / 1000

interface ExternalBountyPageProps {
  externalId: string
  onBack: () => void
}

export function ExternalBountyPage({ externalId, onBack }: ExternalBountyPageProps) {
  const [bounty, setBounty] = useState<ExternalBounty | null>(null)
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetchSingleExternalBounty(externalId)
      .then(res => {
        if (!cancelled) {
          setBounty(res)
          setLoading(false)
        }
      })
      .catch(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [externalId])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="font-mono-bold text-[13px] uppercase tracking-widest text-[#111]/60 animate-pulse">
          Loading external bounty...
        </div>
      </div>
    )
  }

  if (!bounty) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-20 text-center max-w-md mx-auto px-4">
        <div className="font-heading text-[24px] font-extrabold text-[#111]">External Bounty Not Found</div>
        <p className="font-mono-ui text-[12px] text-[#111]/70 leading-relaxed">
          We couldn&apos;t load this external bounty ({externalId}). It may have expired or been removed.
        </p>
        <button
          type="button"
          onClick={onBack}
          className="font-mono-bold text-[11px] uppercase tracking-wider bg-[#FFE600] border-[2px] border-[#111] px-4 py-2 rounded-full shadow-hard-sm hover:bg-[#FFE600]/80 transition-colors btn-press cursor-pointer"
        >
          ← Back to wall
        </button>
      </div>
    )
  }

  const currentBounty = bounty
  const deadlineSec = Number(currentBounty.deadline)
  const isExpired = _getNowSec() > deadlineSec
  const status = isExpired ? 'EXPIRED' : 'OPEN'
  const rewardPerWinnerBig = BigInt(currentBounty.reward_usdc)
  const maxWinnersNum = Number(currentBounty.max_winners) || 1
  const totalPrizeBig = rewardPerWinnerBig * BigInt(maxWinnersNum)
  const pseudoAddress = handleToPseudoAddress(currentBounty.poster_handle)
  const cleanHandle = currentBounty.poster_handle.replace(/^@/, '')
  const hostProfileUrl = `https://x.com/${cleanHandle}`
  const hasExactPost = isExactXStatusUrl(currentBounty.tweet_url)

  function getShareUrl(): string {
    if (typeof window !== 'undefined') {
      return `${window.location.origin}/#/external/${currentBounty.id}`
    }
    return `https://want.fun/#/external/${currentBounty.id}`
  }

  function handleCopyLink() {
    const url = getShareUrl()
    navigator.clipboard
      .writeText(url)
      .then(() => {
        setCopied(true)
        toast.success('Bounty link copied!')
        setTimeout(() => setCopied(false), 2000)
      })
      .catch(() => toast.error('Failed to copy link'))
  }

  function handleShareX() {
    const url = getShareUrl()
    const cleanDesc = currentBounty.description.replace(/\s+/g, ' ').trim()
    const descSnippet = cleanDesc
      ? cleanDesc.length > 110
        ? `"${cleanDesc.slice(0, 107)}..."`
        : `"${cleanDesc}"`
      : ''

    const parts = [
      `Spotted this live bounty via @wantdotfun:\n"${currentBounty.title}"`,
      descSnippet,
      `💰 $${formatUsdc(rewardPerWinnerBig)} ${currentBounty.reward_label} prize!\n\n${url}`,
    ].filter(Boolean)

    const text = encodeURIComponent(parts.join('\n\n'))
    window.open(`https://twitter.com/intent/tweet?text=${text}`, '_blank', 'noopener,noreferrer')
  }

  return (
    <div className="flex flex-col gap-5 max-w-2xl desk:max-w-[1120px] mx-auto">
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
          <span className="inline-flex items-center gap-1.5 font-mono-bold text-[10px] uppercase tracking-widest text-[#111] bg-[#7FF3F0] border-[2px] border-[#111] rounded-full px-3 py-1 shadow-hard-xs">
            <GlobeIcon size={12} />
            <span>External Bounty · View Only</span>
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

      {/* Explicit Outside-Bounty Notice Banner */}
      <div className="border-[3px] border-[#111] rounded-2xl bg-[#FFE600] shadow-hard-sm px-4 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-start sm:items-center gap-3">
          <span className="w-8 h-8 rounded-xl bg-[#111] text-[#FFE600] border-[2px] border-[#111] flex items-center justify-center font-mono-bold text-[14px] shrink-0">
            !
          </span>
          <div className="flex flex-col gap-0.5">
            <span className="font-heading text-[14px] sm:text-[15px] font-extrabold uppercase tracking-wide text-[#111]">
              Outside Bounty — Not Posted or Launched on Want.fun
            </span>
            <p className="font-mono-ui text-[11px] sm:text-[12px] text-[#111]/85 leading-snug">
              This bounty was discovered from an external source ({bounty.verified_source}) and is displayed in <strong>view-only mode</strong>. Submissions and payouts happen on the host&apos;s official page.
            </p>
          </div>
        </div>
        <a
          href={bounty.participation_url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center gap-1.5 shrink-0 font-mono-bold text-[11px] uppercase tracking-wider bg-[#111] text-[#FFFDF0] hover:bg-[#FF3E9A] hover:text-[#111] border-[2px] border-[#111] rounded-full px-4 py-2 shadow-[2px_2px_0_#FFFDF0] transition-colors cursor-pointer"
        >
          <span>Participate Externally</span>
          <span>↗</span>
        </a>
      </div>

      <div className="flex flex-col gap-6 desk:grid desk:grid-cols-[1fr_340px] desk:gap-6 desk:items-start">
        <div className="flex flex-col gap-6 min-w-0">
          {/* Main External Bounty Window */}
          <WindowCard
            title="EXTERNAL_BOUNTY.EXE"
            titleBarColor="#7FF3F0"
            bodyClassName="flex flex-col gap-0 !p-0"
          >
            {/* Hero Checkerboard Header Zone */}
            <div className="checkerboard border-b-[3px] border-[#111] p-4 sm:p-6 flex flex-col gap-3.5">
              {/* Status + Deadline row */}
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <StatusTag status={status} />
                  <span className="inline-flex items-center gap-1.5 border-[2px] border-[#111] rounded-full px-2.5 py-1 bg-[#7FF3F0] font-mono-bold text-[10px] uppercase tracking-wider text-[#111] shadow-hard-xs">
                    <GlobeIcon size={11} />
                    <span>Outside Bounty · View Only</span>
                  </span>
                  <span className="inline-flex items-center gap-1.5 border-[2px] border-[#111] rounded-full px-2.5 py-1 bg-[#C6F23A] font-mono-bold text-[10px] uppercase tracking-wider text-[#111] shadow-hard-xs">
                    ${formatUsdc(totalPrizeBig)} {bounty.reward_label} Total Pool
                  </span>
                </div>
                <div className="inline-flex items-center gap-1.5 border-[2px] border-[#111] rounded-full px-3 py-1 bg-white text-[#111] shadow-hard-xs">
                  <ClockIcon size={14} className="text-[#111]" />
                  <span className="font-mono-bold text-[11px] sm:text-[12px] uppercase tracking-wider">{isExpired ? 'ENDED' : timeLeft(deadlineSec)}</span>
                </div>
              </div>

              {/* Framed White Headline Card */}
              <div className="bg-white border-[3px] border-[#111] rounded-2xl p-4 sm:p-6 shadow-hard-sm flex flex-col gap-3">
                <div>
                  <h1 className="font-heading font-black text-[28px] sm:text-[38px] leading-[1.08] text-[#111] tracking-tight text-balance">
                    {bounty.title}
                  </h1>
                  <div className="w-28 sm:w-36 h-2 bg-[#7FF3F0] border border-[#111] rounded-full mt-2.5" />
                </div>

                {/* External Creator Attribution */}
                <div className="flex items-center justify-between gap-2 flex-wrap pt-2 border-t-[2px] border-[#111]/10">
                  <a
                    href={hostProfileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 group cursor-pointer"
                  >
                    <span className="inline-flex rounded-lg overflow-hidden border-[2px] border-[#111] shadow-hard-xs">
                      <PixelAvatar address={pseudoAddress} size={24} />
                    </span>
                    <span className="font-mono-ui text-[11px] text-[#111]/70">
                      Hosted by <strong className="font-mono-bold text-[#111] group-hover:text-[#1A1AE6] group-hover:underline">{bounty.poster_name} (@{bounty.poster_handle})</strong>
                    </span>
                    <span className="font-mono-bold text-[11px] text-[#111] group-hover:translate-x-0.5 transition-transform">↗</span>
                  </a>
                  <span className="font-mono-bold text-[10px] uppercase tracking-widest text-[#111] bg-[#FFE600] border-[1.5px] border-[#111] rounded-md px-2 py-0.5">
                    {bounty.verified_source}
                  </span>
                </div>
              </div>
            </div>

            {/* Body Content */}
            <div className="p-4 sm:p-6 flex flex-col gap-5 bg-[#FFFDF0]">
              {/* Framed Task Brief Document Box */}
              <div className="border-[2.5px] border-[#111] rounded-2xl bg-white shadow-hard-sm overflow-hidden">
                <div className="bg-[#111] text-[#FFFDF0] px-4 py-2 flex items-center justify-between border-b-[2.5px] border-[#111]">
                  <span className="font-mono-bold text-[10px] uppercase tracking-widest text-[#FFE600]">
                    TASK_BRIEF.TXT — External Bounty Overview
                  </span>
                  <span className="font-mono-bold text-[9px] uppercase tracking-widest px-2 py-0.5 rounded bg-white/15 text-[#7FF3F0]">
                    {bounty.category}
                  </span>
                </div>
                <div className="p-4 sm:p-5 flex flex-col gap-4">
                  <p className="font-body text-[15px] sm:text-[16px] leading-relaxed text-[#111]/90 whitespace-pre-wrap">
                    {linkify(bounty.description)}
                  </p>
                </div>
              </div>

              {/* 2x2 Stat Grid */}
              <div className="grid grid-cols-2 gap-3.5">
                {/* Box 1: REWARD / WINNER */}
                <div className="relative overflow-hidden border-[3px] border-[#111] rounded-2xl p-4 bg-[#111] flex flex-col justify-between min-h-[108px] shadow-hard-sm">
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
                      ${formatUsdc(rewardPerWinnerBig)}
                    </div>
                    <div className="font-mono-bold text-[10px] sm:text-[11px] uppercase tracking-wider text-white/70 mt-0.5">
                      {bounty.reward_label} / WINNER
                    </div>
                  </div>
                </div>

                {/* Box 2: DEADLINE */}
                <div className="relative overflow-hidden border-[3px] border-[#111] rounded-2xl p-4 bg-[#111] flex flex-col justify-between min-h-[108px] shadow-hard-sm">
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
                      {isExpired ? 'ENDED' : timeLeft(deadlineSec)}
                    </div>
                    <div className="font-mono-bold text-[10px] sm:text-[11px] uppercase tracking-wider text-white/70 mt-0.5">
                      DEADLINE
                    </div>
                  </div>
                </div>

                {/* Box 3: MODE (View-Only) */}
                <div className="relative overflow-hidden border-[3px] border-[#111] rounded-2xl p-4 bg-[#111] flex flex-col justify-between min-h-[108px] shadow-hard-sm">
                  <div className="flex items-center justify-between relative z-1">
                    <span className="w-8 h-8 rounded-lg bg-[#A78BFA] border-[2px] border-white flex items-center justify-center">
                      <FolderIcon size={18} className="text-[#111]" />
                    </span>
                    <span className="font-mono-bold text-[9px] uppercase tracking-widest px-2 py-0.5 rounded bg-white/10 text-[#A78BFA] border border-white/15">
                      MODE
                    </span>
                  </div>
                  <div className="relative z-1 mt-3">
                    <div className="font-heading text-[22px] sm:text-[26px] font-black leading-tight text-white uppercase">
                      View Only
                    </div>
                    <div className="font-mono-bold text-[10px] sm:text-[11px] uppercase tracking-wider text-white/70 mt-0.5">
                      SUBMIT EXTERNALLY
                    </div>
                  </div>
                </div>

                {/* Box 4: WINNER SLOTS */}
                <div className="relative overflow-hidden border-[3px] border-[#111] rounded-2xl p-4 bg-[#111] flex flex-col justify-between min-h-[108px] shadow-hard-sm">
                  <div className="flex items-center justify-between relative z-1">
                    <span className="w-8 h-8 rounded-lg bg-[#C6F23A] border-[2px] border-white flex items-center justify-center">
                      <CheckCircleIcon size={18} className="text-[#111]" />
                    </span>
                    <span className="font-mono-bold text-[9px] uppercase tracking-widest px-2 py-0.5 rounded bg-white/10 text-[#C6F23A] border border-white/15">
                      SLOTS
                    </span>
                  </div>
                  <div className="relative z-1 mt-3">
                    <div className="font-heading text-[28px] sm:text-[34px] font-black leading-tight text-white tabular-nums">
                      {maxWinnersNum}
                    </div>
                    <div className="font-mono-bold text-[10px] sm:text-[11px] uppercase tracking-wider text-white/70 mt-0.5">
                      WINNER{maxWinnersNum !== 1 ? 'S' : ''}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </WindowCard>

          {/* View-Only Participation Card (Replaces SUBMIT_WORK.EXE & SUBMISSIONS.EXE) */}
          <div id="external-participate" className="scroll-mt-24">
            <WindowCard title="PARTICIPATE_EXTERNALLY.EXE" titleBarColor="#FFE600">
              <div className="flex flex-col gap-4">
                <div className="checkerboard rounded-xl p-4 sm:p-5 border-[2.5px] border-[#111]">
                  <div className="bg-white border-[2.5px] border-[#111] rounded-xl p-4 sm:p-5 shadow-hard-sm flex flex-col gap-3">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <span className="inline-flex items-center gap-1.5 font-mono-bold text-[10px] uppercase tracking-widest px-2.5 py-1 rounded-full bg-[#7FF3F0] border-[1.5px] border-[#111] text-[#111]">
                        View-Only Listing
                      </span>
                      <span className="font-mono-bold text-[10px] uppercase tracking-wider text-[#111]/60">
                        Not launched on Want.fun
                      </span>
                    </div>

                    <h2 className="font-heading text-[20px] sm:text-[24px] font-extrabold text-[#111] leading-tight">
                      Submit your work on the official bounty page
                    </h2>

                    <p className="font-mono-ui text-[12px] text-[#111]/80 leading-relaxed">
                      Because this bounty was created outside of Want.fun by <strong>{bounty.poster_name} (@{cleanHandle})</strong>, Want.fun does not collect submissions for it directly. Use the links below to open the direct submission listing or X announcement.
                    </p>

                    <div className="rounded-lg border-[2px] border-[#111]/25 bg-[#FFFDF0] px-3 py-2 flex items-center justify-between gap-2">
                      <span className="font-mono-bold text-[10px] uppercase tracking-wider text-[#111]/60 shrink-0">
                        Submit Link
                      </span>
                      <span className="font-mono-ui text-[11px] text-[#111] truncate" title={bounty.participation_url}>
                        {bounty.participation_url}
                      </span>
                    </div>

                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-1">
                      <a
                        href={bounty.participation_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 inline-flex items-center justify-center gap-2 rounded-full border-[3px] border-[#111] shadow-hard btn-press bg-[#C6F23A] hover:bg-[#C6F23A]/90 text-[#111] font-heading font-extrabold uppercase tracking-wide px-5 py-3.5 text-[14px] text-center cursor-pointer"
                      >
                        <span>Go to Participation / Submissions Page</span>
                        <ArrowRightIcon size={14} />
                      </a>

                      <a
                        href={bounty.tweet_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center justify-center gap-2 rounded-full border-[3px] border-[#111] shadow-hard-sm btn-press bg-[#111] text-white hover:text-[#FFE600] font-mono-bold uppercase tracking-wider px-5 py-3.5 text-[12px] text-center cursor-pointer"
                      >
                        <XIcon size={13} />
                        <span>{hasExactPost ? 'Original Post ↗' : 'Find Post on X ↗'}</span>
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            </WindowCard>
          </div>
        </div>

        {/* ── Sidebar (desktop) ──────────────────────────────────────────────── */}
        <div className="flex flex-col gap-5">
          {/* Reward card */}
          <WindowCard title="REWARD.EXE" titleBarColor="#A78BFA" bodyClassName="flex flex-col gap-3.5">
            <div className="dark-grid-surface bg-[#111] border-[2.5px] border-[#111] rounded-xl p-4 flex flex-col gap-2 text-white shadow-hard-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono-bold text-[10px] uppercase tracking-widest text-white/60">External Prize</span>
                <span className="font-mono-bold text-[9px] uppercase tracking-widest px-2 py-0.5 rounded-full bg-[#FFE600] text-[#111] border-[1.5px] border-[#111]">
                  {maxWinnersNum} WINNER{maxWinnersNum !== 1 ? 'S' : ''}
                </span>
              </div>
              <div className="flex items-center gap-2.5 pt-0.5">
                <div className="w-9 h-9 rounded-lg bg-[#FFE600] border-[2px] border-[#111] flex items-center justify-center shrink-0">
                  <CoinIcon size={24} />
                </div>
                <div className="flex items-baseline gap-1.5">
                  <span className="font-heading text-[28px] font-extrabold tabular-nums text-[#FFE600] leading-none">
                    ${formatUsdc(rewardPerWinnerBig)}
                  </span>
                  <span className="font-mono-bold text-[12px] uppercase tracking-wider text-white/80">
                    {bounty.reward_label}
                  </span>
                </div>
              </div>
            </div>

            <a
              href={bounty.participation_url}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full inline-flex items-center justify-center gap-2 rounded-full border-[3px] border-[#111] shadow-hard-sm btn-press bg-[#FFE600] hover:bg-[#FFE600]/85 text-[#111] font-heading font-extrabold uppercase tracking-wide px-5 py-3 text-[13px] cursor-pointer"
            >
              <span>Open Submission Portal</span>
              <span>↗</span>
            </a>

            <div className="flex items-start gap-2.5 border-[2px] border-[#111] rounded-xl p-3 bg-[#7FF3F0]/25 shadow-hard-xs">
              <div className="w-6 h-6 rounded-md bg-[#7FF3F0] border-[1.5px] border-[#111] flex items-center justify-center shrink-0 mt-0.5">
                <GlobeIcon size={13} className="shrink-0 text-[#111]" />
              </div>
              <p className="font-mono-ui text-[11px] leading-snug text-[#111]/80">
                <strong className="font-mono-bold text-[#111]">External Host ({bounty.verified_source}).</strong> This bounty was not launched on Want.fun; prize distribution is managed by @{bounty.poster_handle}.
              </p>
            </div>
          </WindowCard>

          {/* External Host / Creator card */}
          <WindowCard title="EXTERNAL_HOST.EXE" titleBarColor="#FF3E9A" bodyClassName="flex flex-col gap-0 !p-0">
            <div className="checkerboard p-3.5 border-b-[2.5px] border-[#111]">
              <a
                href={hostProfileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex items-center gap-3 p-2.5 bg-white border-[2.5px] border-[#111] rounded-xl shadow-hard-xs hover:translate-x-[-1px] hover:translate-y-[-1px] transition-transform"
              >
                <div className="border-[2px] border-[#111] rounded-xl overflow-hidden shrink-0 shadow-hard-xs bg-[#FFFDF0]">
                  <PixelAvatar address={pseudoAddress} size={46} />
                </div>
                <div className="flex flex-col min-w-0 flex-1">
                  <span className="font-heading text-[15px] font-extrabold text-[#111] group-hover:text-[#1A1AE6] truncate">
                    {bounty.poster_name}
                  </span>
                  <span className="font-mono-bold text-[10px] text-[#111]/60 truncate">
                    @{bounty.poster_handle}
                  </span>
                </div>
                <span className="w-7 h-7 rounded-full bg-[#FFE600] border-[2px] border-[#111] flex items-center justify-center font-mono-bold text-[11px] text-[#111] group-hover:translate-x-0.5 transition-transform">
                  ↗
                </span>
              </a>
            </div>
            <div className="p-3.5 flex flex-col gap-3">
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono-bold text-[9px] uppercase tracking-widest border-[2px] border-[#111] rounded-full px-2.5 py-0.5 bg-[#7FF3F0] text-[#111] shadow-hard-xs">
                  OUTSIDE SOURCE
                </span>
                <a
                  href={bounty.tweet_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 font-mono-bold text-[10px] uppercase tracking-wider text-[#111] bg-[#FFE600] hover:bg-[#111] hover:text-[#FFE600] border-[2px] border-[#111] rounded-full px-3 py-1 shadow-hard-xs transition-colors"
                >
                  <span>{hasExactPost ? 'Original Post' : 'Find on X'}</span>
                  <span>↗</span>
                </a>
              </div>
            </div>
          </WindowCard>

          {/* Requirements card */}
          <WindowCard title="REQUIREMENTS.EXE" titleBarColor="#7FF3F0" bodyClassName="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="font-mono-bold text-[10px] uppercase tracking-widest text-[#111]/60">
                Deliverable Checklist
              </span>
              <span className="font-mono-bold text-[9px] uppercase tracking-widest px-2 py-0.5 rounded-full bg-[#7FF3F0] border-[1.5px] border-[#111] text-[#111]">
                EXTERNAL
              </span>
            </div>

            <div className="flex items-start gap-2.5 border-[2px] border-[#111] rounded-xl p-3 bg-white shadow-hard-xs">
              <div className="w-6 h-6 rounded-md bg-[#C6F23A] border-[1.5px] border-[#111] flex items-center justify-center text-[#111] shrink-0 mt-0.5">
                <CheckCircleIcon size={14} className="shrink-0 text-[#111]" />
              </div>
              <div className="flex flex-col gap-1">
                <span className="font-mono-bold text-[11px] uppercase tracking-wider text-[#111]">
                  How to Qualify
                </span>
                <span className="font-mono-ui text-[11px] leading-relaxed text-[#111]/80">
                  {bounty.requirements_summary}
                </span>
              </div>
            </div>

            <div className="border-[2px] border-[#111] rounded-xl px-3 py-2 bg-[#111] flex items-center justify-between text-white font-mono-bold text-[10px] uppercase tracking-wider">
              <span className="text-white/80">Want.fun Mode</span>
              <span className="text-[#FFE600]">View Only · Link Out</span>
            </div>
          </WindowCard>
        </div>
      </div>
    </div>
  )
}
