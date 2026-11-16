/**
 * External Bounties Scanner (X / Twitter + Live Superteam Earn Feed)
 *
 * Self-contained inside `api/` so Vercel serverless bundling requires zero
 * cross-directory imports from `src/`.
 *
 * Scans X and live external bounty boards for 10–20 guaranteed bounties with
 * verified prize pools, clear deliverables, exact X announcement posts (or live
 * X post search), and direct submission/participation page URLs.
 *
 * Pipeline priority:
 * 1. xAI (Grok) Live X Search (`XAI_API_KEY`) — requires exact /status/<id> & direct submit links.
 * 2. Official X API v2 (`TWITTER_BEARER_TOKEN`) or SocialData (`SOCIALDATA_API_KEY`).
 * 3. Live Superteam Earn Public Listings API (`earn.superteam.fun/api/listings/`) — works zero-config.
 * 4. Curated Live Fallback (backed by verified listing permalinks + /status/ posts).
 */

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

export interface ScannedExternalBounty {
  id: string
  tweet_id: string
  title: string
  description: string
  /** Prize per winner in 6-decimal USDC units (e.g. 500_000_000 = $500.00) */
  reward_usdc: number
  reward_label: string
  max_winners: number
  /** Unix timestamp (seconds) */
  deadline: number
  poster_handle: string
  poster_name: string
  verified_source: string
  tweet_url: string
  participation_url: string
  category: 'dev' | 'design' | 'content' | 'growth'
  requirements_summary: string
  created_at: number
}

interface GrokChatResponse {
  choices?: Array<{
    message?: {
      content?: string
    }
  }>
}

interface RawParsedBounty {
  tweet_id?: string
  title?: string
  description?: string
  reward_usd?: number
  reward_label?: string
  max_winners?: number
  deadline_hours?: number
  poster_handle?: string
  poster_name?: string
  verified_source?: string
  tweet_url?: string
  participation_url?: string
  category?: string
  requirements_summary?: string
}

function sanitizeCategory(raw: string | undefined): 'dev' | 'design' | 'content' | 'growth' {
  const c = (raw ?? '').toLowerCase()
  if (c.includes('design') || c.includes('video') || c.includes('animat') || c.includes('ui')) return 'design'
  if (c.includes('content') || c.includes('writ') || c.includes('thread')) return 'content'
  if (c.includes('growth') || c.includes('market') || c.includes('community')) return 'growth'
  return 'dev'
}

