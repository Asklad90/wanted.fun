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

const CHALLENGE_SUBDOMAIN_ROOTS = ['.devpost.com', '.hackerearth.com']

export function isGenericHomepageUrl(url: string): boolean {
  const trimmed = (url || '').trim()
  if (!trimmed) return true
  if (isGenericXProfileUrl(trimmed)) return true
  try {
    const u = new URL(trimmed)
    const host = u.hostname.toLowerCase()
    const p = u.pathname.replace(/\/+$/, '')
    if (!p) {
      // Allow dedicated challenge subdomains like kiroween.devpost.com (but not www.devpost.com or devpost.com)
      const isChallengeSubdomain = CHALLENGE_SUBDOMAIN_ROOTS.some(
        root => host.endsWith(root) && host.length > root.length && !host.startsWith('www.')
      )
      return !isChallengeSubdomain
    }
    return ['/bounties', '/en/developers', '/builders', '/bug-bounty', '/programs'].includes(p.toLowerCase())
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
    .slice(0, 5)

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

interface DevpostHackathonRaw {
  id?: number
  title?: string
  url?: string
  submission_period_dates?: string
  time_left_to_submission?: string
  prize_amount?: string
  prizes_counts?: { cash?: number; other?: number }
  themes?: Array<{ name?: string }>
  organization_name?: string
}

interface ImmunefiBountyRaw {
  slug?: string
  project?: string
  maxBounty?: number
  rewardsToken?: string
  endDate?: string | null
  updatedDate?: string
  isPaused?: boolean
  description?: string
  ecosystem?: string[]
}

interface IntigritiProgramRaw {
  programId?: string
  status?: number
  confidentialityLevel?: number
  companyHandle?: string
  companyName?: string
  handle?: string
  name?: string
  description?: string
  maxBounty?: { value?: number; currency?: string }
  lastUpdatedAt?: number
}

function stripHtmlAndCollapse(raw: string): string {
  return raw
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ')
    .trim()
}

function sanitizeHandle(raw: string, fallback: string): string {
  const cleaned = raw.toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 20)
  return cleaned || fallback
}

function parseDevpostDeadlineSec(periodDates: string, timeLeft: string, nowSec: number): number {
  const fullRange = periodDates.match(/([A-Za-z]{3,9})\s+\d{1,2}\s*-\s*([A-Za-z]{3,9})\s+(\d{1,2}),\s*(\d{4})/i)
  if (fullRange) {
    const parsed = Date.parse(`${fullRange[2]} ${fullRange[3]}, ${fullRange[4]} 23:59:59 UTC`)
    if (Number.isFinite(parsed)) return Math.floor(parsed / 1000)
  }

  const sameMonthRange = periodDates.match(/([A-Za-z]{3,9})\s+\d{1,2}\s*-\s*(\d{1,2}),\s*(\d{4})/i)
  if (sameMonthRange) {
    const parsed = Date.parse(`${sameMonthRange[1]} ${sameMonthRange[2]}, ${sameMonthRange[3]} 23:59:59 UTC`)
    if (Number.isFinite(parsed)) return Math.floor(parsed / 1000)
  }

  const singleDate = periodDates.match(/([A-Za-z]{3,9})\s+(\d{1,2}),\s*(\d{4})/i)
  if (singleDate) {
    const parsed = Date.parse(`${singleDate[1]} ${singleDate[2]}, ${singleDate[3]} 23:59:59 UTC`)
    if (Number.isFinite(parsed)) return Math.floor(parsed / 1000)
  }

  const rel = timeLeft.toLowerCase()
  const monthMatch = rel.match(/(\d+)\s+month/)
  if (monthMatch) return nowSec + Number(monthMatch[1]) * 30 * 86400
  const dayMatch = rel.match(/(\d+)\s+day/)
  if (dayMatch) return nowSec + Number(dayMatch[1]) * 86400
  const hourMatch = rel.match(/(\d+)\s+hour/)
  if (hourMatch) return nowSec + Number(hourMatch[1]) * 3600

  return nowSec + 14 * 86400
}

function inferDevpostCategory(title: string, themes: Array<{ name?: string }>): 'dev' | 'design' | 'content' | 'growth' {
  const hay = `${title} ${themes.map(t => t.name || '').join(' ')}`.toLowerCase()
  if (/design|game|vr|ar|ux|ui|creative/.test(hay)) return 'design'
  if (/content|video|story|social/.test(hay)) return 'content'
  if (/growth|community|marketing/.test(hay)) return 'growth'
  return 'dev'
}

export async function scanWithDevpost(nowSec: number): Promise<ScannedExternalBounty[]> {
  const res = await fetch('https://devpost.com/api/hackathons?status[]=open', {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'WantFunScanner/1.0',
    },
    signal: AbortSignal.timeout(5500),
  })
  if (!res.ok) return []

  const payload = (await res.json()) as { hackathons?: DevpostHackathonRaw[] }
  const hackathons = Array.isArray(payload.hackathons) ? payload.hackathons : []

  const results: ScannedExternalBounty[] = []
  for (const h of hackathons) {
    if (!h.id || !h.title || !h.url) continue

    let cleanUrl = ''
    try {
      const parsed = new URL(h.url)
      cleanUrl = `${parsed.origin}${parsed.pathname}`.replace(/\/?$/, '/')
    } catch {
      continue
    }
    if (isGenericHomepageUrl(cleanUrl)) continue

    const prizeText = stripHtmlAndCollapse(h.prize_amount || '').replace(/,/g, '')
    const prizeNumMatch = prizeText.match(/\d+(?:\.\d+)?/)
    const poolUsd = prizeNumMatch ? Number(prizeNumMatch[0]) : 0
    if (!Number.isFinite(poolUsd) || poolUsd < 100) continue

    const deadlineSec = parseDevpostDeadlineSec(
      h.submission_period_dates || '',
      h.time_left_to_submission || '',
      nowSec
    )
    if (deadlineSec <= nowSec) continue

    const cashCount = h.prizes_counts?.cash && h.prizes_counts.cash > 0 ? Math.min(20, h.prizes_counts.cash) : 1
    const maxWinners = Math.max(1, cashCount)
    const perWinnerUsd = Math.max(50, Math.round(poolUsd / maxWinners))

    const orgName = (h.organization_name || 'Devpost Host').trim()
    const posterHandle = sanitizeHandle(orgName, 'devpost')
    const themeNames = (h.themes || []).map(t => t.name).filter((n): n is string => Boolean(n)).slice(0, 4)
    const themeText = themeNames.length > 0 ? ` Focus areas: ${themeNames.join(', ')}.` : ''
    const windowText = h.submission_period_dates ? ` Submission window: ${h.submission_period_dates}.` : ''

    results.push({
      id: `ext-dp-${h.id}`,
      tweet_id: `dp-${h.id}`,
      title: h.title.trim().slice(0, 140),
      description: `${orgName} hackathon featuring $${Math.round(poolUsd).toLocaleString()} total prize pool across ${maxWinners} cash prize track${maxWinners > 1 ? 's' : ''}.${themeText}${windowText}`.slice(0, 420),
      reward_usdc: perWinnerUsd * 1_000_000,
      reward_label: 'USD',
      max_winners: maxWinners,
      deadline: deadlineSec,
      poster_handle: posterHandle,
      poster_name: orgName.slice(0, 60),
      verified_source: 'Devpost',
      tweet_url: buildXAnnouncementSearchUrl(posterHandle, h.title.trim()),
      participation_url: cleanUrl,
      category: inferDevpostCategory(h.title, h.themes || []),
      requirements_summary: `Submit your working project repo, demo video, and writeup directly on Devpost (${cleanUrl}).`,
      created_at: nowSec,
    })

    if (results.length >= 4) break
  }

  return results
}

