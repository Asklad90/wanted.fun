/**
 * SubmissionViewer — renders off-chain submission content with auto-detection:
 *   • base64 data URL (image) → inline image preview
 *   • base64 data URL (video) → inline video player
 *   • YouTube URL            → embedded iframe player
 *   • Image URL (.jpg etc.)  → inline image preview + link
 *   • Plain URL              → clickable link with icon
 *   • Raw text               → plain paragraph
 */

import { useState } from 'react'

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

/** Parse a combined text+file JSON envelope, or return null if not that format. */
function parseCombo(str: string): { text?: string; file?: string } | null {
  if (!str.startsWith('{')) return null
  try {
    const p = JSON.parse(str) as Record<string, unknown>
    if (typeof p === 'object' && p !== null && ('text' in p || 'file' in p)) {
      return { text: typeof p.text === 'string' ? p.text : undefined, file: typeof p.file === 'string' ? p.file : undefined }
    }
  } catch { /* not JSON */ }
  return null
}

/** Returns the mime type from a data URL prefix, or null if not a data URL */
function dataUrlMime(str: string): string | null {
  const m = str.match(/^data:([a-z0-9+/]+\/[a-z0-9+/.]+);base64,/i)
  return m ? m[1].toLowerCase() : null
}

/** Progressive image with blur-up skeleton while loading */
function LazyImage({ src, alt, className = '' }: { src: string; alt: string; className?: string }) {
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState(false)
  return (
    <div className={`relative overflow-hidden bg-[#111]/5 ${className}`}>
      {!loaded && !error && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-[#111]/20 border-t-[#A3E635] rounded-full animate-spin" />
        </div>
      )}
      {error ? (
        <div className="flex flex-col items-center justify-center py-8 gap-2 text-[#111]/40">
          <svg width={28} height={28} viewBox="0 0 24 24" fill="none"><path d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
          <span className="font-mono-ui text-[10px] uppercase tracking-wider">Image failed to load</span>
        </div>
      ) : (
        <img
          src={src}
          alt={alt}
          loading="lazy"
          decoding="async"
          onLoad={() => setLoaded(true)}
          onError={() => setError(true)}
          className={`w-full max-h-80 object-contain transition-opacity duration-300 ${loaded ? 'opacity-100' : 'opacity-0'}`}
        />
      )}
    </div>
  )
}

export function SubmissionViewer({ content, className = '' }: SubmissionViewerProps) {
  const trimmed = content.trim()

  // ── Combined text + file (JSON envelope) ───────────────────────────────────
  const combined = parseCombo(trimmed)
  if (combined) {
    return (
      <div className={`flex flex-col gap-3 ${className}`}>
        {combined.text && (
          <p className="font-body text-[14px] text-[#111]/80 whitespace-pre-wrap leading-relaxed">
            {combined.text}
          </p>
        )}
        {combined.file && <SubmissionViewer content={combined.file} />}
      </div>
    )
  }

  // ── Base64 data URLs (uploaded files) ──────────────────────────────────────
  const mime = dataUrlMime(trimmed)
  if (mime) {
    if (mime.startsWith('image/')) {
      return (
        <div className={`rounded-xl overflow-hidden border-[2px] border-[#111]/20 ${className}`}>
          <LazyImage src={trimmed} alt="Uploaded submission" className="bg-[#FFFDF0]" />
        </div>
      )
    }
    if (mime.startsWith('video/')) {
      return (
        <div className={`rounded-xl overflow-hidden border-[2px] border-[#111]/20 bg-black ${className}`}>
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <video
            src={trimmed}
            controls
            preload="metadata"
            className="w-full max-h-80"
          />
        </div>
      )
    }
    // Unknown data URL type — show a generic file badge
    return (
      <div className={`flex items-center gap-2 border-[2px] border-[#111]/20 rounded-xl p-3 bg-[#FFFDF0] ${className}`}>
        <FileIcon />
        <span className="font-mono-ui text-[11px] text-[#111]/60">Uploaded file ({mime})</span>
      </div>
    )
  }

  // ── YouTube ────────────────────────────────────────────────────────────────
  const ytId = isYoutube(trimmed)
  if (ytId) {
    return (
      <div className={`w-full aspect-video rounded-xl overflow-hidden border-[2px] border-[#111]/20 ${className}`}>
        <iframe
          src={`https://www.youtube.com/embed/${ytId}`}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          loading="lazy"
          className="w-full h-full"
          title="YouTube submission"
        />
      </div>
    )
  }

  // ── Image URL ──────────────────────────────────────────────────────────────
  if (isImageUrl(trimmed)) {
    return (
      <div className={`rounded-xl overflow-hidden border-[2px] border-[#111]/20 ${className}`}>
        <LazyImage src={trimmed} alt="Submission preview" className="bg-[#FFFDF0]" />
        <div className="px-3 py-1.5 bg-[#FFFDF0] border-t-[2px] border-[#111]/10">
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
        className={`inline-flex items-center gap-1.5 font-mono-ui text-[12px] text-[#1A1AE6] underline break-all hover:text-[#FF3E9A] transition-colors ${className}`}>
        <ExternalLinkIcon />
        {trimmed}
      </a>
    )
  }

  // ── Plain text ─────────────────────────────────────────────────────────────
  return (
    <p className={`font-body text-[14px] text-[#111]/80 whitespace-pre-wrap leading-relaxed ${className}`}>
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