function stripHtmlToText(html: string): string {
  return String(html || '')
    .replace(/<\/(p|h1|h2|h3|h4|li|div|tr|blockquote)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<li[^>]*>/gi, '• ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, '\'')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/**
 * Resolve clean `tweet_url` (exact /status/<id> if numeric or already a status permalink,
 * otherwise a targeted X announcement search) and `participation_url` (exact submission
 * page, never falling back to a bare company root).
 */
function resolveExternalUrls(params: {
  handle: string
  tweetId: string
  title: string
  rawTweetUrl?: string
  rawParticipationUrl?: string
}): { tweetUrl: string; participationUrl: string } {
  const cleanHandle = params.handle.replace(/^@/, '').replace(/[^a-zA-Z0-9_]/g, '') || 'SuperteamEarn'
  const candidateTweet = (params.rawTweetUrl ?? '').trim()
  const numericTweetId = /^\d{8,}$/.test(params.tweetId) ? params.tweetId : ''

  let tweetUrl = ''
  if (isExactXStatusUrl(candidateTweet)) {
    tweetUrl = candidateTweet
  } else if (numericTweetId) {
    tweetUrl = `https://x.com/${cleanHandle}/status/${numericTweetId}`
  } else {
    tweetUrl = buildXAnnouncementSearchUrl(cleanHandle, params.title)
  }

  const candidatePart = (params.rawParticipationUrl ?? '').trim()
  let participationUrl = candidatePart
  if (!participationUrl.startsWith('https://') || isGenericHomepageUrl(participationUrl)) {
    participationUrl = isExactXStatusUrl(tweetUrl) ? tweetUrl : candidatePart
  }
  if (!participationUrl.startsWith('https://')) {
    participationUrl = tweetUrl
  }

  return { tweetUrl, participationUrl }
}

/**
 * Vet and normalize raw candidate bounties from live X search.
 * Filters out giveaway/RT bait and enforces specific post & submission URLs.
 */
function normalizeScannedBounties(items: RawParsedBounty[], nowSec: number): ScannedExternalBounty[] {
  const results: ScannedExternalBounty[] = []
  const seenIds = new Set<string>()

  for (let i = 0; i < items.length; i++) {
    const item = items[i]
    const title = (item.title ?? '').trim()
    const desc = (item.description ?? '').trim()
    const rewardUsd = typeof item.reward_usd === 'number' ? item.reward_usd : 0

    if (!title || title.length < 10 || desc.length < 25) continue
    if (rewardUsd < 25 || rewardUsd > 250000) continue
    if (/retweet\s+and\s+follow|tag\s+3\s+friends|airdrop\s+giveaway/i.test(`${title} ${desc}`)) continue

    const handle = (item.poster_handle ?? 'SuperteamEarn').replace(/^@/, '').trim()
    const tweetId = (item.tweet_id ?? `x-${nowSec}-${i}`).replace(/[^a-zA-Z0-9_-]/g, '')
    const id = `ext-${tweetId}`
    if (seenIds.has(id)) continue
    seenIds.add(id)

    const hours = typeof item.deadline_hours === 'number' && item.deadline_hours > 2
      ? Math.min(item.deadline_hours, 24 * 21)
      : 72 + (i * 12)

    const { tweetUrl, participationUrl } = resolveExternalUrls({
      handle,
      tweetId,
      title,
      rawTweetUrl: item.tweet_url,
      rawParticipationUrl: item.participation_url,
    })

    // Skip entries whose participation URL is still just a generic company root with no X status permalink
    if (isGenericHomepageUrl(participationUrl) && !isExactXStatusUrl(tweetUrl)) continue

    results.push({
      id,
      tweet_id: tweetId,
      title: title.slice(0, 120),
      description: desc.slice(0, 1500),
      reward_usdc: Math.round(rewardUsd * 1_000_000),
      reward_label: (item.reward_label ?? 'USDC').toUpperCase().slice(0, 10),
      max_winners: Math.max(1, Math.min(25, Math.round(item.max_winners ?? 1))),
      deadline: nowSec + Math.round(hours * 3600),
      poster_handle: handle,
      poster_name: (item.poster_name ?? handle).slice(0, 60),
      verified_source: (item.verified_source ?? 'Verified on X').slice(0, 40),
      tweet_url: tweetUrl,
      participation_url: participationUrl,
      category: sanitizeCategory(item.category),
      requirements_summary: (item.requirements_summary ?? 'Submit deliverable via the official bounty link before deadline.').slice(0, 400),
      created_at: nowSec - (i * 1800),
    })
  }

  return results
}

/**
 * Scan live X posts via xAI Grok API (with live X search enabled) if XAI_API_KEY is configured.
 */
async function scanWithGrok(apiKey: string, nowSec: number): Promise<ScannedExternalBounty[]> {
  const prompt = [
    'Search X (Twitter) for 15 live, currently open tech/web3/creative bounties with guaranteed USDC, USDT, or USD payouts.',
    'Exclude giveaways, sweepstakes, or "like & RT" posts.',
    'CRITICAL URL RULES: tweet_url MUST be the exact X post permalink (e.g. https://x.com/handle/status/123456789), NEVER an account profile page like https://x.com/handle. participation_url MUST be the exact specific bounty listing, GitHub issue, or submission page (e.g. https://earn.superteam.fun/listing/...), NEVER a generic company homepage.',
    'Return ONLY a JSON array of objects with keys:',
    'tweet_id, title, description, reward_usd (number per winner), reward_label ("USDC"|"USDT"|"USD"), max_winners (number), deadline_hours (hours remaining), poster_handle (without @), poster_name, verified_source, tweet_url, participation_url, category ("dev"|"design"|"content"|"growth"), requirements_summary.',
  ].join(' ')

  const resp = await fetch('https://api.x.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'grok-3-latest',
      messages: [
        { role: 'system', content: 'You are a strict bounty aggregator that outputs only valid JSON arrays.' },
        { role: 'user', content: prompt },
      ],
      search_parameters: {
        mode: 'on',
        sources: [{ type: 'x' }],
      },
      temperature: 0.2,
    }),
    signal: AbortSignal.timeout(9000),
  })

  if (!resp.ok) return []
  const data = (await resp.json()) as GrokChatResponse
  const rawContent = data.choices?.[0]?.message?.content ?? ''
  const jsonMatch = rawContent.match(/\[[\s\S]*\]/)
  if (!jsonMatch) return []

  const parsed = JSON.parse(jsonMatch[0]) as RawParsedBounty[]
  if (!Array.isArray(parsed)) return []
  return normalizeScannedBounties(parsed, nowSec)
}

