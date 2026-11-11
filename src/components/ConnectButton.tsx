import { useState, useEffect } from 'react'
import { ConnectKitButton } from 'connectkit'
import { usePrivy, useWallets } from '@privy-io/react-auth'
import { useSetActiveWallet } from '@privy-io/wagmi'
import { useAccount, useDisconnect } from 'wagmi'
import { WalletIcon } from './Icons'
import { PRIVY_ENABLED } from '../config'

interface ConnectButtonProps {
  onProfileClick?: (addr?: `0x${string}`) => void
}

const pillClass =
  'inline-flex items-center gap-2 rounded-full border-[2.5px] border-white bg-[#FFE600] px-3.5 sm:px-4 py-2 font-mono-bold uppercase tracking-wider text-[#111] shadow-[3px_3px_0_#FF3E9A] hover:shadow-[4px_4px_0_#7FF3F0] hover:-translate-y-0.5 active:translate-y-0.5 active:shadow-none transition-all cursor-pointer min-h-[40px]'

/** Sign in with Google (auto-creates a wallet) or connect an existing wallet — powered by Privy. */
function PrivyConnectButton({ onProfileClick }: ConnectButtonProps) {
  const { ready, authenticated, login, logout, user } = usePrivy()
  const { wallets } = useWallets()
  const { setActiveWallet } = useSetActiveWallet()
  const { address } = useAccount()
  const [menuOpen, setMenuOpen] = useState(false)
  const [copied, setCopied] = useState(false)

  const signedIn = ready && authenticated

  // Fallback chain: wagmi address -> Privy primary wallet -> first linked wallet
  const rawAddr = address || user?.wallet?.address || wallets[0]?.address
  const activeAddress = rawAddr
    ? (rawAddr.startsWith('0x') ? (rawAddr as `0x${string}`) : (`0x${rawAddr}` as `0x${string}`))
    : undefined

  // Sync active wallet with Wagmi connector
  useEffect(() => {
    if (ready && authenticated && wallets.length > 0 && !address) {
      const embedded = wallets.find((w) => w.walletClientType === 'privy')
      const target = embedded || wallets[0]
      if (target) {
        setActiveWallet(target).catch(() => {})
      }
    }
  }, [ready, authenticated, wallets, address, setActiveWallet])

  const label = !ready
    ? '...'
    : !signedIn
      ? 'SIGN IN'
      : activeAddress
        ? `${activeAddress.slice(0, 6)}…${activeAddress.slice(-4)}`
        : 'SETTING UP...'

  const copyAddress = async () => {
    if (!activeAddress) return
    try {
      await navigator.clipboard.writeText(activeAddress)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* clipboard blocked — ignore */
    }
  }

  const handleLogout = async () => {
    setMenuOpen(false)
    await logout()
  }

  return (
    <div className="relative flex items-center">
      <button
        type="button"
        onClick={() => (signedIn ? setMenuOpen(o => !o) : login())}
        disabled={!ready}
        aria-expanded={menuOpen}
        aria-haspopup="menu"
        className={pillClass}
      >
        {signedIn && (
          <span className="w-2 h-2 rounded-full bg-[#16A34A] border border-[#111] shrink-0" aria-hidden="true" />
        )}
        <WalletIcon size={16} />
        <span className="text-[11px] sm:text-[12px] leading-none">{label}</span>
        {signedIn && (
          <svg
            width="10"
            height="10"
            viewBox="0 0 12 12"
            fill="none"
            aria-hidden="true"
            className={`transition-transform duration-150 ${menuOpen ? 'rotate-180' : ''}`}
          >
            <path d="M2.5 4.5L6 8L9.5 4.5" stroke="#111" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </button>

      {menuOpen && signedIn && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
          <div
            role="menu"
            className="absolute right-0 top-full mt-2.5 z-50 w-64 rounded-2xl border-[3px] border-[#111] bg-[#FFFDF0] shadow-hard p-3.5 font-mono-bold text-[#111] animate-bounce-in"
          >
            <div className="flex items-center justify-between gap-2 pb-2.5 mb-2.5 border-b-[2px] border-[#111]/15">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="w-2 h-2 rounded-full bg-[#16A34A] border border-[#111] shrink-0" />
                <span className="text-[10px] uppercase tracking-widest text-[#111]/70 truncate">
                  {user?.google?.email ? user.google.email : 'Connected Wallet'}
                </span>
              </div>
            </div>

            {onProfileClick && (
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setMenuOpen(false)
                  onProfileClick(activeAddress)
                }}
                className="w-full text-left text-[11px] uppercase tracking-widest rounded-xl border-[2.5px] border-[#111] px-3.5 py-2.5 mb-2 bg-[#FF3E9A] text-white hover:bg-[#FF3E9A]/90 transition-all shadow-hard-sm btn-press cursor-pointer flex items-center justify-between"
              >
                <span>My Profile &amp; Stats</span>
                <span aria-hidden="true">→</span>
              </button>
            )}

            <button
              type="button"
              role="menuitem"
              onClick={copyAddress}
              className="w-full text-left text-[11px] uppercase tracking-widest rounded-xl border-[2.5px] border-[#111] px-3.5 py-2 mb-2 bg-white hover:bg-[#FFE600]/40 transition-colors shadow-hard-xs cursor-pointer flex items-center justify-between"
            >
              <span>{copied ? 'Address Copied!' : 'Copy Wallet Address'}</span>
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <rect x="5" y="5" width="9" height="9" rx="1.5" stroke="#111" strokeWidth="1.6" />
                <path d="M4 11H3C2.4 11 2 10.6 2 10V3C2 2.4 2.4 2 3 2H10C10.6 2 11 2.4 11 3V4" stroke="#111" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
            </button>

            <p className="font-mono-ui text-[10px] leading-snug text-[#111]/65 mb-2.5 px-1">
              Fund this address with USDC on Arc to post bounties.
            </p>

            <button
              type="button"
              role="menuitem"
              onClick={handleLogout}
              className="w-full text-left text-[11px] uppercase tracking-widest rounded-xl border-[2.5px] border-[#111] px-3.5 py-2 bg-[#FFE600] hover:bg-[#FFE600]/80 transition-colors shadow-hard-xs cursor-pointer flex items-center justify-between"
            >
              <span>Log Out</span>
              <span aria-hidden="true">×</span>
            </button>
          </div>
        </>
      )}
    </div>
  )
}

