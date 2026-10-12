/**
 * wagmi configuration
 * Built with Arc Studio  https://studio.arc.io
 *
 * Arc Mainnet and Arc Testnet are both registered. VITE_CHAIN_ID (see bounty-config.ts) picks which one the app uses.
 */

import { http, createConfig } from 'wagmi'
import { mainnet } from 'wagmi/chains'
import { arcTestnet } from 'viem/chains'
import { defineChain } from 'viem'
import { injected, walletConnect } from 'wagmi/connectors'
import { registerChain } from './tracing'
import { requireChain } from './onchain-facts'

// Arc Mainnet, built from the app's own chain facts (chain id, RPC, explorer) so they stay in one place.
const arcFacts = requireChain(5042)
export const arcMainnet = defineChain({
  id: arcFacts.chainId,
  name: arcFacts.name,
  nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 18 },
  rpcUrls: { default: { http: arcFacts.rpcUrls } },
  blockExplorers: { default: { name: 'Arc Explorer', url: arcFacts.explorerBase } },
})

// Pre-register chain RPC URLs so trace events show correct chain names immediately
registerChain(arcTestnet.id, arcTestnet.rpcUrls.default.http[0])
registerChain(arcMainnet.id, arcMainnet.rpcUrls.default.http[0])

// WalletConnect is optional: without a project id the app still works with browser/injected wallets.
const projectId = (import.meta.env.VITE_WALLETCONNECT_PROJECT_ID as string | undefined)?.trim()

export const config = createConfig({
  chains: [arcTestnet, arcMainnet, mainnet],
  connectors: [
    injected(),
    ...(projectId
      ? [
          walletConnect({
            projectId,
            showQrModal: false, // ConnectKit owns the modal  prevent WC from opening its own
          }),
        ]
      : []),
  ],
  transports: {
    [arcTestnet.id]: http(),
    [arcMainnet.id]: http(arcMainnet.rpcUrls.default.http[0]),
    [mainnet.id]: http(),
  },
})