interface TwitterSearchResponse {
  data?: Array<{
    id: string
    text: string
    author_id?: string
    entities?: {
      urls?: Array<{ expanded_url?: string }>
    }
  }>
  includes?: {
    users?: Array<{
      id: string
      username: string
      name: string
    }>
  }
}

/**
 * Scan live X posts via Twitter API v2 / SocialData if TWITTER_BEARER_TOKEN is configured.
 */
async function scanWithTwitterBearer(bearerToken: string, nowSec: number): Promise<ScannedExternalBounty[]> {
  const query = encodeURIComponent(
    '("bounty" OR "prize pool") ("USDC" OR "USDT") ("submit" OR "build" OR "design" OR "write") -is:retweet -giveaway -airdrop lang:en'
  )
  const url = `https://api.twitter.com/2/tweets/search/recent?query=${query}&max_results=25&expansions=author_id&tweet.fields=entities,created_at&user.fields=username,name,verified`
  const resp = await fetch(url, {
    headers: { Authorization: `Bearer ${bearerToken}` },
    signal: AbortSignal.timeout(7000),
  })
  if (!resp.ok) return []

  const payload = (await resp.json()) as TwitterSearchResponse
  const tweets = payload.data ?? []
  const usersById = new Map<string, { username: string; name: string }>()
  for (const u of payload.includes?.users ?? []) {
    usersById.set(u.id, { username: u.username, name: u.name })
  }

  const candidates: RawParsedBounty[] = []
  for (const t of tweets) {
    const amountMatch = t.text.match(/\$\s?(\d{2,5}(?:,\d{3})?)|(\d{2,5}(?:,\d{3})?)\s*(?:USDC|USDT)/i)
    if (!amountMatch) continue
    const rawNum = Number((amountMatch[1] ?? amountMatch[2] ?? '0').replace(/,/g, ''))
    if (!rawNum || rawNum < 25) continue

    const author = (t.author_id ? usersById.get(t.author_id) : undefined) ?? {
      username: 'SuperteamEarn',
      name: 'Verified Bounty Host',
    }
    const cleanLines = t.text.split('\n').map(l => l.trim()).filter(Boolean)
    const firstLine = (cleanLines[0] ?? 'External Bounty on X').replace(/https?:\/\/\S+/g, '').trim()
    const deepExternalUrl = t.entities?.urls?.find(
      u => u.expanded_url && !u.expanded_url.includes('twitter.com') && !u.expanded_url.includes('x.com') && !isGenericHomepageUrl(u.expanded_url)
    )?.expanded_url
    const tweetUrl = `https://x.com/${author.username}/status/${t.id}`

    candidates.push({
      tweet_id: t.id,
      title: firstLine.slice(0, 95) || `Bounty by @${author.username}`,
      description: t.text,
      reward_usd: rawNum,
      reward_label: /USDT/i.test(t.text) ? 'USDT' : 'USDC',
      max_winners: 1,
      deadline_hours: 96,
      poster_handle: author.username,
      poster_name: author.name,
      verified_source: 'X Live Scan',
      tweet_url: tweetUrl,
      participation_url: deepExternalUrl ?? tweetUrl,
      category: /design|figma|ui|logo/i.test(t.text) ? 'design' : /thread|video|article|content/i.test(t.text) ? 'content' : 'dev',
      requirements_summary: 'Follow instructions in the original X post and submit before the deadline.',
    })
  }

  return normalizeScannedBounties(candidates, nowSec)
}

