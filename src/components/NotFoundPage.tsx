import React from 'react'
import { motion } from 'framer-motion'
import { WindowCard } from './WindowCard'

interface NotFoundPageProps {
  onBackToWall: () => void
  onHowItWorks: () => void
}

export function NotFoundPage({ onBackToWall, onHowItWorks }: NotFoundPageProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="max-w-xl mx-auto py-8 sm:py-16 text-center"
    >
      <WindowCard title="404 — ROUTE NOT FOUND">
        <div className="flex flex-col items-center p-6 sm:p-10 gap-6">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full border-[2px] border-[#111] bg-[#FF3E9A] text-white shadow-hard-sm">
            <span className="font-mono-bold text-[11px] uppercase tracking-wider">Error 404</span>
          </div>

          {/* Big graphic 404 */}
          <div className="select-none my-1">
            <span
              className="text-[72px] sm:text-[96px] font-heading font-extrabold leading-none tracking-tight text-[#111]"
              style={{
                textShadow: '5px 5px 0 #FFE600, 8px 8px 0 #111',
              }}
            >
              404
            </span>
          </div>

          <div className="space-y-2">
            <h2 className="font-heading text-[22px] sm:text-[28px] font-extrabold text-[#111]">
              Bounty Lost in the Mempool
            </h2>
            <p className="font-mono-ui text-[13px] sm:text-[14px] text-[#111]/70 max-w-md mx-auto leading-relaxed">
              The route, bounty ID, or account you are looking for does not exist on this chain, was reclaimed, or was mistyped.
            </p>
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 w-full pt-4 border-t-[2px] border-[#111]/15">
            <button
              type="button"
              onClick={onBackToWall}
              className="w-full sm:w-auto font-mono-bold text-[12px] uppercase tracking-wider bg-[#FFE600] text-[#111] border-[2.5px] border-[#111] px-6 py-3 rounded-full shadow-hard-sm hover:bg-[#FFE600]/90 transition-all btn-press cursor-pointer"
            >
              ← Return to Bounty Wall
            </button>
            <button
              type="button"
              onClick={onHowItWorks}
              className="w-full sm:w-auto font-mono-bold text-[12px] uppercase tracking-wider bg-white text-[#111] border-[2px] border-[#111] px-6 py-3 rounded-full shadow-hard-sm hover:bg-[#FFFDF0] transition-colors btn-press cursor-pointer"
            >
              How It Works
            </button>
          </div>
        </div>
      </WindowCard>
    </motion.div>
  )
}
