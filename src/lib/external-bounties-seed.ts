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

export const LEGACY_EXTERNAL_BOUNTY_IDS = [
  'ext-circle-cctp-widget',
  'ext-superteam-solana-blinks',
  'ext-bountycaster-farcaster-miniapp',
  'ext-arc-defi-analytics-dashboard',
  'ext-base-ai-agent-wallet-tool',
  'ext-uniswap-v4-hook-security',
  'ext-superteam-motion-launch-reel',
  'ext-Arbitrum-stylus-rust-sdk',
  'ext-design-neobrutalist-icon-pack',
  'ext-deep-dive-research-thread',
  'ext-eigenlayer-avs-monitoring-cli',
  'ext-privy-embedded-wallet-ux',
  'ext-monad-parallel-evm-benchmark',
  'ext-solana-mobile-dapp-store-ui',
  'ext-wormhole-multichain-bounty-relayer',
  'ext-web3-security-audit-ctf-writeup',
  'ext-solana-pay-pos-terminal-ui',
] as const

export function isExactXStatusUrl(url: string): boolean {
  return /^https?:\/\/(?:x\.com|twitter\.com)\/[A-Za-z0-9_]+\/status\/\d+/i.test((url || '').trim())
}

export function isGenericXProfileUrl(url: string): boolean {
  return /^https?:\/\/(?:x\.com|twitter\.com)\/[A-Za-z0-9_]+\/?$/i.test((url || '').trim())
}

export function isGenericHomepageUrl(url: string): boolean {
  const trimmed = (url || '').trim()
  if (!trimmed) return true
  if (isGenericXProfileUrl(trimmed)) return true
  try {
    const u = new URL(trimmed)
    const host = u.hostname.toLowerCase()
    const p = u.pathname.replace(/\/+$/, '')
    // Dedicated competition subdomains on Devpost are direct challenge pages, not company roots
    if (host.endsWith('.devpost.com') && host !== 'devpost.com' && host !== 'www.devpost.com') {
      return false
    }
    if (!p) return true
    return ['/bounties', '/en/developers', '/builders'].includes(p.toLowerCase())
  } catch {
    return true
  }
}