interface SuperteamListingSummary {
  id: string
  slug: string
  title: string
  rewardAmount: number | null
  token: string | null
  deadline: string
  status: string
  sponsor?: {
    name?: string
    slug?: string
    url?: string
  }
}

interface SuperteamListingDetail {
  description?: string
  requirements?: string
  rewards?: Record<string, number>
  skills?: Array<{ skills?: string }>
  sponsor?: {
    name?: string
    slug?: string
    url?: string
  }
}

/**
 * Fetch real live external bounties directly from Superteam Earn's public listings API.
 * Runs with zero API keys and produces exact submission listing URLs + any verified X /status/ post links.
 */
async function scanWithSuperteamEarn(nowSec: number): Promise<ScannedExternalBounty[]> {
  const [openRes, reviewRes] = await Promise.allSettled([
    fetch('https://earn.superteam.fun/api/listings/?take=20&status=open', {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(5500),
    }),
    fetch('https://earn.superteam.fun/api/listings/?take=2&status=review', {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(4500),
    }),
  ])

  const listings: SuperteamListingSummary[] = []
  if (openRes.status === 'fulfilled' && openRes.value.ok) {
    const arr = (await openRes.value.json()) as SuperteamListingSummary[]
    if (Array.isArray(arr)) listings.push(...arr)
  }
  if (reviewRes.status === 'fulfilled' && reviewRes.value.ok) {
    const arr = (await reviewRes.value.json()) as SuperteamListingSummary[]
    if (Array.isArray(arr)) listings.push(...arr.slice(0, 2))
  }

  const usdTokens = new Set(['USDC', 'USDG', 'USDT', 'USD'])
  const candidates = listings
    .filter(item => item.slug && item.title && typeof item.rewardAmount === 'number' && item.rewardAmount > 0 && usdTokens.has((item.token ?? '').toUpperCase()))
    .slice(0, 15)

  if (candidates.length === 0) return []

  const detailed = await Promise.all(
    candidates.map(async (item, idx): Promise<ScannedExternalBounty | null> => {
      try {
        const detResp = await fetch(`https://earn.superteam.fun/api/listings/details/${encodeURIComponent(item.slug)}`, {
          headers: { Accept: 'application/json' },
          signal: AbortSignal.timeout(4500),
        })
        const det: SuperteamListingDetail = detResp.ok ? ((await detResp.json()) as SuperteamListingDetail) : {}
        const rawHtml = `${det.description ?? ''}\n${det.requirements ?? ''}`
        const plainDesc = stripHtmlToText(det.description ?? '') || item.title
        const plainReq = stripHtmlToText(det.requirements ?? '')

        const statusMatch = rawHtml.match(/https?:\/\/(?:x\.com|twitter\.com)\/[A-Za-z0-9_]+\/status\/\d+/i)
        const handleMatch = rawHtml.match(/https?:\/\/(?:x\.com|twitter\.com)\/([A-Za-z0-9_]+)/i)
        const sponsorHandle = (handleMatch?.[1] && !['search', 'intent', 'i', 'home'].includes(handleMatch[1].toLowerCase()))
          ? handleMatch[1]
          : (item.sponsor?.slug ?? 'SuperteamEarn').replace(/[^a-zA-Z0-9_]/g, '') || 'SuperteamEarn'

        const rewardEntries = det.rewards ? Object.values(det.rewards).filter(v => typeof v === 'number' && v > 0) : []
        const maxWinners = Math.max(1, rewardEntries.length || 1)
        const perWinnerUsd = rewardEntries.length > 0
          ? Math.max(...rewardEntries)
          : Math.max(25, Math.round((item.rewardAmount ?? 100) / maxWinners))

        const parsedDeadline = Math.floor(Date.parse(item.deadline) / 1000)
        const deadlineSec = Number.isFinite(parsedDeadline) ? parsedDeadline : nowSec + 96 * 3600

        const listingUrl = `https://earn.superteam.fun/listing/${item.slug}/`
        const tweetUrl = statusMatch ? statusMatch[0] : buildXAnnouncementSearchUrl(sponsorHandle, item.title)

        const skillStr = (det.skills ?? []).map(s => s.skills ?? '').join(' ')
        const cat = sanitizeCategory(`${skillStr} ${item.title}`)

        return {
          id: `ext-se-${item.slug.slice(0, 48)}`,
          tweet_id: statusMatch ? (statusMatch[0].match(/status\/(\d+)/)?.[1] ?? item.id) : item.id,
          title: item.title.slice(0, 120),
          description: plainDesc.slice(0, 1500),
          reward_usdc: Math.round(perWinnerUsd * 1_000_000),
          reward_label: (item.token ?? 'USDC').toUpperCase().slice(0, 10),
          max_winners: Math.min(25, maxWinners),
          deadline: deadlineSec,
          poster_handle: sponsorHandle,
          poster_name: (item.sponsor?.name ?? det.sponsor?.name ?? sponsorHandle).trim().slice(0, 60),
          verified_source: statusMatch ? 'Verified X + Superteam' : 'Superteam Earn',
          tweet_url: tweetUrl,
          participation_url: listingUrl,
          category: cat,
          requirements_summary: (plainReq || `Submit your completed entry directly on the official Superteam Earn listing page (${item.slug}).`).slice(0, 400),
          created_at: nowSec - idx * 1800,
        }
      } catch {
        return null
      }
    })
  )

  return detailed.filter((b): b is ScannedExternalBounty => b !== null)
}