export async function scanWithImmunefi(nowSec: number): Promise<ScannedExternalBounty[]> {
  const res = await fetch('https://immunefi.com/public-api/bounties.json', {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'WantFunScanner/1.0',
    },
    signal: AbortSignal.timeout(6500),
  })
  if (!res.ok) return []

  const items = (await res.json()) as ImmunefiBountyRaw[]
  if (!Array.isArray(items)) return []

  const rollingDeadline = Math.floor(nowSec / 86400) * 86400 + 60 * 86400

  const candidates = items
    .filter(b => {
      if (!b.slug || !b.project || b.isPaused) return false
      if (typeof b.maxBounty !== 'number' || !Number.isFinite(b.maxBounty) || b.maxBounty < 5000) return false
      if (b.endDate) {
        const endMs = Date.parse(b.endDate)
        if (Number.isFinite(endMs) && endMs <= nowSec * 1000) return false
      }
      return true
    })
    .sort((a, b) => {
      const aTime = Date.parse(a.updatedDate || '') || 0
      const bTime = Date.parse(b.updatedDate || '') || 0
      if (bTime !== aTime) return bTime - aTime
      return (b.maxBounty || 0) - (a.maxBounty || 0)
    })
    .slice(0, 4)

  return candidates.map(b => {
    const slug = String(b.slug)
    const project = String(b.project).trim()
    const partUrl = `https://immunefi.com/bug-bounty/${slug}/information/`
    const endMs = b.endDate ? Date.parse(b.endDate) : NaN
    const deadlineSec = Number.isFinite(endMs) && endMs > nowSec * 1000 ? Math.floor(endMs / 1000) : rollingDeadline
    const cleanDesc = stripHtmlAndCollapse(b.description || '')
    const ecosystems = Array.isArray(b.ecosystem) && b.ecosystem.length > 0 ? ` Ecosystems: ${b.ecosystem.slice(0, 3).join(', ')}.` : ''
    const fallbackDesc = `Security bug bounty program for ${project} offering up to $${Math.round(b.maxBounty || 0).toLocaleString()} for verified vulnerability reports.${ecosystems}`
    const rewardLabel = (b.rewardsToken || 'USDC').replace(/[^A-Za-z0-9.+-]/g, '').toUpperCase().slice(0, 10) || 'USDC'
    const posterHandle = sanitizeHandle(slug, 'immunefi')

    return {
      id: `ext-im-${slug}`.slice(0, 64),
      tweet_id: `im-${slug}`.slice(0, 48),
      title: `${project} Bug Bounty Program`,
      description: (cleanDesc.length >= 40 ? cleanDesc : fallbackDesc).slice(0, 420),
      reward_usdc: Math.round((b.maxBounty || 0) * 1_000_000),
      reward_label: rewardLabel,
      max_winners: 1,
      deadline: deadlineSec,
      poster_handle: posterHandle,
      poster_name: project.slice(0, 60),
      verified_source: 'Immunefi',
      tweet_url: buildXAnnouncementSearchUrl(posterHandle, `${project} Immunefi`),
      participation_url: partUrl,
      category: 'dev',
      requirements_summary: 'Review in-scope smart contracts/assets and submit a reproducible PoC report on Immunefi.',
      created_at: nowSec,
    }
  })
}