/** Original wallet-only connect (used when Privy isn't configured). */
function LegacyConnectButton({ onProfileClick }: ConnectButtonProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const { disconnect } = useDisconnect()

  const copyAddress = async (addr: string) => {
    try {
      await navigator.clipboard.writeText(addr)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* clipboard blocked */
    }
  }

  return (
    <ConnectKitButton.Custom>
      {({ isConnected, show, address }) => {
        if (!isConnected || !address) {
          return (
            <button type="button" onClick={show} className={pillClass}>
              <WalletIcon size={16} />
              <span className="text-[11px] sm:text-[12px] leading-none">CONNECT WALLET</span>
            </button>
          )
        }

        return (
          <div className="relative flex items-center">
            <button
              type="button"
              onClick={() => setMenuOpen(o => !o)}
              aria-expanded={menuOpen}
              aria-haspopup="menu"
              className={pillClass}
            >
              <span className="w-2 h-2 rounded-full bg-[#16A34A] border border-[#111] shrink-0" aria-hidden="true" />
              <WalletIcon size={16} />
              <span className="text-[11px] sm:text-[12px] leading-none">
                {`${address.slice(0, 6)}…${address.slice(-4)}`}
              </span>
            </button>

            {menuOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
                <div
                  role="menu"
                  className="absolute right-0 top-full mt-2.5 z-50 w-64 rounded-2xl border-[3px] border-[#111] bg-[#FFFDF0] shadow-hard p-3.5 font-mono-bold text-[#111] animate-bounce-in"
                >
                  {onProfileClick && (
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setMenuOpen(false)
                        onProfileClick(address as `0x${string}`)
                      }}
                      className="w-full text-left text-[11px] uppercase tracking-widest rounded-xl border-[2.5px] border-[#111] px-3.5 py-2.5 mb-2 bg-[#FF3E9A] text-white hover:bg-[#FF3E9A]/90 transition-all shadow-hard-sm btn-press cursor-pointer flex items-center justify-between"
                    >
                      <span>My Profile &amp; Stats</span>
                      <span aria-hidden="true">→</span>
                    </button>
                  )}

                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => copyAddress(address)}
                    className="w-full text-left text-[11px] uppercase tracking-widest rounded-xl border-[2.5px] border-[#111] px-3.5 py-2 mb-2 bg-white hover:bg-[#FFE600]/40 transition-colors shadow-hard-xs cursor-pointer flex items-center justify-between"
                  >
                    <span>{copied ? 'Address Copied!' : 'Copy Wallet Address'}</span>
                    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                      <rect x="5" y="5" width="9" height="9" rx="1.5" stroke="#111" strokeWidth="1.6" />
                      <path d="M4 11H3C2.4 11 2 10.6 2 10V3C2 2.4 2.4 2 3 2H10C10.6 2 11 2.4 11 3V4" stroke="#111" strokeWidth="1.6" strokeLinecap="round" />
                    </svg>
                  </button>

                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setMenuOpen(false)
                      show?.()
                    }}
                    className="w-full text-left text-[11px] uppercase tracking-widest rounded-xl border-[2.5px] border-[#111] px-3.5 py-2 mb-2 bg-white hover:bg-[#FFE600]/40 transition-colors shadow-hard-xs cursor-pointer"
                  >
                    Wallet Details
                  </button>

                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setMenuOpen(false)
                      disconnect()
                    }}
                    className="w-full text-left text-[11px] uppercase tracking-widest rounded-xl border-[2.5px] border-[#111] px-3.5 py-2 bg-[#FFE600] hover:bg-[#FFE600]/80 transition-colors shadow-hard-xs cursor-pointer flex items-center justify-between"
                  >
                    <span>Disconnect</span>
                    <span aria-hidden="true">×</span>
                  </button>
                </div>
              </>
            )}
          </div>
        )
      }}
    </ConnectKitButton.Custom>
  )
}

export function ConnectButton(props: ConnectButtonProps) {
  return PRIVY_ENABLED ? <PrivyConnectButton {...props} /> : <LegacyConnectButton {...props} />
}
