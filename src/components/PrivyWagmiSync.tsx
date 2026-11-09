import { useEffect, useRef } from 'react'
import { usePrivy, useWallets, useCreateWallet } from '@privy-io/react-auth'
import { useSetActiveWallet } from '@privy-io/wagmi'
import { useAccount } from 'wagmi'

/**
 * Synchronizes Privy's authenticated wallet with Wagmi's active connector.
 * This ensures wagmi hooks (useAccount, useWriteContract, useSignMessage)
 * immediately detect the active embedded or connected wallet.
 */
export function PrivyWagmiSync() {
  const { ready, authenticated, user } = usePrivy()
  const { wallets } = useWallets()
  const { setActiveWallet } = useSetActiveWallet()
  const { address, isConnected } = useAccount()
  const { createWallet } = useCreateWallet()
  const isCreatingWallet = useRef(false)

  // 1. Auto-create embedded wallet if user is authenticated (e.g. via Google) but has no wallet yet
  useEffect(() => {
    if (!ready || !authenticated || isCreatingWallet.current) return
    const hasWallet = Boolean(user?.wallet || wallets.length > 0)
    if (!hasWallet) {
      isCreatingWallet.current = true
      createWallet()
        .catch((err: unknown) => {
          console.warn('[PrivyWagmiSync] createWallet error:', err)
        })
        .finally(() => {
          isCreatingWallet.current = false
        })
    }
  }, [ready, authenticated, user, wallets.length, createWallet])

  // 2. Synchronize active wallet with Wagmi so useAccount().address gets populated
  useEffect(() => {
    if (!ready || !authenticated || wallets.length === 0) return

    // If Wagmi doesn't have an address yet, or Wagmi is disconnected
    if (!address || !isConnected) {
      const embeddedWallet = wallets.find((w) => w.walletClientType === 'privy')
      const target = embeddedWallet || wallets[0]
      if (target) {
        setActiveWallet(target).catch((err: unknown) => {
          console.warn('[PrivyWagmiSync] setActiveWallet error:', err)
        })
      }
    }
  }, [ready, authenticated, wallets, address, isConnected, setActiveWallet])

  return null
}