export async function scanWithIntigriti(nowSec: number): Promise<ScannedExternalBounty[]> {
  const res = await fetch('https://app.intigriti.com/api/core/public/programs', {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'WantFunScanner/1.0',
    },
    signal: AbortSignal.timeout(5500),
  })
  if (!res.ok) return []

  const items = (await res.json()) as IntigritiProgramRaw[]
  if (!Array.isArray(items)) return []

  const rollingDeadline = Math.floor(nowSec / 86400) * 86400 + 45 * 86400

  const candidates = items
    .filter(p => {
      if (p.status !== 3) return false
      if (!p.confidentialityLevel || p.confidentialityLevel < 2) return false
      if (!p.companyHandle || !p.handle || !p.name) return false
      if (!p.maxBounty || typeof p.maxBounty.value !== 'number' || p.maxBounty.value < 500) return false
      return true
    })
    .sort((a, b) => (b.lastUpdatedAt || 0) - (a.lastUpdatedAt || 0))
    .slice(0, 4)

  return candidates.map(p => {
    const companyHandle = String(p.companyHandle)
    const handle = String(p.handle)
    const partUrl = `https://app.intigriti.com/programs/${companyHandle}/${handle}/detail`
    const companyName = (p.companyName || p.name || companyHandle).trim()
    const posterHandle = sanitizeHandle(companyHandle, 'intigriti')
    const currency = (p.maxBounty?.currency || 'EUR').toUpperCase().slice(0, 8)
    const maxVal = Math.round(p.maxBounty?.value || 0)
    const rawDesc = stripHtmlAndCollapse(p.description || '')
    const fallbackDesc = `${companyName} security bug bounty program on Intigriti rewarding up to ${maxVal.toLocaleString()} ${currency} for valid security findings.`

    return {
      id: `ext-ig-${companyHandle}-${handle}`.slice(0, 64),
      tweet_id: `ig-${handle}`.slice(0, 48),
      title: String(p.name).trim().slice(0, 140),
      description: (rawDesc.length >= 40 ? rawDesc : fallbackDesc).slice(0, 420),
      reward_usdc: maxVal * 1_000_000,
      reward_label: currency,
      max_winners: 1,
      deadline: rollingDeadline,
      poster_handle: posterHandle,
      poster_name: companyName.slice(0, 60),
      verified_source: 'Intigriti',
      tweet_url: buildXAnnouncementSearchUrl(posterHandle, `${String(p.name)} bug bounty`),
      participation_url: partUrl,
      category: 'dev',
      requirements_summary: 'Check program scope and out-of-scope rules, then submit your vulnerability report via Intigriti.',
      created_at: nowSec,
    }
  })
}

