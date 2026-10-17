/**
 * wagmi configuration
 * Built with Arc Studio — https://studio.arc.io
 *
 * Uses ConnectKit's getDefaultConfig so WalletConnect is fully managed by
 * ConnectKit — no separate <w3m-modal> Web Component mounts on load.
 */

import { mainnet } from 'wagmi/chains'
import { arc, arcTestnet } from 'viem/chains'
import { getDefaultConfig } from 'connectkit'
import { createConfig as createWagmiConfig, http } from 'wagmi'
import { createConfig as createPrivyWagmiConfig } from '@privy-io/wagmi'
import { registerChain } from './tracing'

// Pre-register chain RPC URLs so trace events show correct chain names immediately
registerChain(arcTestnet.id, arcTestnet.rpcUrls.default.http[0])
registerChain(arc.id, arc.rpcUrls.default.http[0])

/**
 * Google / embedded-wallet login (Privy) is switched on by setting VITE_PRIVY_APP_ID.
 * Without it the app behaves exactly as before (ConnectKit wallet connect only).
 */
export const PRIVY_APP_ID = ((import.meta.env.VITE_PRIVY_APP_ID as string | undefined) ?? '').trim()
export const PRIVY_ENABLED = PRIVY_APP_ID.length > 0

const chains = [arc, arcTestnet, mainnet] as const
const transports = {
  [arc.id]: http('https://rpc.mainnet.arc.io'),
  [arcTestnet.id]: http('https://rpc.testnet.arc.io'),
  [mainnet.id]: http(),
}

// Privy mode: Privy owns wallet connection (Google -> embedded wallet, or external wallets).
// The embedded wallet shows up to wagmi as a normal connector, so every existing
// wagmi hook (useAccount, useWriteContract, getWalletClient...) keeps working.
const privyConfig = createPrivyWagmiConfig({ chains, transports })

// Legacy mode: ConnectKit wallet connect only.
const legacyConfig = createWagmiConfig(
  getDefaultConfig({
    chains: [arc, arcTestnet, mainnet],
    transports,
    walletConnectProjectId: (import.meta.env.VITE_WALLETCONNECT_PROJECT_ID as string) ?? '',
    appName: 'Want.fun',
    appDescription: 'Post a bounty. Get it done. Lock USDC in escrow onchain.',
    appUrl: 'https://want-fun.vercel.app',
  }),
)

export const config = PRIVY_ENABLED ? privyConfig : legacyConfig

export { arc, arcTestnet, mainnet }
