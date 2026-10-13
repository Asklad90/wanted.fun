/**
 * SubmissionViewer — renders off-chain submission content with auto-detection:
 *   • base64 data URL (image) → inline image preview
 *   • base64 data URL (video) → inline video player
 *   • YouTube URL            → embedded iframe player
 *   • Image URL (.jpg etc.)  → inline image preview + link
 *   • Plain URL              → clickable link with icon
 *   • Raw text               → plain paragraph
 */

interface SubmissionViewerProps {
  content: string
  className?: string
}

function isYoutube(str: string): string | null {
  try {
    const u = new URL(str)
    if (u.hostname === 'youtu.be') return u.pathname.slice(1)
    if (u.hostname.includes('youtube.com')) return u.searchParams.get('v')
  } catch { /* not a URL */ }
  return null
}

function isImageUrl(str: string): boolean {
  try {
    const u = new URL(str)
    return /\.(jpg|jpeg|png|gif|webp|svg)(\?|$)/i.test(u.pathname)
  } catch { return false }
}

function isUrl(str: string): boolean {
  try {
    const u = new URL(str)
    return u.protocol === 'http:' || u.protocol === 'https:'
  } catch { return false }
}

/** Returns the mime type from a data URL prefix, or null if not a data URL */
function dataUrlMime(str: string): string | null {
  const m = str.match(/^data:([a-z0-9+/]+\/[a-z0-9+/.]+);base64,/i)
  return m ? m[1].toLowerCase() : null
}

export function SubmissionViewer({ content, className = '' }: SubmissionViewerProps) {
  const trimmed = content.trim()

  // ── Base64 data URLs (uploaded files) ──────────────────────────────────────
  const mime = dataUrlMime(trimmed)
  if (mime) {
    if (mime.startsWith('image/')) {
      return (
        <div className={`rounded-lg overflow-hidden border-[2px] border-[#111] ${className}`}>
          <img
            src={trimmed}
            alt="Uploaded submission"
            className="w-full max-h-80 object-contain bg-[#FFFDF0]"
          />
        </div>
      )
    }
    if (mime.startsWith('video/')) {
      return (
        <div className={`rounded-lg overflow-hidden border-[2px] border-[#111] bg-black ${className}`}>
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <video
            src={trimmed}
            controls
            className="w-full max-h-80"
          />
        </div>
      )
    }
    // Unknown data URL type — show a generic file badge
    return (
      <div className={`flex items-center gap-2 border-[2px] border-[#111] rounded-lg p-3 bg-[#FFFDF0] ${className}`}>
        <FileIcon />
        <span className="font-mono-ui text-[11px] text-[#111]/60">Uploaded file ({mime})</span>
      </div>
    )
  }

  // ── YouTube ────────────────────────────────────────────────────────────────
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

  // ── Image URL ──────────────────────────────────────────────────────────────
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
          <a href={trimmed} target="_blank" rel="noopener noreferrer"
            className="font-mono-ui text-[10px] text-[#1A1AE6] underline break-all">
            {trimmed}
          </a>
        </div>
      </div>
    )
  }

  // ── Plain URL ──────────────────────────────────────────────────────────────
  if (isUrl(trimmed)) {
    return (
      <a href={trimmed} target="_blank" rel="noopener noreferrer"
        className={`flex items-center gap-1.5 font-mono-ui text-[12px] text-[#1A1AE6] underline break-all hover:text-[#FF3E9A] transition-colors ${className}`}>
        <ExternalLinkIcon />
        {trimmed}
      </a>
    )
  }

  // ── Plain text ─────────────────────────────────────────────────────────────
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

function FileIcon() {
  return (
    <svg width={16} height={16} viewBox="0 0 16 16" fill="none">
      <path d="M3 2h7l3 3v9H3V2z" fill="#A78BFA" stroke="#111" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M10 2v3h3" stroke="#111" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  )
}
