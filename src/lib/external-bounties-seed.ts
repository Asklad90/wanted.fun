export interface ExternalBounty {
  id: string
  tweet_id: string
  title: string
  description: string
  /** Prize per winner in 6-decimal USDC units (e.g. 500_000_000 = $500.00) */
  reward_usdc: number | string
  reward_label: string
  max_winners: number
  /** Unix timestamp (seconds) */
  deadline: number | string
  poster_handle: string
  poster_name: string
  verified_source: string
  tweet_url: string
  participation_url: string
  category: 'dev' | 'design' | 'content' | 'growth'
  requirements_summary: string
  created_at: number | string
}

/**
 * Deterministic 0x40 hex address derived from an external poster handle so
 * PixelAvatar renders a unique retro avatar for each external creator.
 */
export function handleToPseudoAddress(handle: string): string {
  const clean = handle.toLowerCase().replace(/[^a-z0-9]/g, '') || 'external'
  let hex = ''
  for (let i = 0; i < 40; i++) {
    const code = clean.charCodeAt(i % clean.length) + i * 7
    hex += (code % 16).toString(16)
  }
  return `0x${hex}`
}

export function getFallbackExternalBounties(nowSec = Math.floor(Date.now() / 1000)): ExternalBounty[] {
  const bucketSec = Math.floor(nowSec / 21600) * 21600

  const specs: Array<{
    slug: string
    tweetId: string
    title: string
    description: string
    rewardUsd: number
    rewardLabel: string
    maxWinners: number
    hoursLeft: number
    posterHandle: string
    posterName: string
    verifiedSource: string
    tweetUrl: string
    participationUrl: string
    category: 'dev' | 'design' | 'content' | 'growth'
    requirementsSummary: string
  }> = [
    {
      slug: 'ext-circle-cctp-widget',
      tweetId: '189401209841201',
      title: 'Build a Drop-In Cross-Chain USDC Checkout Widget with Circle CCTP v2',
      description:
        'We are looking for a clean, open-source React component that lets any web3 app accept USDC from Base, Arbitrum, or Optimism and settle natively via Circle CCTP v2.\n\nDeliverables:\n• Published npm package or clean GitHub template repo\n• Live interactive demo deployed on Vercel\n• 60-second walkthrough video showing a fast transfer flow\n\nGuaranteed prize pool hosted by the ecosystem developer grants team.',
      rewardUsd: 1500,
      rewardLabel: 'USDC',
      maxWinners: 2,
      hoursLeft: 138,
      posterHandle: 'circle_devs',
      posterName: 'Circle Developer Ecosystem',
      verifiedSource: 'Verified Org',
      tweetUrl: 'https://x.com/circle',
      participationUrl: 'https://www.circle.com/en/developers',
      category: 'dev',
      requirementsSummary: 'Open-source GitHub repo (MIT license) + live Vercel preview link + 60s demo video.',
    },
    {
      slug: 'ext-superteam-solana-blinks',
      tweetId: '189401209841202',
      title: 'Design & Ship a Viral Solana Actions / Blinks Mini-App for Social Feeds',
      description:
        'Create a working Solana Action (Blink) that unfurls directly inside social posts and enables 1-click micro-tipping or prediction voting in USDC.\n\nJudging Criteria:\n1. Instant UX with clear action metadata & preview card\n2. Public GitHub repository with setup instructions\n3. Short demo post showing the Blink unfurling live',
      rewardUsd: 1000,
      rewardLabel: 'USDC',
      maxWinners: 3,
      hoursLeft: 112,
      posterHandle: 'SuperteamEarn',
      posterName: 'Superteam Earn',
      verifiedSource: 'Superteam Guaranteed',
      tweetUrl: 'https://x.com/SuperteamEarn',
      participationUrl: 'https://earn.superteam.fun/bounties/',
      category: 'dev',
      requirementsSummary: 'Submit your deployed Blink URL, GitHub repository, and demo post on Superteam Earn.',
    },
    {
      slug: 'ext-bountycaster-farcaster-miniapp',
      tweetId: '189401209841203',
      title: 'Onchain Split-Bill & Group Escrow Mini-App for Farcaster v2 Frames',
      description:
        'Build a mobile-first Frame v2 mini-app where friends in a group channel can split a dinner or event tab in USDC and settle in one tap.\n\nBonus points for automatic receipt OCR and clean brutalist UI.',
      rewardUsd: 750,
      rewardLabel: 'USDC',
      maxWinners: 1,
      hoursLeft: 84,
      posterHandle: 'bountycaster',
      posterName: 'Bountycaster',
      verifiedSource: 'Bountycaster Escrow',
      tweetUrl: 'https://x.com/bountycaster',
      participationUrl: 'https://www.bountycaster.xyz',
      category: 'dev',
      requirementsSummary: 'Submit your live Frame v2 URL and open-source repository via the official Bountycaster page.',
    },
    {
      slug: 'ext-arc-defi-analytics-dashboard',
      tweetId: '189401209841204',
      title: 'Arc Network Stablecoin Velocity & Escrow Analytics Dashboard',
      description:
        'Build a public real-time analytics dashboard tracking USDC volume, active smart-contract escrows, and top builders across Arc.\n\nMust feature responsive charts, wallet lookup, CSV export, and sub-second load times.',
      rewardUsd: 1200,
      rewardLabel: 'USDC',
      maxWinners: 2,
      hoursLeft: 160,
      posterHandle: 'arcdotio',
      posterName: 'Arc Ecosystem',
      verifiedSource: 'Verified Ecosystem',
      tweetUrl: 'https://x.com/search?q=arc%20bounty%20usdc',
      participationUrl: 'https://arc.io',
      category: 'dev',
      requirementsSummary: 'Live hosted dashboard URL + public GitHub repo querying live chain RPC/indexer.',
    },
    {
      slug: 'ext-base-ai-agent-wallet-tool',
      tweetId: '189401209841205',
      title: 'Autonomous AI Agent Bounty Hunter Plugin using Base AgentKit',
      description:
        'Create an open-source AgentKit plugin that lets an AI agent browse open coding/content tasks, verify USDC escrow on-chain, and draft pull requests autonomously.\n\nPrize is guaranteed for the top 2 working implementations with clean documentation.',
      rewardUsd: 1000,
      rewardLabel: 'USDC',
      maxWinners: 2,
      hoursLeft: 148,
      posterHandle: 'base',
      posterName: 'Base Builders',
      verifiedSource: 'Verified Org',
      tweetUrl: 'https://x.com/base',
      participationUrl: 'https://www.base.org/builders',
      category: 'dev',
      requirementsSummary: 'Working AgentKit plugin PR + 2-minute loom/video demonstration.',
    },
    {
      slug: 'ext-uniswap-v4-hook-security',
      tweetId: '189401209841206',
      title: 'Uniswap v4 Dynamic Fee Hook + Foundry Fuzz Test Suite',
      description:
        'Implement a gas-optimized Uniswap v4 Hook that adjusts LP fees dynamically based on on-chain volatility, complete with Foundry invariant and fuzz tests (>95% branch coverage).',
      rewardUsd: 2000,
      rewardLabel: 'USDC',
      maxWinners: 1,
      hoursLeft: 185,
      posterHandle: 'UniswapFND',
      posterName: 'Uniswap Foundation',
      verifiedSource: 'Verified Grant',
      tweetUrl: 'https://x.com/UniswapFND',
      participationUrl: 'https://www.uniswapfoundation.org',
      category: 'dev',
      requirementsSummary: 'Foundry repository with passing invariant tests + gas benchmark report.',
    },
    {
      slug: 'ext-superteam-motion-launch-reel',
      tweetId: '189401209841207',
      title: '45-Second High-Energy Motion Graphics Launch Trailer for Onchain Payments',
      description:
        'Produce a punchy, kinetic-typography + 2D/3D motion graphics video (16:9 and 9:16 cuts) explaining why instant stablecoin settlement beats legacy 3-day wire transfers.\n\nStyle references: Apple Pay, Wise, Neo-Brutalist web3.',
      rewardUsd: 600,
      rewardLabel: 'USDC',
      maxWinners: 2,
      hoursLeft: 92,
      posterHandle: 'SuperteamEarn',
      posterName: 'Superteam Creative',
      verifiedSource: 'Superteam Guaranteed',
      tweetUrl: 'https://x.com/SuperteamEarn',
      participationUrl: 'https://earn.superteam.fun/bounties/',
      category: 'design',
      requirementsSummary: '1080p MP4 (60fps) + project source file upon selection.',
    },
    {
      slug: 'ext-Arbitrum-stylus-rust-sdk',
      tweetId: '189401209841208',
      title: 'Port an Ed25519 Signature Verifier to Arbitrum Stylus (Rust WASM)',
      description:
        'Write a clean, audit-ready Rust smart contract for Arbitrum Stylus that verifies Ed25519 signatures at a fraction of EVM precompile gas cost, and benchmark it against Solidity.',
      rewardUsd: 1500,
      rewardLabel: 'USDC',
      maxWinners: 1,
      hoursLeft: 172,
      posterHandle: 'arbitrumdevs',
      posterName: 'Arbitrum Developers',
      verifiedSource: 'Verified Org',
      tweetUrl: 'https://x.com/arbitrumdevs',
      participationUrl: 'https://arbitrum.foundation',
      category: 'dev',
      requirementsSummary: 'Rust Stylus crate + Solidity comparison benchmark + testnet deployment tx.',
    },
    {
      slug: 'ext-design-neobrutalist-icon-pack',
      tweetId: '189401209841209',
      title: 'Design a 30-Piece Neo-Brutalist Crypto & Escrow SVG Icon System',
      description:
        'We need a cohesive set of 30 custom pixel/brutalist SVG icons (vaults, USDC coins, trophies, wallets, smart contracts, badges) with thick #111 strokes and vibrant pop accents.\n\nAll 3 top finalists receive guaranteed USDC payouts.',
      rewardUsd: 400,
      rewardLabel: 'USDC',
      maxWinners: 3,
      hoursLeft: 68,
      posterHandle: 'bountycaster',
      posterName: 'Bountycaster Design',
      verifiedSource: 'Bountycaster Escrow',
      tweetUrl: 'https://x.com/bountycaster',
      participationUrl: 'https://www.bountycaster.xyz',
      category: 'design',
      requirementsSummary: 'Public Figma community file + optimized inline-ready SVG bundle.',
    },
    {
      slug: 'ext-deep-dive-research-thread',
      tweetId: '189401209841210',
      title: 'Technical Deep-Dive Thread & Diagram Set: Programmable Stablecoin Escrows',
      description:
        'Write a comprehensive, zero-fluff longform article or 10+ post thread breaking down how modern on-chain escrow contracts eliminate counterparty risk for freelance & bounty marketplaces.\n\nMust include 3 original architecture/flow diagrams.',
      rewardUsd: 300,
      rewardLabel: 'USDC',
      maxWinners: 4,
      hoursLeft: 76,
      posterHandle: 'layer3xyz',
      posterName: 'Layer3 Quests & Bounties',
      verifiedSource: 'Verified Platform',
      tweetUrl: 'https://x.com/layer3xyz',
      participationUrl: 'https://app.layer3.xyz',
      category: 'content',
      requirementsSummary: 'Publish thread/article and submit the link via the official participation page.',
    },
    {
      slug: 'ext-eigenlayer-avs-monitoring-cli',
      tweetId: '189401209841211',
      title: 'Build a Terminal TUI / CLI Monitor for EigenLayer AVS Operator Health',
      description:
        'Create a fast Rust or Go terminal dashboard (TUI) that lets AVS operators monitor quorum signatures, slashable events, and RPC latency in real time with webhook alerts.',
      rewardUsd: 1250,
      rewardLabel: 'USDC',
      maxWinners: 2,
      hoursLeft: 196,
      posterHandle: 'eigenlayer',
      posterName: 'EigenLayer Ecosystem',
      verifiedSource: 'Verified Org',
      tweetUrl: 'https://x.com/eigenlayer',
      participationUrl: 'https://www.eigenlayer.xyz',
      category: 'dev',
      requirementsSummary: 'Open-source binary + GitHub repo + README with Docker/binary quickstart.',
    },
    {
      slug: 'ext-privy-embedded-wallet-ux',
      tweetId: '189401209841212',
      title: 'Zero-Friction Passkey + Embedded Wallet Onboarding Template (Next.js / Vite)',
      description:
        'Build a starter kit demonstrating sub-5-second user onboarding with Privy embedded wallets, gas sponsorship, and 1-click USDC signing without browser extension popups.',
      rewardUsd: 800,
      rewardLabel: 'USDC',
      maxWinners: 2,
      hoursLeft: 124,
      posterHandle: 'privy_io',
      posterName: 'Privy Developer Bounties',
      verifiedSource: 'Verified Org',
      tweetUrl: 'https://x.com/privy_io',
      participationUrl: 'https://www.privy.io',
      category: 'dev',
      requirementsSummary: 'Public GitHub template + live demo URL + clean setup guide.',
    },
    {
      slug: 'ext-monad-parallel-evm-benchmark',
      tweetId: '189401209841213',
      title: 'Interactive Visualizer for Parallel EVM Execution vs Sequential Blocks',
      description:
        'Build an interactive 60fps canvas/WebGL explainer showing how optimistic parallel transaction execution handles state conflicts vs sequential EVM execution.',
      rewardUsd: 900,
      rewardLabel: 'USDC',
      maxWinners: 2,
      hoursLeft: 150,
      posterHandle: 'monad_dev',
      posterName: 'Monad Developer Community',
      verifiedSource: 'Verified Ecosystem',
      tweetUrl: 'https://x.com/monad_xyz',
      participationUrl: 'https://www.monad.xyz',
      category: 'design',
      requirementsSummary: 'Interactive web app URL + source repository.',
    },
    {
      slug: 'ext-solana-mobile-dapp-store-ui',
      tweetId: '189401209841214',
      title: 'Redesign a Mobile-First Micro-Task & Bounty Claiming Flow (Figma Prototype)',
      description:
        'Create an interactive Figma prototype for a mobile crypto bounty hunter experience: browsing tasks, submitting proof from a phone camera, and receiving instant USDC push notifications.',
      rewardUsd: 500,
      rewardLabel: 'USDC',
      maxWinners: 2,
      hoursLeft: 104,
      posterHandle: 'SuperteamEarn',
      posterName: 'Superteam Design',
      verifiedSource: 'Superteam Guaranteed',
      tweetUrl: 'https://x.com/SuperteamEarn',
      participationUrl: 'https://earn.superteam.fun/bounties/',
      category: 'design',
      requirementsSummary: 'Interactive Figma prototype link + 90-second Loom walkthrough.',
    },
    {
      slug: 'ext-wormhole-multichain-bounty-relayer',
      tweetId: '189401209841215',
      title: 'Cross-Chain Bounty Payout Relayer PoC with Wormhole Settlement',
      description:
        'Build a proof-of-concept contract + script that allows a bounty poster on one EVM chain to pay a winning contributor on their preferred destination chain in native USDC.',
      rewardUsd: 1750,
      rewardLabel: 'USDC',
      maxWinners: 1,
      hoursLeft: 210,
      posterHandle: 'wormhole',
      posterName: 'Wormhole Builders',
      verifiedSource: 'Verified Org',
      tweetUrl: 'https://x.com/wormhole',
      participationUrl: 'https://wormhole.com',
      category: 'dev',
      requirementsSummary: 'Smart contracts + end-to-end testnet transaction hashes + GitHub repo.',
    },
    {
      slug: 'ext-web3-security-audit-ctf-writeup',
      tweetId: '189401209841216',
      title: 'Smart Contract Escrow Security Checklist & Interactive PoC Walkthrough',
      description:
        'Create a practical developer guide covering the top 7 pitfalls in ERC-20 escrow smart contracts (reentrancy, fee-on-transfer tokens, blocklist griefing, pull-over-push fallback) with Foundry PoCs.',
      rewardUsd: 450,
      rewardLabel: 'USDC',
      maxWinners: 3,
      hoursLeft: 118,
      posterHandle: 'immunefi',
      posterName: 'Web3 Security Community',
      verifiedSource: 'Verified Platform',
      tweetUrl: 'https://x.com/immunefi',
      participationUrl: 'https://immunefi.com',
      category: 'content',
      requirementsSummary: 'Published technical article + companion Foundry test repository.',
    },
  ]

  return specs.map((s, idx) => ({
    id: s.slug,
    tweet_id: s.tweetId,
    title: s.title,
    description: s.description,
    reward_usdc: Math.round(s.rewardUsd * 1_000_000),
    reward_label: s.rewardLabel,
    max_winners: s.maxWinners,
    deadline: bucketSec + s.hoursLeft * 3600,
    poster_handle: s.posterHandle,
    poster_name: s.posterName,
    verified_source: s.verifiedSource,
    tweet_url: s.tweetUrl,
    participation_url: s.participationUrl,
    category: s.category,
    requirements_summary: s.requirementsSummary,
    created_at: bucketSec - idx * 3600,
  }))
}
