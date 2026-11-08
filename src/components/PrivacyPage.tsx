import React from 'react'
import { motion } from 'framer-motion'
import { WindowCard } from './WindowCard'

interface PrivacyPageProps {
  onBack: () => void
}

export function PrivacyPage({ onBack }: PrivacyPageProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="max-w-2xl mx-auto py-4 sm:py-8"
    >
      <div className="mb-4">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 font-mono-bold text-[12px] uppercase tracking-wider text-[#111] bg-white border-[2px] border-[#111] px-4 py-2 rounded-full shadow-hard-sm hover:bg-[#FFFDF0] transition-colors btn-press cursor-pointer"
        >
          ← Back to Wall
        </button>
      </div>

      <WindowCard title="PROTOCOL PRIVACY & TERMS">
        <div className="p-6 sm:p-8 space-y-8 text-[#111]">
          {/* Header */}
          <div className="border-b-[2px] border-[#111] pb-5">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border-[2px] border-[#111] bg-[#C6F23A] text-[#111] text-[10px] font-mono-bold uppercase tracking-wider mb-3 shadow-hard-sm">
              Updated November 2026
            </div>
            <h1 className="font-heading text-[28px] sm:text-[34px] font-extrabold leading-tight">
              Privacy Policy & Terms
            </h1>
            <p className="font-mono-ui text-[13px] text-[#111]/70 mt-2 leading-relaxed">
              Want.fun is a decentralized onchain bounty platform built on Arc. Here is how data and privacy work on our protocol.
            </p>
          </div>

          {/* Section 1 */}
          <section className="space-y-2">
            <h2 className="font-heading text-[18px] font-extrabold flex items-center gap-2">
              <span className="w-6 h-6 rounded-md bg-[#FFE600] border-[2px] border-[#111] flex items-center justify-center font-mono-bold text-[11px]">1</span>
              Onchain Transparency & Immutability
            </h2>
            <p className="font-body text-[14px] text-[#111]/85 leading-relaxed">
              When you post a bounty, submit work, or approve payouts, transactions are broadcast to the public blockchain. Your public wallet address, transaction hash, bounty descriptions, and reward amounts are permanently recorded and verifiable by anyone. Do not post confidential, proprietary, or sensitive personal information in bounty titles, descriptions, or onchain submissions.
            </p>
          </section>

          {/* Section 2 */}
          <section className="space-y-2">
            <h2 className="font-heading text-[18px] font-extrabold flex items-center gap-2">
              <span className="w-6 h-6 rounded-md bg-[#FF3E9A] text-white border-[2px] border-[#111] flex items-center justify-center font-mono-bold text-[11px]">2</span>
              Zero Personal Identification
            </h2>
            <p className="font-body text-[14px] text-[#111]/85 leading-relaxed">
              We do not collect names, email addresses, phone numbers, government IDs, or payment card details. Authentication occurs strictly via cryptographic signatures or web3 wallet connectors (e.g., Privy, MetaMask, Coinbase Wallet). We do not sell or monetize personal data.
            </p>
          </section>

          {/* Section 3 */}
          <section className="space-y-2">
            <h2 className="font-heading text-[18px] font-extrabold flex items-center gap-2">
              <span className="w-6 h-6 rounded-md bg-[#7FF3F0] border-[2px] border-[#111] flex items-center justify-center font-mono-bold text-[11px]">3</span>
              Local Storage & Client Caching
            </h2>
            <p className="font-body text-[14px] text-[#111]/85 leading-relaxed">
              Want.fun utilizes browser <code className="font-mono-ui text-[12px] bg-[#111]/10 px-1.5 py-0.5 rounded border border-[#111]/20">localStorage</code> exclusively for client-side state conveniences—such as remember-me wallet sessions, unsaved submission drafts, and recent search filters. You can clear this data at any time via your browser settings.
            </p>
          </section>

          {/* Section 4 */}
          <section className="space-y-2">
            <h2 className="font-heading text-[18px] font-extrabold flex items-center gap-2">
              <span className="w-6 h-6 rounded-md bg-[#A78BFA] text-white border-[2px] border-[#111] flex items-center justify-center font-mono-bold text-[11px]">4</span>
              Smart Contract Escrow & Risks
            </h2>
            <p className="font-body text-[14px] text-[#111]/85 leading-relaxed">
              All bounty funds are locked into non-custodial smart contracts on Arc. Users interact directly with smart contract logic. Ensure you verify recipient addresses and milestone parameters prior to signing wallet requests. The protocol interface is provided on an &ldquo;as is&rdquo; basis.
            </p>
          </section>

          {/* Section 5 */}
          <section className="space-y-2">
            <h2 className="font-heading text-[18px] font-extrabold flex items-center gap-2">
              <span className="w-6 h-6 rounded-md bg-white border-[2px] border-[#111] flex items-center justify-center font-mono-bold text-[11px]">5</span>
              Analytics & Performance
            </h2>
            <p className="font-body text-[14px] text-[#111]/85 leading-relaxed">
              We employ privacy-preserving, cookieless telemetry (such as Vercel Web Analytics) to monitor site availability, aggregate visitor counts, and page load performance. IP addresses are anonymized and no cross-site user tracking is conducted.
            </p>
          </section>

          {/* Back button at footer */}
          <div className="pt-6 border-t-[2px] border-[#111]/15 text-center">
            <button
              type="button"
              onClick={onBack}
              className="font-mono-bold text-[12px] uppercase tracking-wider bg-[#FFE600] text-[#111] border-[2.5px] border-[#111] px-6 py-2.5 rounded-full shadow-hard-sm hover:bg-[#FFE600]/90 transition-all btn-press cursor-pointer"
            >
              Return to Wall
            </button>
          </div>
        </div>
      </WindowCard>
    </motion.div>
  )
}
