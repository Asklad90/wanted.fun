import React, { useState, useEffect, useCallback } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useAccount } from 'wagmi'
import { ConnectButton } from './components/ConnectButton'
import { WallPage } from './components/WallPage'
import { BountyPage } from './components/BountyPage'
import { CreateBountyForm } from './components/CreateBountyForm'
import { ProfilePage } from './components/ProfilePage'
import { HowItWorksPage } from './components/HowItWorksPage'
import { NotFoundPage } from './components/NotFoundPage'
import { PrivacyPage } from './components/PrivacyPage'
import { Doodles } from './components/Doodles'
import { CHAIN_NAME, CONTRACT_ADDRESS, CONTRACT_DEPLOYED, getAddressUrl } from './bounty-config'
import { updatePageMeta } from './lib/meta'

type View = 'wall' | 'bounty' | 'create' | 'profile' | 'how-it-works' | 'privacy' | 'not-found'

interface ParsedRoute {
  view: View
  bountyId: bigint | null
  profileAddr: `0x${string}` | null
}

function parseRoute(): ParsedRoute {
  if (typeof window === 'undefined') {
    return { view: 'wall', bountyId: null, profileAddr: null }
  }
  const hash = window.location.hash.replace(/^#\/?/, '').trim()
  const pathname = window.location.pathname.replace(/^\//, '').trim()
  const clean = hash || pathname
  if (!clean || clean === 'wall') {
    return { view: 'wall', bountyId: null, profileAddr: null }
  }

  const parts = clean.split('/')
  const section = parts[0]?.toLowerCase()

  if (section === 'bounty') {
    if (parts[1]) {
      try {
        const id = BigInt(parts[1])
        if (id > 0n) return { view: 'bounty', bountyId: id, profileAddr: null }
      } catch {
        // not a valid bigint
      }
    }
    return { view: 'not-found', bountyId: null, profileAddr: null }
  }

  if (section === 'profile') {
    if (parts[1]) {
      const addr = parts[1].toLowerCase()
      if (/^0x[0-9a-f]{40}$/i.test(addr)) {
        return { view: 'profile', bountyId: null, profileAddr: addr as `0x${string}` }
      }
    }
    return { view: 'not-found', bountyId: null, profileAddr: null }
  }

  if (section === 'create') {
    return { view: 'create', bountyId: null, profileAddr: null }
  }

  if (section === 'how-it-works') {
    return { view: 'how-it-works', bountyId: null, profileAddr: null }
  }

  if (section === 'privacy') {
    return { view: 'privacy', bountyId: null, profileAddr: null }
  }

  return { view: 'not-found', bountyId: null, profileAddr: null }
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, ErrorBoundaryState> {
  constructor(props: { children: React.ReactNode }) {
    super(props)
    this.state = { hasError: false, error: null }
  }
  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }
  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('UI error caught by ErrorBoundary:', error, errorInfo)
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center py-20 text-center max-w-md mx-auto px-4">
          <div className="font-heading text-[24px] font-extrabold text-[#111] mb-2">Something went wrong</div>
          <p className="font-mono-ui text-[12px] text-[#111]/70 mb-4 leading-relaxed">
            {this.state.error?.message || 'An unexpected rendering error occurred.'}
          </p>
          <button
            onClick={() => {
              window.location.hash = '#/'
              window.location.reload()
            }}
            className="font-mono-bold text-[11px] uppercase tracking-wider bg-[#FFE600] border-[2px] border-[#111] px-4 py-2 rounded-full shadow-hard-sm hover:bg-[#FFE600]/80 transition-colors btn-press cursor-pointer"
          >
            Return to wall
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

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
  const [route, setRoute] = useState<ParsedRoute>(parseRoute)
  const [refreshKey, setRefreshKey] = useState(0)

  const view = route.view
  const activeBountyId = route.bountyId
  const activeProfileAddr = route.profileAddr

  useEffect(() => {
    function handleRouteChange() {
      setRoute(parseRoute())
    }
    window.addEventListener('hashchange', handleRouteChange)
    window.addEventListener('popstate', handleRouteChange)
    return () => {
      window.removeEventListener('hashchange', handleRouteChange)
      window.removeEventListener('popstate', handleRouteChange)
    }
  }, [])

  useEffect(() => {
    switch (route.view) {
      case 'create':
        updatePageMeta({
          title: 'Post a Bounty',
          description: 'Create and fund a new USDC escrow bounty onchain on Arc.',
          canonicalPath: '#/create',
        })
        break
      case 'how-it-works':
        updatePageMeta({
          title: 'How It Works',
          description: 'Learn how smart contract escrow, proof-of-work submissions, and instant USDC payouts operate on Want.fun.',
          canonicalPath: '#/how-it-works',
        })
        break
      case 'privacy':
        updatePageMeta({
          title: 'Privacy & Terms',
          description: 'Protocol terms, transparency, and data privacy policies for Want.fun onchain bounties.',
          canonicalPath: '#/privacy',
        })
        break
      case 'bounty':
        updatePageMeta({
          title: `Bounty #${route.bountyId?.toString() || ''}`,
          description: `View details, requirements, and submissions for Bounty #${route.bountyId?.toString() || ''} on Want.fun.`,
          canonicalPath: `#/bounty/${route.bountyId?.toString() || ''}`,
        })
        break
      case 'profile':
        updatePageMeta({
          title: `Profile ${route.profileAddr ? route.profileAddr.slice(0, 6) + '...' + route.profileAddr.slice(-4) : ''}`,
          description: `Onchain bounty activity and earnings history on Want.fun.`,
          canonicalPath: `#/profile/${route.profileAddr || ''}`,
        })
        break
      case 'not-found':
        updatePageMeta({
          title: '404 - Bounty Not Found',
          description: 'The requested page or bounty could not be found on Want.fun.',
        })
        break
      case 'wall':
      default:
        updatePageMeta({
          canonicalPath: '',
        })
        break
    }
  }, [route])

  const openBounty = useCallback((id: bigint) => {
    window.location.hash = `#/bounty/${id.toString()}`
  }, [])

  const openProfile = useCallback((addr: `0x${string}`) => {
    window.location.hash = `#/profile/${addr}`
  }, [])

  const openCreate = useCallback(() => {
    window.location.hash = `#/create`
  }, [])

  const openGuide = useCallback((scrollId?: string) => {
    window.location.hash = `#/how-it-works`
    if (scrollId) {
      window.setTimeout(() => document.getElementById(scrollId)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80)
    }
  }, [])

  const goBack = useCallback(() => {
    const curHash = window.location.hash
    if (curHash && curHash !== '#' && curHash !== '#/' && curHash !== '#/wall') {
      window.history.back()
    } else {
      window.location.hash = '#/'
    }
  }, [])

  const onCreated = useCallback(() => {
    setRefreshKey(k => k + 1)
    window.location.hash = '#/'
  }, [])

  const goTo = useCallback((id: string) => {
    const wasWall = route.view === 'wall'
    if (window.location.hash && window.location.hash !== '#' && window.location.hash !== '#/' && window.location.hash !== '#/wall') {
      window.location.hash = '#/'
    }
    window.setTimeout(
      () => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
      wasWall ? 0 : 450,
    )
  }, [route.view])

  return (
    <div className="min-h-dvh flex flex-col">
      <Doodles />
      {/* ─── Header ───────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 border-b-[3px] border-[#111] bg-[#111] px-4 py-3 relative">
        {/* Logo + buttons */}
        <div className="max-w-[1280px] mx-auto flex items-center justify-between gap-3">
          {/* Logo */}
          <button
            onClick={() => {
              if (window.location.hash && window.location.hash !== '#' && window.location.hash !== '#/' && window.location.hash !== '#/wall') {
                window.location.hash = '#/'
              } else {
                goTo('wall')
              }
            }}
            className="flex items-center gap-1 select-none"
            aria-label="Want.fun home"
          >
            <span className="px-[10px] py-[5px] desk:px-[14px] desk:py-[7px] text-[18px] desk:text-[26px]" style={{
              display: 'inline-block',
              color: '#000000',
              backgroundColor: '#FF3E9A',
              border: '3px solid white',
              borderRadius: '8px',
              letterSpacing: '0.08em',
              lineHeight: 1,
              transform: 'rotate(-8deg)',
              boxShadow: '3px 3px 0 white, 5px 5px 0 #FF3E9A',
              fontFamily: '"Space Mono", monospace',
              fontWeight: 900,
              textTransform: 'uppercase',
            }}>
              WANT
            </span>
            <span className="text-[34px] desk:text-[44px]" style={{
              color: '#A78BFA',
              letterSpacing: 0,
              fontFamily: '"Fredoka One", cursive',
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
              onClick={() => openGuide()}
              className={`font-mono-bold text-[13px] pb-0.5 border-b-[3px] transition-colors ${view === 'how-it-works' ? 'text-[#FFFDF0] border-[#FFE600]' : 'text-[#FFFDF0]/70 border-transparent hover:text-[#FFE600]'}`}
            >
              How it works
            </button>
          </nav>

          {/* Right: connect button with embedded profile dropdown */}
          <div className="flex items-center gap-2 min-w-0 shrink-0">
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
        <ErrorBoundary>
          <AnimatePresence mode="wait">
            {view === 'profile' && activeProfileAddr ? (
              <PageView key="profile" narrow>
                <ProfilePage
                  address={activeProfileAddr}
                  onBack={goBack}
                  onSelectBounty={openBounty}
                  onCreateBounty={openCreate}
                  onBrowseWall={() => { window.location.hash = '#/' }}
                />
              </PageView>
            ) : view === 'bounty' && activeBountyId !== null ? (
              <PageView key={`bounty-${activeBountyId}`} narrow>
                <BountyPage bountyId={activeBountyId} onBack={goBack} onDataChange={() => setRefreshKey(k => k + 1)} />
              </PageView>
            ) : view === 'create' ? (
              <PageView key="create" narrow>
                <div className="max-w-lg mx-auto">
                  <CreateBountyForm onClose={goBack} onSuccess={onCreated} />
                </div>
              </PageView>
            ) : view === 'how-it-works' ? (
              <PageView key="how-it-works" narrow>
                <HowItWorksPage onCreateBounty={openCreate} onBrowse={() => goTo('wall')} />
              </PageView>
            ) : view === 'privacy' ? (
              <PageView key="privacy" narrow>
                <PrivacyPage onBack={goBack} />
              </PageView>
            ) : view === 'not-found' ? (
              <PageView key="not-found" narrow>
                <NotFoundPage onBackToWall={() => { window.location.hash = '#/' }} onHowItWorks={() => { window.location.hash = '#/how-it-works' }} />
              </PageView>
            ) : (
              <PageView key="wall">
                <WallPage onSelectBounty={openBounty} onCreateBounty={openCreate} refreshKey={refreshKey} />
              </PageView>
            )}
          </AnimatePresence>
        </ErrorBoundary>
      </main>

      {/* ─── Footer ───────────────────────────────────────────────────────────── */}
      <footer className="border-t-[3px] border-[#111] bg-[#111] px-4 py-4 mt-auto">
        <div className="max-w-[1280px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 text-center sm:text-left">
          <span className="font-mono-ui text-[11px] text-[#FFFDF0]/50 uppercase tracking-wider">
            Text posted onchain is permanent and public. Review before submitting.
          </span>
          <span className="font-mono-ui text-[11px] text-[#FFFDF0]/30 flex items-center gap-2 flex-wrap justify-center sm:justify-end">
            <button
              onClick={() => openGuide()}
              className="text-[#FFFDF0]/60 hover:text-[#FFE600] transition-colors underline underline-offset-2 font-mono-ui cursor-pointer"
            >
              How it works
            </button>
            ·
            <button
              onClick={() => { window.location.hash = '#/privacy' }}
              className="text-[#FFFDF0]/60 hover:text-[#FFE600] transition-colors underline underline-offset-2 font-mono-ui cursor-pointer"
            >
              Privacy & Terms
            </button>
            · Want.fun · {CHAIN_NAME} · USDC
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
