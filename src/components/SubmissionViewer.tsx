/**
 * SubmissionViewer — renders off-chain submission content with auto-detection:
 *   • YouTube URL → embedded iframe player
 *   • Image URL (.jpg .png .gif .webp .svg) → inline image preview
 *   • Plain URL → clickable link
 *   • Raw text → plain paragraph
 */

interface SubmissionViewerProps {
  content: string
  className?: string
}

function isYoutube(str: string): string | null {
  try {
    const u = new URL(str)
    if (u.hostname === 'youtu.be') {
      return u.pathname.slice(1)
    }
    if (u.hostname.includes('youtube.com')) {
      return u.searchParams.get('v')
    }
  } catch {
    // not a URL
  }
  return null
}

function isImageUrl(str: string): boolean {
  try {
    const u = new URL(str)
    return /\.(jpg|jpeg|png|gif|webp|svg)(\?|$)/i.test(u.pathname)
  } catch {
    return false
  }
}

function isUrl(str: string): boolean {
  try {
    const u = new URL(str)
    return u.protocol === 'http:' || u.protocol === 'https:'
  } catch {
    return false
  }
}

export function SubmissionViewer({ content, className = '' }: SubmissionViewerProps) {
  const trimmed = content.trim()

  const ytId = isYoutube(trimmed)
  if (ytId) {
    return (
      <div className={`w-full aspect-video rounded-lg overflow-hidden border-[2px] border-[#111] ${className}`}>
        <iframe
          src={`https://www.youtube.com/embed/${ytId}`}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          className="w-full h-full"
          title="YouTube submission"
        />
      </div>
    )
  }

  if (isImageUrl(trimmed)) {
    return (
      <div className={`rounded-lg overflow-hidden border-[2px] border-[#111] ${className}`}>
        <img
          src={trimmed}
          alt="Submission preview"
          className="w-full max-h-64 object-contain bg-[#FFFDF0]"
          loading="lazy"
        />
        <div className="px-3 py-1.5 bg-[#FFFDF0] border-t-[2px] border-[#111]">
          <a
            href={trimmed}
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono-ui text-[10px] text-[#1A1AE6] underline break-all"
          >
            {trimmed}
          </a>
        </div>
      </div>
    )
  }

  if (isUrl(trimmed)) {
    return (
      <a
        href={trimmed}
        target="_blank"
        rel="noopener noreferrer"
        className={`flex items-center gap-1.5 font-mono-ui text-[12px] text-[#1A1AE6] underline break-all hover:text-[#FF3E9A] transition-colors ${className}`}
      >
        <ExternalLinkIcon />
        {trimmed}
      </a>
    )
  }

  return (
    <p className={`font-body text-[13px] text-[#111]/80 whitespace-pre-wrap leading-relaxed ${className}`}>
      {trimmed}
    </p>
  )
}

function ExternalLinkIcon() {
  return (
    <svg width={12} height={12} viewBox="0 0 12 12" fill="none" className="shrink-0">
      <path d="M5 2H2v8h8V7M7 2h3v3M10 2L5.5 6.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