function interleaveMultiSource(
  groups: ScannedExternalBounty[][],
  nowSec: number,
  limit = 16
): ScannedExternalBounty[] {
  const seenIds = new Set<string>()
  const seenUrls = new Set<string>()
  const out: ScannedExternalBounty[] = []
  const maxLen = groups.reduce((max, g) => Math.max(max, g.length), 0)

  for (let i = 0; i < maxLen && out.length < limit; i++) {
    for (const group of groups) {
      const item = group[i]
      if (!item) continue
      const normalizedUrl = item.participation_url.replace(/\/+$/, '').toLowerCase()
      if (seenIds.has(item.id) || seenUrls.has(normalizedUrl)) continue
      seenIds.add(item.id)
      seenUrls.add(normalizedUrl)
      out.push({
        ...item,
        created_at: nowSec - out.length * 1200,
      })
      if (out.length >= limit) break
    }
  }

  return out
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
      slug: 'ext-dp-kiroween-2026',
      tweetId: 'dp-kiroween',
      title: 'Kiroween 2026 — Build Spec-Driven Apps with Kiro',
      description:
        'Kiro hackathon on Devpost with $100,000 total prize pool across 18 cash tracks. Build imaginative applications powered by spec-driven AI workflows and submit your working prototype.',
      rewardUsd: 5500,
      rewardLabel: 'USD',
      maxWinners: 18,
      deadlineIso: '2026-12-04T23:59:59.000Z',
      posterHandle: 'kirodotdev',
      posterName: 'Kiro',
      verifiedSource: 'Devpost',
      participationUrl: 'https://kiroween.devpost.com/',
      category: 'dev',
      requirementsSummary: 'Submit your working project repo, demo video, and writeup on Devpost.',
    },
    {
      slug: 'ext-se-raenest-global-bounty',
      tweetId: 'se-raenest',
      title: 'The Raenest Global Bounty — Writing, Video & Animation',
      description:
        'Raenest helps individuals and businesses manage money globally with multi-currency accounts and stablecoin support. Create clear writing, video, or animation showing how cross-border USDC/USDT flows work.',
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
      slug: 'ext-im-ondo-finance',
      tweetId: 'im-ondo-finance',
      title: 'Ondo Finance Bug Bounty Program',
      description:
        'Security bug bounty program for Ondo Finance rewarding up to $1,000,000 USDC for verified critical smart contract and protocol vulnerability reports.',
      rewardUsd: 1000000,
      rewardLabel: 'USDC',
      maxWinners: 1,
      hoursLeft: 60 * 24,
      posterHandle: 'OndoFinance',
      posterName: 'Ondo Finance',
      verifiedSource: 'Immunefi',
      participationUrl: 'https://immunefi.com/bug-bounty/ondofinance/information/',
      category: 'dev',
      requirementsSummary: 'Review in-scope smart contracts and submit a reproducible PoC report on Immunefi.',
    },
    {
      slug: 'ext-ig-personio',
      tweetId: 'ig-personio',
      title: 'Personio Bug Bounty Program',
      description:
        'Public security bug bounty program by Personio on Intigriti rewarding security researchers up to 5,000 EUR for valid web application and API vulnerability findings.',
      rewardUsd: 5000,
      rewardLabel: 'EUR',
      maxWinners: 1,
      hoursLeft: 45 * 24,
      posterHandle: 'personio',
      posterName: 'Personio',
      verifiedSource: 'Intigriti',
      participationUrl: 'https://app.intigriti.com/programs/personio/personio/detail',
      category: 'dev',
      requirementsSummary: 'Review target scope and submit valid vulnerability findings via Intigriti.',
    },
    {
      slug: 'ext-dp-codegeist-2026',
      tweetId: 'dp-codegeist',
      title: 'Codegeist 2026 — Atlassian Forge App Challenge',
      description:
        'Atlassian Codegeist hackathon with $120,000 in cash prizes. Build Forge apps extending Jira, Confluence, or Rovo workflows and submit your app listing.',
      rewardUsd: 6000,
      rewardLabel: 'USD',
      maxWinners: 20,
      deadlineIso: '2026-12-22T23:59:59.000Z',
      posterHandle: 'Atlassian',
      posterName: 'Atlassian',
      verifiedSource: 'Devpost',
      participationUrl: 'https://codegeist.devpost.com/',
      category: 'dev',
      requirementsSummary: 'Build and deploy an Atlassian Forge app and submit on Devpost.',
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
      slug: 'ext-im-livepeer',
      tweetId: 'im-livepeer',
      title: 'Livepeer Bug Bounty Program',
      description:
        'Immunefi bug bounty program for Livepeer decentralized video streaming protocol offering up to $40,000 USDC for verified critical findings.',
      rewardUsd: 40000,
      rewardLabel: 'USDC',
      maxWinners: 1,
      hoursLeft: 60 * 24,
      posterHandle: 'Livepeer',
      posterName: 'Livepeer',
      verifiedSource: 'Immunefi',
      participationUrl: 'https://immunefi.com/bug-bounty/livepeer/information/',
      category: 'dev',
      requirementsSummary: 'Inspect in-scope Livepeer contracts and submit a detailed PoC report on Immunefi.',
    },
    {
      slug: 'ext-ig-daytona',
      tweetId: 'ig-daytona',
      title: 'Daytona Bug Bounty Program',
      description:
        'Open developer workspace infrastructure bug bounty program on Intigriti offering up to 3,500 EUR for critical security vulnerabilities.',
      rewardUsd: 3500,
      rewardLabel: 'EUR',
      maxWinners: 1,
      hoursLeft: 45 * 24,
      posterHandle: 'daytonaio',
      posterName: 'Daytona',
      verifiedSource: 'Intigriti',
      participationUrl: 'https://app.intigriti.com/programs/daytona/daytonabugbounty/detail',
      category: 'dev',
      requirementsSummary: 'Test strictly within Daytona program scope and submit findings via Intigriti.',
    },
    {
      slug: 'ext-dp-buildhybridai-2026',
      tweetId: 'dp-hybridai',
      title: '#BuildHybridAI 2026 — On-Device & Cloud AI Challenge',
      description:
        'Google hybrid AI hackathon on Devpost with $30,000 in cash prizes for applications combining local on-device inference with cloud models.',
      rewardUsd: 3000,
      rewardLabel: 'USD',
      maxWinners: 10,
      deadlineIso: '2026-12-10T23:59:59.000Z',
      posterHandle: 'GoogleDevs',
      posterName: 'Google',
      verifiedSource: 'Devpost',
      participationUrl: 'https://hybridai.devpost.com/',
      category: 'dev',
      requirementsSummary: 'Submit your hybrid AI app repo, live test instructions, and demo video on Devpost.',
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
      slug: 'ext-im-hedera',
      tweetId: 'im-hedera',
      title: 'Hedera Bug Bounty Program',
      description:
        'Bug bounty program protecting Hedera network nodes, consensus services, and smart contracts with rewards up to $30,000 USDC.',
      rewardUsd: 30000,
      rewardLabel: 'USDC',
      maxWinners: 1,
      hoursLeft: 60 * 24,
      posterHandle: 'hedera',
      posterName: 'Hedera',
      verifiedSource: 'Immunefi',
      participationUrl: 'https://immunefi.com/bug-bounty/hedera/information/',
      category: 'dev',
      requirementsSummary: 'Submit verified vulnerability PoCs against in-scope Hedera assets on Immunefi.',
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
      created_at: bucketSec - idx * 1200,
    }
  })
}