export function buildXAnnouncementSearchUrl(handle: string, title: string): string {
  const cleanHandle = handle.replace(/^@/, '').replace(/[^A-Za-z0-9_]/g, '')
  const keywords = title
    .replace(/[^a-zA-Z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 3)
    .slice(0, 4)
    .join(' ')
  const query = cleanHandle
    ? `(from:${cleanHandle} ${keywords || 'bounty'}) OR "${keywords || cleanHandle}"`
    : `"${keywords || 'USDC bounty'}"`
  return `https://x.com/search?q=${encodeURIComponent(query)}&f=live`
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

/**
 * Diverse multi-source curated fallback backed by real open listings across
 * Superteam Earn, Devpost, Immunefi, and Intigriti.
 */
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
    deadlineIso?: string
    hoursLeft?: number
    posterHandle: string
    posterName: string
    verifiedSource: string
    tweetUrl?: string
    participationUrl: string
    category: 'dev' | 'design' | 'content' | 'growth'
    requirementsSummary: string
  }> = [
    {
      slug: 'ext-se-raenest-global-bounty',
      tweetId: 'se-raenest',
      title: 'The Raenest Global Bounty — Writing, Video & Animation',
      description:
        'Create clear, insightful writing, video, or animation showcasing how global multi-currency accounts and stablecoin USDC/USDT transfers work on Raenest.',
      rewardUsd: 1500,
      rewardLabel: 'USDC',
      maxWinners: 6,
      deadlineIso: '2026-12-13T22:59:59.000Z',
      posterHandle: 'RaenestApp',
      posterName: 'Raenest',
      verifiedSource: 'Superteam Earn',
      participationUrl: 'https://earn.superteam.fun/listing/the-raenest-global-bounty-writing-video-and-animation/',
      category: 'content',
      requirementsSummary: 'Submit your published article, video, or animation link directly on the Superteam Earn listing page.',
    },
    {
      slug: 'ext-dp-kiroween-2026',
      tweetId: 'dp-kiroween-2026',
      title: 'Kiroween 2026 — AI & Open-Ended Developer Build Challenge',
      description:
        'Build an original AI-powered software application or developer tool for Kiroween 2026 hosted by Kiro on Devpost. Compete across 15+ cash prize categories.',
      rewardUsd: 10000,
      rewardLabel: 'USD',
      maxWinners: 10,
      deadlineIso: '2026-12-04T23:59:59.000Z',
      posterHandle: 'kirodotdev',
      posterName: 'Kiro · Devpost',
      verifiedSource: 'Devpost',
      participationUrl: 'https://kiroween.devpost.com/',
      category: 'dev',
      requirementsSummary: 'Join the challenge on Devpost and submit a working demo video, live app link, and public repository.',
    },
    {
      slug: 'ext-imm-livepeer',
      tweetId: 'imm-livepeer',
      title: 'Livepeer Security Bug Bounty Program (Up to $40,000)',
      description:
        'Find and responsibly disclose security vulnerabilities across Livepeer smart contracts, decentralized video transcoding, and AI compute infrastructure.',
      rewardUsd: 40000,
      rewardLabel: 'USDC',
      maxWinners: 1,
      hoursLeft: 720,
      posterHandle: 'Livepeer',
      posterName: 'Livepeer',
      verifiedSource: 'Immunefi',
      participationUrl: 'https://immunefi.com/bug-bounty/livepeer/information/',
      category: 'dev',
      requirementsSummary: 'Review in-scope contracts and submit a verified PoC vulnerability report on Immunefi.',
    },
    {
      slug: 'ext-intig-daytona',
      tweetId: 'intig-daytona',
      title: 'Daytona Bug Bounty — Cloud & AI Infrastructure Security',
      description:
        'Daytona provides elastic cloud infrastructure for running AI-generated code. Test in-scope web apps and APIs for valid security issues under responsible disclosure.',
      rewardUsd: 3500,
      rewardLabel: 'EUR',
      maxWinners: 1,
      hoursLeft: 720,
      posterHandle: 'daytonaio',
      posterName: 'Daytona',
      verifiedSource: 'Intigriti',
      participationUrl: 'https://app.intigriti.com/programs/daytona/daytonabugbounty/detail',
      category: 'dev',
      requirementsSummary: 'Review program scope and submit reproducible vulnerability reports on Intigriti.',
    },
    {
      slug: 'ext-dp-codegeist-2026',
      tweetId: 'dp-codegeist-2026',
      title: 'Codegeist 2026: Build with Context & Ship with Confidence',
      description:
        'Atlassian flagship developer competition on Devpost with $120,000 in cash prizes for AI, enterprise productivity, and Forge developer apps.',
      rewardUsd: 15000,
      rewardLabel: 'USD',
      maxWinners: 8,
      deadlineIso: '2026-12-22T23:59:59.000Z',
      posterHandle: 'AtlassianDev',
      posterName: 'Atlassian · Devpost',
      verifiedSource: 'Devpost',
      participationUrl: 'https://codegeist2026.devpost.com/',
      category: 'dev',
      requirementsSummary: 'Build a working Atlassian app and submit your demo + repository on Devpost.',
    },
    {
      slug: 'ext-se-students-workshop-thread',
      tweetId: '2120067693479137334',
      title: 'Write a Twitter/X Thread on Opportunities for Students Workshop',
      description:
        'Superteam Ukraine & dev3pack hosted a workshop covering developer grants, bounties, and ecosystem opportunities for students. Publish an insightful X thread summarizing key takeaways.',
      rewardUsd: 100,
      rewardLabel: 'USDG',
      maxWinners: 4,
      deadlineIso: '2026-11-23T23:59:59.999Z',
      posterHandle: 'dev3pack',
      posterName: 'Superteam Ukraine × dev3pack',
      verifiedSource: 'Verified X + Superteam',
      tweetUrl: 'https://x.com/dev3pack/status/2120067693479137334',
      participationUrl: 'https://earn.superteam.fun/listing/write-a-twitter-thread-on-opportunities-for-students-workshop/',
      category: 'content',
      requirementsSummary: 'Publish a detailed X thread referencing the workshop and submit your post URL on Superteam Earn.',
    },
    {
      slug: 'ext-imm-1inch-business',
      tweetId: 'imm-1inch-business',
      title: '1inch Business Security Bug Bounty (Up to $100,000)',
      description:
        'Audit and report critical vulnerabilities in 1inch Business Web3 SaaS infrastructure, APIs, and smart-contract routing layers via Immunefi.',
      rewardUsd: 100000,
      rewardLabel: 'USDC',
      maxWinners: 1,
      hoursLeft: 720,
      posterHandle: '1inch',
      posterName: '1inch Business',
      verifiedSource: 'Immunefi',
      participationUrl: 'https://immunefi.com/bug-bounty/1inch-business/information/',
      category: 'dev',
      requirementsSummary: 'Submit a clear security PoC on Immunefi within the published scope rules.',
    },
    {
      slug: 'ext-intig-personio',
      tweetId: 'intig-personio',
      title: 'Personio Security Bug Bounty Program (Up to €5,000)',
      description:
        'Test Personio SaaS web applications and APIs for valid security bugs with guaranteed tiered payouts managed through Intigriti.',
      rewardUsd: 5000,
      rewardLabel: 'EUR',
      maxWinners: 1,
      hoursLeft: 720,
      posterHandle: 'personio',
      posterName: 'Personio',
      verifiedSource: 'Intigriti',
      participationUrl: 'https://app.intigriti.com/programs/personio/personio/detail',
      category: 'dev',
      requirementsSummary: 'Submit clear reproduction steps directly on the Intigriti program page.',
    },
    {
      slug: 'ext-dp-hybrid-ai-2026',
      tweetId: 'dp-hybrid-ai-2026',
      title: '#BuildHybridAI 2026 — Google Hybrid Mobile & Web AI Hackathon',
      description:
        'Create a mobile or web experience combining on-device Gemini Nano with cloud AI models for $30,000 in guaranteed cash prizes on Devpost.',
      rewardUsd: 5000,
      rewardLabel: 'USD',
      maxWinners: 6,
      deadlineIso: '2026-11-30T23:59:59.000Z',
      posterHandle: 'Firebase',
      posterName: 'Google · Devpost',
      verifiedSource: 'Devpost',
      participationUrl: 'https://firebasehybridaihackathon.devpost.com/',
      category: 'dev',
      requirementsSummary: 'Submit a hybrid AI prototype, walkthrough video, and code link on Devpost.',
    },
    {
      slug: 'ext-se-multihopper-build-route',
      tweetId: 'se-multihopper',
      title: 'MultiHopper Build & Route Challenge',
      description:
        'Build a useful Solana product powered by MultiHopper, bring real users, and compete for guaranteed milestone prizes plus ongoing integration revenue share.',
      rewardUsd: 1500,
      rewardLabel: 'USDC',
      maxWinners: 3,
      deadlineIso: '2026-12-14T21:59:59.000Z',
      posterHandle: 'multihopper',
      posterName: 'MultiHopper',
      verifiedSource: 'Superteam Earn',
      participationUrl: 'https://earn.superteam.fun/listing/multihopper-build-and-route-challenge-up-to-dollar50000-revenue-share-1/',
      category: 'dev',
      requirementsSummary: 'Submit your deployed app, GitHub repository, and integration metrics on the listing submission page.',
    },
    {
      slug: 'ext-se-inside-the-block-ended',
      tweetId: 'se-ended-demo',
      title: 'Inside the Block: How Solana Validators Order Transactions (Ended)',
      description:
        'Deep technical explainer on transaction scheduling and validator block packing. The submission window for this external challenge has ended.',
      rewardUsd: 500,
      rewardLabel: 'USDC',
      maxWinners: 5,
      hoursLeft: -18,
      posterHandle: 'SuperteamUKR',
      posterName: 'Superteam Ukraine',
      verifiedSource: 'Superteam Earn',
      participationUrl: 'https://earn.superteam.fun/listing/inside-the-block-how-solana-validators-order-transactions/',
      category: 'dev',
      requirementsSummary: 'Submission window has ended on Superteam Earn.',
    },
  ]

  return specs.map((s, idx) => {
    const parsedDeadline = s.deadlineIso ? Math.floor(Date.parse(s.deadlineIso) / 1000) : NaN
    const deadlineSec = Number.isFinite(parsedDeadline)
      ? parsedDeadline
      : bucketSec + (s.hoursLeft ?? 96) * 3600

    return {
      id: s.slug,
      tweet_id: s.tweetId,
      title: s.title,
      description: s.description,
      reward_usdc: Math.round(s.rewardUsd * 1_000_000),
      reward_label: s.rewardLabel,
      max_winners: s.maxWinners,
      deadline: deadlineSec,
      poster_handle: s.posterHandle,
      poster_name: s.posterName,
      verified_source: s.verifiedSource,
      tweet_url: s.tweetUrl || buildXAnnouncementSearchUrl(s.posterHandle, s.title),
      participation_url: s.participationUrl,
      category: s.category,
      requirements_summary: s.requirementsSummary,
      created_at: bucketSec - idx * 3600,
    }
  })
}
