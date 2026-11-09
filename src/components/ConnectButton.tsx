import { useState } from 'react'
import { ConnectKitButton } from 'connectkit'
import { usePrivy } from '@privy-io/react-auth'
import { useAccount, useDisconnect } from 'wagmi'
import { WalletIcon } from './Icons'
import { PRIVY_ENABLED } from '../config'

interface ConnectButtonProps {
  onProfileClick?: () => void
}

const pillClass =
  'inline-flex flex-col items-center gap-1 rounded-full border-[3px] border-[#111] shadow-hard-sm btn-press bg-[#FFE600] px-4 py-2 font-mono-bold uppercase tracking-widest text-[#111] cursor-pointer'

/** Sign in with Google (auto-creates a wallet) or connect an existing wallet — powered by Privy. */
function PrivyConnectButton({ onProfileClick }: ConnectButtonProps) {
  const { ready, authenticated, login, logout, user } = usePrivy()
  const { address } = useAccount()
  const [menuOpen, setMenuOpen] = useState(false)
  const [copied, setCopied] = useState(false)

  const signedIn = ready && authenticated
  const label = !ready
    ? '...'
    : !signedIn
      ? 'SIGN IN'
      : address
        ? `${address.slice(0, 6)}...${address.slice(-4)}`
        : 'SETTING UP...'

  const copyAddress = async () => {
    if (!address) return
    try {
      await navigator.clipboard.writeText(address)
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
        onClick={() => (signedIn ? setMenuOpen(o => !o) : login())}
        disabled={!ready}
        className={pillClass}
      >
        <span className="text-[11px] leading-none">{label}</span>
        <WalletIcon size={18} />
      </button>

      {menuOpen && signedIn && (
        <>
          {/* click-away layer */}
          <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
          <div className="absolute right-0 top-full mt-2 z-50 w-60 rounded-2xl border-[3px] border-[#111] bg-[#FFFDF0] shadow-hard p-3 font-mono-bold text-[#111]">
            {user?.google?.email && (
              <p className="text-[10px] uppercase tracking-widest text-[#111]/60 mb-2 break-all normal-case">
                Google: {user.google.email}
              </p>
            )}

            {onProfileClick && (
              <button
                onClick={() => {
                  setMenuOpen(false)
                  onProfileClick()
                }}
                className="w-full text-left text-[11px] uppercase tracking-widest rounded-xl border-[2px] border-[#111] px-3 py-2 mb-2 bg-[#FF3E9A] text-white hover:bg-[#FF3E9A]/90 transition-colors shadow-hard-sm cursor-pointer flex items-center justify-between"
              >
                <span>My Profile</span>
                <span>→</span>
              </button>
            )}

            <button
              onClick={copyAddress}
              className="w-full text-left text-[11px] uppercase tracking-widest rounded-xl border-[2px] border-[#111] px-3 py-2 mb-2 bg-white hover:bg-[#f0ede0] transition-colors cursor-pointer"
            >
              {copied ? 'Copied!' : 'Copy wallet address'}
            </button>
            <p className="text-[9px] uppercase tracking-widest text-[#111]/60 mb-2">
              Send USDC (Arc) to this address to fund bounties.
            </p>
            <button
              onClick={handleLogout}
              className="w-full text-left text-[11px] uppercase tracking-widest rounded-xl border-[2px] border-[#111] px-3 py-2 bg-[#FFE600] hover:bg-[#FFE600]/80 transition-colors cursor-pointer"
            >
              Log out
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
            <button onClick={show} className={pillClass}>
              <span className="text-[11px] leading-none">CONNECT WALLET</span>
              <WalletIcon size={18} />
            </button>
          )
        }

        return (
          <div className="relative flex items-center">
            <button onClick={() => setMenuOpen(o => !o)} className={pillClass}>
              <span className="text-[11px] leading-none">
                {`${address.slice(0, 6)}...${address.slice(-4)}`}
              </span>
              <WalletIcon size={18} />
            </button>

            {menuOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
                <div className="absolute right-0 top-full mt-2 z-50 w-60 rounded-2xl border-[3px] border-[#111] bg-[#FFFDF0] shadow-hard p-3 font-mono-bold text-[#111]">
                  {onProfileClick && (
                    <button
                      onClick={() => {
                        setMenuOpen(false)
                        onProfileClick()
                      }}
                      className="w-full text-left text-[11px] uppercase tracking-widest rounded-xl border-[2px] border-[#111] px-3 py-2 mb-2 bg-[#FF3E9A] text-white hover:bg-[#FF3E9A]/90 transition-colors shadow-hard-sm cursor-pointer flex items-center justify-between"
                    >
                      <span>My Profile</span>
                      <span>→</span>
                    </button>
                  )}

                  <button
                    onClick={() => copyAddress(address)}
                    className="w-full text-left text-[11px] uppercase tracking-widest rounded-xl border-[2px] border-[#111] px-3 py-2 mb-2 bg-white hover:bg-[#f0ede0] transition-colors cursor-pointer"
                  >
                    {copied ? 'Copied!' : 'Copy wallet address'}
                  </button>

                  <button
                    onClick={() => {
                      setMenuOpen(false)
                      show?.()
                    }}
                    className="w-full text-left text-[11px] uppercase tracking-widest rounded-xl border-[2px] border-[#111] px-3 py-2 mb-2 bg-white hover:bg-[#f0ede0] transition-colors cursor-pointer"
                  >
                    Wallet Details
                  </button>

                  <button
                    onClick={() => {
                      setMenuOpen(false)
                      disconnect()
                    }}
                    className="w-full text-left text-[11px] uppercase tracking-widest rounded-xl border-[2px] border-[#111] px-3 py-2 bg-[#FFE600] hover:bg-[#FFE600]/80 transition-colors cursor-pointer"
                  >
                    Disconnect
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
