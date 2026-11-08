import { useState } from 'react'
import { ConnectKitButton } from 'connectkit'
import { usePrivy } from '@privy-io/react-auth'
import { useAccount } from 'wagmi'
import { WalletIcon } from './Icons'
import { PRIVY_ENABLED } from '../config'

interface ConnectButtonProps {
  onProfileClick?: () => void
}

const pillClass =
  'inline-flex flex-col items-center gap-1 rounded-full border-[3px] border-[#111] shadow-hard-sm btn-press bg-[#FFE600] px-4 py-2 font-mono-bold uppercase tracking-widest text-[#111] cursor-pointer'

const profileBtnClass =
  'sm:hidden font-mono-bold text-[10px] uppercase tracking-widest text-[#FFFDF0]/70 border-[2px] border-[#FFFDF0]/30 rounded-full px-2 py-1'

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
    <div className="relative flex items-center gap-2">
      {signedIn && address && onProfileClick && (
        <button onClick={onProfileClick} className={profileBtnClass}>
          Profile
        </button>
      )}
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
          <div className="absolute right-0 top-full mt-2 z-50 w-60 rounded-2xl border-[3px] border-[#111] bg-[#FFFDF0] shadow-hard-sm p-3 font-mono-bold text-[#111]">
            {user?.google?.email && (
              <p className="text-[10px] uppercase tracking-widest text-[#111]/60 mb-2 break-all normal-case">
                Google: {user.google.email}
              </p>
            )}
            <button
              onClick={copyAddress}
              className="w-full text-left text-[11px] uppercase tracking-widest rounded-xl border-[2px] border-[#111] px-3 py-2 mb-2 bg-white"
            >
              {copied ? 'Copied!' : 'Copy wallet address'}
            </button>
            <p className="text-[9px] uppercase tracking-widest text-[#111]/60 mb-2">
              Send USDC (Arc) to this address to fund bounties.
            </p>
            <button
              onClick={handleLogout}
              className="w-full text-left text-[11px] uppercase tracking-widest rounded-xl border-[2px] border-[#111] px-3 py-2 bg-[#FFE600]"
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
  return (
    <ConnectKitButton.Custom>
      {({ isConnected, show, address }) => (
        <div className="flex items-center gap-2">
          {/* Mobile: my profile icon when connected */}
          {isConnected && onProfileClick && (
            <button onClick={onProfileClick} className={profileBtnClass}>
              Profile
            </button>
          )}
          <button onClick={show} className={pillClass}>
            <span className="text-[11px] leading-none">
              {isConnected && address
                ? `${address.slice(0, 6)}...${address.slice(-4)}`
                : 'CONNECT WALLET'}
            </span>
            <WalletIcon size={18} />
          </button>
        </div>
      )}
    </ConnectKitButton.Custom>
  )
}

export function ConnectButton(props: ConnectButtonProps) {
  return PRIVY_ENABLED ? <PrivyConnectButton {...props} /> : <LegacyConnectButton {...props} />
}
