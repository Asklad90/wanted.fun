import React, { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useAccount } from 'wagmi'
import { ConnectButton } from './components/ConnectButton'
import { WallPage } from './components/WallPage'
import { BountyPage } from './components/BountyPage'
import { CreateBountyForm } from './components/CreateBountyForm'
import { ProfilePage } from './components/ProfilePage'
import { Doodles } from './components/Doodles'
import { CHAIN_NAME, CONTRACT_ADDRESS, CONTRACT_DEPLOYED, getAddressUrl } from './bounty-config'

type View = 'wall' | 'bounty' | 'create' | 'profile'

const pageVariants = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.22, ease: [0.25, 0.46, 0.45, 0.94] } },
  exit:    { opacity: 0, y: -8, transition: { duration: 0.15, ease: 'easeIn' } },
}

function PageView({ children, narrow = false }: { children: React.ReactNode; narrow?: boolean }) {
  return (
    <motion.div variants={pageVariants} initial="initial" animate="animate" exit="exit">
      {narrow ? <div className="max-w-[992px] mx-auto w-full">{children}</div> : children}
    </motion.div>
  )
}

export default function App() {
  const { address: connectedAddr } = useAccount()
  const [view, setView] = useState<View>('wall')
  const [activeBountyId, setActiveBountyId] = useState<bigint | null>(null)
  const [activeProfileAddr, setActiveProfileAddr] = useState<`0x${string}` | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)

  function openBounty(id: bigint) { setActiveBountyId(id); setView('bounty') }
  function openProfile(addr: `0x${string}`) { setActiveProfileAddr(addr); setView('profile') }
  function goBack() { setView('wall'); setActiveBountyId(null); setActiveProfileAddr(null) }
  function openCreate() { setView('create') }
  function onCreated() { setRefreshKey(k => k + 1); setView('wall') }
  function goTo(id: string) {
    const wasWall = view === 'wall'
    setView('wall'); setActiveBountyId(null); setActiveProfileAddr(null)
    window.setTimeout(
      () => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
      wasWall ? 0 : 450,
    )
  }

  return (
    <div className="min-h-dvh flex flex-col">
      <Doodles />
      {/* ─── Header ───────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 border-b-[3px] border-[#111] bg-[#111] px-4 py-3 relative">
        {/* Logo + buttons */}
        <div className="max-w-[1280px] mx-auto flex items-center justify-between gap-3">
          {/* Logo */}
          <button
            onClick={() => { setView('wall') }}
            className="flex items-center gap-1 select-none"
            aria-label="Want.fun home"
          >
            <span style={{
              display: 'inline-block',
              color: '#000000',
              backgroundColor: '#FF3E9A',
              border: '3px solid white',
              borderRadius: '8px',
              padding: '5px 10px',
              letterSpacing: '0.08em',
              lineHeight: 1,
              transform: 'rotate(-8deg)',
              boxShadow: '3px 3px 0 white, 5px 5px 0 #FF3E9A',
              fontFamily: '"Space Mono", monospace',
              fontWeight: 900,
              fontSize: '18px',
              textTransform: 'uppercase',
            }}>
              WANT
            </span>
            <span style={{
              color: '#A78BFA',
              letterSpacing: 0,
              fontFamily: '"Fredoka One", cursive',
              fontSize: '34px',
              lineHeight: 1,
              marginLeft: '4px',
              WebkitTextStroke: '3px #111',
              paintOrder: 'stroke fill',
            }}>
              .fun
            </span>
          </button>

          {/* Nav (desktop) */}
          <nav className="hidden desk:flex items-center gap-8" aria-label="Main">
            <button
              onClick={() => goTo('wall')}
              className={`font-mono-bold text-[13px] pb-0.5 border-b-[3px] transition-colors ${view === 'wall' ? 'text-[#FFFDF0] border-[#FFE600]' : 'text-[#FFFDF0]/70 border-transparent hover:text-[#FFE600]'}`}
            >
              Bounty Wall
            </button>
            <button
              onClick={() => goTo('how-it-works')}
              className="font-mono-bold text-[13px] pb-0.5 border-b-[3px] border-transparent text-[#FFFDF0]/70 hover:text-[#FFE600] transition-colors"
            >
              How it works
            </button>
          </nav>

          {/* Right: my profile + connect */}
          <div className="flex items-center gap-2 min-w-0 shrink-0">
            {connectedAddr && (
              <button
                onClick={() => openProfile(connectedAddr)}
                className="hidden sm:flex items-center gap-1.5 font-mono-bold text-[11px] uppercase tracking-widest bg-[#C6F23A] text-[#111] border-[2px] border-[#FFFDF0]/40 rounded-full px-3 py-1.5 hover:border-[#C6F23A] transition-colors shadow-hard-sm btn-press"
              >
                My Profile →
              </button>
            )}
            <ConnectButton onProfileClick={connectedAddr ? () => openProfile(connectedAddr) : undefined} />
          </div>
        </div>

        {/* Arc badge — absolutely positioned, centred on the bottom border, adds zero height */}
        <a
          href="https://arc.io"
          target="_blank"
          rel="noopener noreferrer"
          title={`Built on ${CHAIN_NAME}`}
          style={{
            position: 'absolute',
            bottom: 0,
            left: '50%',
            transform: 'translate(-50%, 50%)',
            zIndex: 60,
            display: 'inline-flex',
            alignItems: 'center',
            gap: '5px',
            padding: '3px 12px 3px 8px',
            borderRadius: '999px',
            border: '1.5px solid rgba(96,165,250,0.5)',
            background: 'rgba(15,23,60,0.95)',
            backdropFilter: 'blur(10px)',
            boxShadow: '0 0 10px 2px rgba(96,165,250,0.45), 0 0 28px 4px rgba(59,130,246,0.22)',
            textDecoration: 'none',
            transition: 'box-shadow 0.2s ease, border-color 0.2s ease',
          }}
          onMouseEnter={e => {
            const el = e.currentTarget
            el.style.boxShadow = '0 0 18px 4px rgba(96,165,250,0.65), 0 0 40px 8px rgba(59,130,246,0.32)'
            el.style.borderColor = 'rgba(147,197,253,0.75)'
          }}
          onMouseLeave={e => {
            const el = e.currentTarget
            el.style.boxShadow = '0 0 10px 2px rgba(96,165,250,0.45), 0 0 28px 4px rgba(59,130,246,0.22)'
            el.style.borderColor = 'rgba(96,165,250,0.5)'
          }}
        >
          <svg width="10" height="12" viewBox="0 0 20 22" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <path d="M0 21.5001C0.167192 16.2366 1.02308 11.3243 2.45378 7.50459C4.26573 2.66517 6.88869 0 9.83904 0C12.7894 0 15.412 2.66517 17.2243 7.50459C18.1669 10.0216 18.8605 13.0121 19.2713 16.2655C19.3081 16.556 19.3393 16.8513 19.3714 17.146C19.3819 17.1642 19.3881 17.1811 19.386 17.1949C19.386 17.1949 19.6275 18.7674 19.6788 21.5001H19.6515C19.2934 21.1937 15.0694 17.7329 8.06739 18.735C8.17304 17.4996 8.31833 16.2974 8.50603 15.1452C8.51562 15.0863 8.52671 15.0294 8.53649 14.9709C11.2828 14.8846 13.6866 15.2171 15.5299 15.6529C15.5231 15.6073 15.5173 15.5603 15.5103 15.5149C15.1314 13.0547 14.5724 10.8024 13.8517 8.87761C12.6732 5.73037 11.1354 3.77496 9.83904 3.77496C8.54269 3.77496 7.00493 5.73037 5.82649 8.87761C5.54123 9.63889 5.28154 10.4508 5.04866 11.3071C4.72126 12.507 4.44621 13.7934 4.22654 15.1451C3.90141 17.1412 3.69827 19.2821 3.62345 21.5001H0Z" fill="rgba(147,197,253,1)"/>
          </svg>
          <span style={{
            fontFamily: '"Space Mono", monospace',
            fontWeight: 700,
            fontSize: '9px',
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: 'rgba(186,230,255,0.95)',
            whiteSpace: 'nowrap',
          }}>
            Built on Arc
          </span>
        </a>
      </header>

      {/* ─── Main ─────────────────────────────────────────────────────────────── */}
      <main className="flex-1 max-w-[1280px] mx-auto w-full px-4 py-6">
        <AnimatePresence mode="wait">
          {view === 'profile' && activeProfileAddr ? (
            <PageView key="profile" narrow>
              <ProfilePage address={activeProfileAddr} onBack={goBack} onSelectBounty={openBounty} />
            </PageView>
          ) : view === 'bounty' && activeBountyId !== null ? (
            <PageView key={`bounty-${activeBountyId}`} narrow>
              <BountyPage bountyId={activeBountyId} onBack={goBack} onDataChange={() => setRefreshKey(k => k + 1)} />
            </PageView>
          ) : view === 'create' ? (
            <PageView key="create" narrow>
              <div className="max-w-lg mx-auto">
                <CreateBountyForm onClose={() => setView('wall')} onSuccess={onCreated} />
              </div>
            </PageView>
          ) : (
            <PageView key="wall">
              <WallPage onSelectBounty={openBounty} onCreateBounty={openCreate} refreshKey={refreshKey} />
            </PageView>
          )}
        </AnimatePresence>
      </main>

      {/* ─── Footer ───────────────────────────────────────────────────────────── */}
      <footer className="border-t-[3px] border-[#111] bg-[#111] px-4 py-4 mt-auto">
        <div className="max-w-[1280px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 text-center sm:text-left">
          <span className="font-mono-ui text-[11px] text-[#FFFDF0]/50 uppercase tracking-wider">
            Text posted onchain is permanent and public. Review before submitting.
          </span>
          <span className="font-mono-ui text-[11px] text-[#FFFDF0]/30 flex items-center gap-2 flex-wrap justify-center sm:justify-end">
            Want.fun · {CHAIN_NAME} · USDC
            {CONTRACT_DEPLOYED && (
              <a
                href={getAddressUrl(CONTRACT_ADDRESS)}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#C6F23A]/60 hover:text-[#C6F23A] transition-colors underline underline-offset-2"
              >
                Verify contract ↗
              </a>
            )}
          </span>
        </div>
      </footer>
    </div>
  )
}
