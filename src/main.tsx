/*
 *  ███████╗████████╗██╗   ██╗██████╗ ██╗ ██████╗
 *  ██╔════╝╚══██╔══╝██║   ██║██╔══██╗██║██╔═══██╗
 *  ███████╗   ██║   ██║   ██║██║  ██║██║██║   ██║
 *  ╚════██║   ██║   ██║   ██║██║  ██║██║██║   ██║
 *  ███████║   ██║   ╚██████╔╝██████╔╝██║╚██████╔╝
 *  ╚══════╝   ╚═╝    ╚═════╝ ╚═════╝ ╚═╝ ╚═════╝
 *
 *  Built with Arc Studio
 *  https://studio.arc.io
 */

import './tracing'
import './console-capture'

// Vercel Web Analytics runtime injection (Item #12)
if (typeof window !== 'undefined' && window.location.hostname !== 'localhost') {
  const el = document.createElement('script')
  el.src = '/_vercel/insights/script.js'
  el.defer = true
  document.head.appendChild(el)
}

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { WagmiProvider } from 'wagmi'
import { WagmiProvider as PrivyWagmiProvider } from '@privy-io/wagmi'
import { PrivyProvider } from '@privy-io/react-auth'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ConnectKitProvider } from 'connectkit'
import { Toaster } from 'sonner'
import { config, PRIVY_ENABLED, PRIVY_APP_ID, arc, arcTestnet, mainnet } from './config'
import { PrivyWagmiSync } from './components/PrivyWagmiSync'
import App from './App'
import './index.css'

const queryClient = new QueryClient()



const app = PRIVY_ENABLED ? (
  // Sign in with Google (creates a wallet automatically) OR connect an existing wallet.
  <PrivyProvider
    appId={PRIVY_APP_ID}
    config={{
      loginMethods: ['google', 'wallet'],
      appearance: {
        theme: 'light',
        accentColor: '#FFE600',
        showWalletLoginFirst: false,
      },
      // Google users get an embedded wallet; people who connect their own wallet don't get a second one
      embeddedWallets: { ethereum: { createOnLogin: 'users-without-wallets' } },
      defaultChain: arc,
      supportedChains: [arc, arcTestnet, mainnet],
    }}
  >
    <QueryClientProvider client={queryClient}>
      <PrivyWagmiProvider config={config}>
        <PrivyWagmiSync />
        <App />
        <Toaster position="top-center" />
      </PrivyWagmiProvider>
    </QueryClientProvider>
  </PrivyProvider>
) : (
  <WagmiProvider config={config}>
    <QueryClientProvider client={queryClient}>
      <ConnectKitProvider
        options={{
          hideNoWalletCTA: false,
          walletConnectCTA: 'link',
          enforceSupportedChains: false,
        }}
      >
        <App />
        <Toaster position="top-center" />
      </ConnectKitProvider>
    </QueryClientProvider>
  </WagmiProvider>
)

createRoot(document.getElementById('root')!).render(<StrictMode>{app}</StrictMode>)