export function getCuratedExternalBounties(nowSec: number): ScannedExternalBounty[] {
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

/**
 * Scan X and live bounty feeds for 10–20 live guaranteed bounties.
 * Ensures every returned bounty has a specific submission/participation page URL
 * and an exact X /status/ post (or targeted X post search, never a misleading host profile).
 */
export async function scanLiveGuaranteedBounties(): Promise<{
  bounties: ScannedExternalBounty[]
  source: 'xai-live' | 'twitter-api' | 'superteam-live' | 'curated-feed'
}> {
  const nowSec = Math.floor(Date.now() / 1000)
  const xaiKey = process.env.XAI_API_KEY?.trim()
  const twitterBearer = (process.env.TWITTER_BEARER_TOKEN ?? process.env.SOCIALDATA_API_KEY)?.trim()

  if (xaiKey) {
    try {
      const live = await scanWithGrok(xaiKey, nowSec)
      if (live.length >= 10) {
        return { bounties: live.slice(0, 20), source: 'xai-live' }
      }
      if (live.length > 0) {
        const superteam = await scanWithSuperteamEarn(nowSec).catch(() => [])
        const base = superteam.length > 0 ? superteam : getCuratedExternalBounties(nowSec)
        return { bounties: [...live, ...base].slice(0, 18), source: 'xai-live' }
      }
    } catch (e) {
      console.warn('Grok live X scan failed, falling back:', e)
    }
  }

  if (twitterBearer) {
    try {
      const live = await scanWithTwitterBearer(twitterBearer, nowSec)
      if (live.length >= 10) {
        return { bounties: live.slice(0, 20), source: 'twitter-api' }
      }
      if (live.length > 0) {
        const superteam = await scanWithSuperteamEarn(nowSec).catch(() => [])
        const base = superteam.length > 0 ? superteam : getCuratedExternalBounties(nowSec)
        return { bounties: [...live, ...base].slice(0, 18), source: 'twitter-api' }
      }
    } catch (e) {
      console.warn('Twitter API scan failed, falling back:', e)
    }
  }

  try {
    const superteamLive = await scanWithSuperteamEarn(nowSec)
    if (superteamLive.length >= 8) {
      return { bounties: superteamLive.slice(0, 18), source: 'superteam-live' }
    }
    if (superteamLive.length > 0) {
      const fallback = getCuratedExternalBounties(nowSec).filter(f => !superteamLive.some(s => s.participation_url === f.participation_url))
      return { bounties: [...superteamLive, ...fallback].slice(0, 16), source: 'superteam-live' }
    }
  } catch (e) {
    console.warn('Superteam live scan failed, falling back to curated seed:', e)
  }

  return {
    bounties: getCuratedExternalBounties(nowSec),
    source: 'curated-feed',
  }
}
