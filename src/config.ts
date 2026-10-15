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
import { createConfig, http } from 'wagmi'
import { registerChain } from './tracing'

// Pre-register chain RPC URLs so trace events show correct chain names immediately
registerChain(arcTestnet.id, arcTestnet.rpcUrls.default.http[0])
registerChain(arc.id, arc.rpcUrls.default.http[0])

export const config = createConfig(
  getDefaultConfig({
    chains: [arc, arcTestnet, mainnet],
    transports: {
      [arc.id]: http('https://rpc.mainnet.arc.io'),
      [arcTestnet.id]: http('https://rpc.testnet.arc.io'),
      [mainnet.id]: http(),
    },
    walletConnectProjectId: (import.meta.env.VITE_WALLETCONNECT_PROJECT_ID as string) ?? '',
    appName: 'Want.fun',
    appDescription: 'Post a bounty. Get it done. Lock USDC in escrow onchain.',
    appUrl: 'https://want-fun.vercel.app',
  }),
)