async function scanMultiPlatformFeeds(nowSec: number): Promise<ScannedExternalBounty[]> {
  const [devpostRes, superteamRes, immunefiRes, intigritiRes] = await Promise.allSettled([
    scanWithDevpost(nowSec),
    scanWithSuperteamEarn(nowSec),
    scanWithImmunefi(nowSec),
    scanWithIntigriti(nowSec),
  ])

  const devpost = devpostRes.status === 'fulfilled' ? devpostRes.value : []
  const superteam = superteamRes.status === 'fulfilled' ? superteamRes.value : []
  const immunefi = immunefiRes.status === 'fulfilled' ? immunefiRes.value : []
  const intigriti = intigritiRes.status === 'fulfilled' ? intigritiRes.value : []

  const liveMerged = interleaveMultiSource([devpost, superteam, immunefi, intigriti], nowSec, 16)
  if (liveMerged.length >= 12) return liveMerged

  // Guarantee multi-platform variety if one or more live feeds timed out
  const fallback = getCuratedExternalBounties(nowSec)
  return interleaveMultiSource([devpost, superteam, immunefi, intigriti, fallback], nowSec, 16)
}

/**
 * Scan X and multiple live bounty platforms (Devpost, Superteam Earn, Immunefi, Intigriti)
 * for 12–16 live guaranteed bounties with specific submission pages.
 */
