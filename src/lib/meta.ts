/**
 * Dynamic SEO and social metadata updater for Want.fun
 */
export interface MetaOptions {
  title?: string
  description?: string
  canonicalPath?: string
}

const DEFAULT_TITLE = 'Want.fun — Onchain USDC Bounty Board & Escrow'
const DEFAULT_DESC = 'Lock USDC in escrow, get work done onchain. 100% Escrow Guaranteed on Arc before a single worker types a word.'

export function updatePageMeta(options: MetaOptions = {}) {
  if (typeof document === 'undefined') return

  const title = options.title ? `${options.title} · Want.fun` : DEFAULT_TITLE
  const description = options.description || DEFAULT_DESC

  // Title
  document.title = title

  // Meta Description
  let descMeta = document.querySelector('meta[name="description"]')
  if (!descMeta) {
    descMeta = document.createElement('meta')
    descMeta.setAttribute('name', 'description')
    document.head.appendChild(descMeta)
  }
  descMeta.setAttribute('content', description)

  // Open Graph Title
  let ogTitle = document.querySelector('meta[property="og:title"]')
  if (ogTitle) ogTitle.setAttribute('content', title)

  // Open Graph Description
  let ogDesc = document.querySelector('meta[property="og:description"]')
  if (ogDesc) ogDesc.setAttribute('content', description)

  // Twitter Title
  let twitterTitle = document.querySelector('meta[name="twitter:title"]')
  if (twitterTitle) twitterTitle.setAttribute('content', title)

  // Twitter Description
  let twitterDesc = document.querySelector('meta[name="twitter:description"]')
  if (twitterDesc) twitterDesc.setAttribute('content', description)

  // Canonical
  if (options.canonicalPath !== undefined) {
    let canonical = document.querySelector('link[rel="canonical"]')
    if (!canonical) {
      canonical = document.createElement('link')
      canonical.setAttribute('rel', 'canonical')
      document.head.appendChild(canonical)
    }
    canonical.setAttribute('href', `https://want.fun/${options.canonicalPath.replace(/^\//, '')}`)
  }
}
