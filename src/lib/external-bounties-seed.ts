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
    const p = u.pathname.replace(/\/+$/, '')
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
 * Fallback curated feed backed by real Superteam Earn open listing URLs
 * and verified X /status/ post permalinks (never generic company/profile roots).
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
        'Raenest helps individuals and businesses manage money globally with multi-currency accounts and stablecoin support. Create clear, insightful writing, video, or animation showing how cross-border stablecoin payments and USDC/USDT flows work in practice.',
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
      slug: 'ext-se-multihopper-build-route',
      tweetId: 'se-multihopper',
      title: 'MultiHopper Build & Route Challenge',
      description:
        'Build a useful Solana product powered by MultiHopper, bring real users, and compete for a guaranteed milestone prize pool plus ongoing integration revenue share.',
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
      slug: 'ext-se-students-workshop-thread',
      tweetId: '2120067693479137334',
      title: 'Write a Twitter/X Thread on Opportunities for Students Workshop',
      description:
        'Superteam Ukraine & dev3pack hosted a workshop covering developer grants, bounties, and ecosystem opportunities for students. Publish an insightful X thread summarizing key takeaways and submit your thread link.',
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
      slug: 'ext-se-baobao-paj-narrative',
      tweetId: '2110442017637671124',
      title: 'Share Your Narrative of Using PAJ for Instant Naira-to-Token Swaps',
      description:
        'Try buying BAOBAO on PAJ with instant Naira settlement and share an authentic walkthrough thread on X explaining the user experience.',
      rewardUsd: 250,
      rewardLabel: 'USDC',
      maxWinners: 3,
      deadlineIso: '2026-11-21T22:59:59.000Z',
      posterHandle: 'paj_cash',
      posterName: 'PAJ Cash × BAOBAO',
      verifiedSource: 'Verified X + Superteam',
      tweetUrl: 'https://x.com/paj_cash/status/2110442017637671124',
      participationUrl: 'https://earn.superteam.fun/listing/a-narrative-of-buying-baobao-on-paj-twitter-x-thread/',
      category: 'content',
      requirementsSummary: 'Post your X thread and submit the link on the official Superteam Earn listing page.',
    },
    {
      slug: 'ext-se-oobe-capital-agent',
      tweetId: 'se-oobe-agent',
      title: 'Build an Autonomous Capital Agent on Solana (Steve Capital Challenge)',
      description:
        'Build and deploy an autonomous capital agent using Steve Capital & OOBE Protocol. Configure permissions and risk controls and compete for guaranteed USDC prizes.',
      rewardUsd: 100,
      rewardLabel: 'USDC',
      maxWinners: 5,
      deadlineIso: '2026-12-10T22:59:59.000Z',
      posterHandle: 'OOBEonSol',
      posterName: 'OOBE Protocol',
      verifiedSource: 'Superteam Earn',
      participationUrl: 'https://earn.superteam.fun/listing/build-an-autonomous-capital-agent-on-solana-and-compete-for-dollar500-in-rewards/',
      category: 'dev',
      requirementsSummary: 'Submit your deployed agent repo and live demo on the Superteam Earn listing page.',
    },
    {
      slug: 'ext-se-fundraising-article',
      tweetId: 'se-fundraising',
      title: 'Write an Article on Fundraising for Early & Mid-Stage Projects',
      description:
        'Create a deep-dive practical article covering ecosystem grants, venture funding, and community fundraising strategies for early and mid-stage web3 founders.',
      rewardUsd: 175,
      rewardLabel: 'USDG',
      maxWinners: 3,
      deadlineIso: '2026-11-23T23:59:59.999Z',
      posterHandle: 'SuperteamUKR',
      posterName: 'Superteam Ukraine',
      verifiedSource: 'Superteam Earn',
      participationUrl: 'https://earn.superteam.fun/listing/write-an-article-on-fundraising-opportunities-for-early-and-mid-stage-projects/',
      category: 'content',
      requirementsSummary: 'Submit your published article URL directly on the Superteam Earn listing page.',
    },
    {
      slug: 'ext-se-worm-premier-league',
      tweetId: 'se-worm-pl',
      title: 'Create Content on Premier League Predictions with worm',
      description:
        'Showcase how prediction markets work for live Premier League fixtures on worm.wtf with short-form video breakdowns, memes, or match threads.',
      rewardUsd: 100,
      rewardLabel: 'USDC',
      maxWinners: 5,
      deadlineIso: '2026-11-24T02:59:59.000Z',
      posterHandle: 'wormwtf',
      posterName: 'worm',
      verifiedSource: 'Superteam Earn',
      participationUrl: 'https://earn.superteam.fun/listing/create-content-on-premier-league-predictions-with-worm/',
      category: 'content',
      requirementsSummary: 'Submit your published video/post link on the Superteam Earn listing page.',
    },
    {
      slug: 'ext-se-ssrfun-beta-challenge',
      tweetId: 'se-ssrfun',
      title: 'SSR.FUN Beta Launch Creator & Trading Challenge',
      description:
        'Test tokenized portfolios on SSR.FUN (crypto + tokenized stocks/ETFs), document your experience, and share a crisp breakdown post.',
      rewardUsd: 100,
      rewardLabel: 'USDC',
      maxWinners: 3,
      deadlineIso: '2026-11-30T23:59:59.000Z',
      posterHandle: 'strategicsuperr',
      posterName: 'Strategic Super Reserve',
      verifiedSource: 'Superteam Earn',
      participationUrl: 'https://earn.superteam.fun/listing/ssrfun-beta-launch-challenge/',
      category: 'growth',
      requirementsSummary: 'Submit your beta walkthrough link directly on the Superteam Earn listing page.',
    },
    {
      slug: 'ext-se-anna-ai-messenger',
      tweetId: 'se-anna-ai',
      title: 'Create an Engaging X Thread Introducing Anna AI Messenger',
      description:
        'Explore Anna AI-native messenger workflows combining agents and human chat, and write an illustrated X thread showcasing practical use cases.',
      rewardUsd: 100,
      rewardLabel: 'USDC',
      maxWinners: 3,
      deadlineIso: '2026-11-30T22:59:59.999Z',
      posterHandle: 'annaos_ai',
      posterName: 'Anna AI',
      verifiedSource: 'Superteam Earn',
      participationUrl: 'https://earn.superteam.fun/listing/create-an-engaging-x-thread-introducing-anna-ai-messenger-1/',
      category: 'design',
      requirementsSummary: 'Submit your X thread link via the official Superteam Earn submission button.',
    },
    {
      slug: 'ext-se-kriptok-creator',
      tweetId: 'se-kriptok',
      title: 'KriptoK Creator Challenge · 200 USDC Prize Pool',
      description:
        'Explore KriptoK tools and publish creative video/visual content explaining its features to new users.',
      rewardUsd: 40,
      rewardLabel: 'USDC',
      maxWinners: 5,
      deadlineIso: '2026-11-25T20:59:59.000Z',
      posterHandle: 'KriptoKLeague',
      posterName: 'KriptoK',
      verifiedSource: 'Superteam Earn',
      participationUrl: 'https://earn.superteam.fun/listing/kriptok-creator-challenge-01/',
      category: 'content',
      requirementsSummary: 'Submit your content link directly on the Superteam Earn listing page.',
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