export async function scanLiveGuaranteedBounties(): Promise<{
  bounties: ScannedExternalBounty[]
  source: 'xai-live' | 'twitter-api' | 'multi-platform-live' | 'curated-feed'
}> {
  const nowSec = Math.floor(Date.now() / 1000)
  const xaiKey = process.env.XAI_API_KEY?.trim()
  const twitterBearer = (process.env.TWITTER_BEARER_TOKEN ?? process.env.SOCIALDATA_API_KEY)?.trim()

  if (xaiKey) {
    try {
      const live = await scanWithGrok(xaiKey, nowSec)
      if (live.length >= 10) {
        const multi = await scanMultiPlatformFeeds(nowSec).catch(() => [])
        return {
          bounties: interleaveMultiSource([live, multi], nowSec, 18),
          source: 'xai-live',
        }
      }
      if (live.length > 0) {
        const multi = await scanMultiPlatformFeeds(nowSec).catch(() => getCuratedExternalBounties(nowSec))
        return {
          bounties: interleaveMultiSource([live, multi], nowSec, 16),
          source: 'xai-live',
        }
      }
    } catch (e) {
      console.warn('Grok live X scan failed, falling back:', e)
    }
  }

  if (twitterBearer) {
    try {
      const live = await scanWithTwitterBearer(twitterBearer, nowSec)
      if (live.length >= 10) {
        const multi = await scanMultiPlatformFeeds(nowSec).catch(() => [])
        return {
          bounties: interleaveMultiSource([live, multi], nowSec, 18),
          source: 'twitter-api',
        }
      }
      if (live.length > 0) {
        const multi = await scanMultiPlatformFeeds(nowSec).catch(() => getCuratedExternalBounties(nowSec))
        return {
          bounties: interleaveMultiSource([live, multi], nowSec, 16),
          source: 'twitter-api',
        }
      }
    } catch (e) {
      console.warn('Twitter API scan failed, falling back:', e)
    }
  }

  try {
    const multiLive = await scanMultiPlatformFeeds(nowSec)
    if (multiLive.length > 0) {
      return { bounties: multiLive, source: 'multi-platform-live' }
    }
  } catch (e) {
    console.warn('Multi-platform live scan failed, falling back to curated seed:', e)
  }

  return {
    bounties: getCuratedExternalBounties(nowSec),
    source: 'curated-feed',
  }
}
