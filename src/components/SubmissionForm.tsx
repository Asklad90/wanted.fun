import { useRef, useState } from 'react'
import { useAccount, useSignMessage } from 'wagmi'
import { toast } from 'sonner'
import { WindowCard } from './WindowCard'
import { PillButton } from './PillButton'
import { ACCEPT, LIMITS, checkFile, normaliseFile, sendSubmission } from '../lib/submissions-api'

interface Props {
  bountyId: bigint
  onSubmitted?: () => void
}

const fmtSize = (n: number) => (n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`)

/** Free submission form: no gas. The worker only signs a message with their wallet. */
export function SubmissionForm({ bountyId, onSubmitted }: Props) {
  const { address } = useAccount()
  const { signMessageAsync } = useSignMessage()
  const [note, setNote] = useState('')
  const [links, setLinks] = useState<string[]>([])
  const [linkDraft, setLinkDraft] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [busy, setBusy] = useState(false)
  const [step, setStep] = useState('')
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')
  const fileInput = useRef<HTMLInputElement>(null)

  function addLink() {
    const v = linkDraft.trim()
    if (!v) return
    try {
      const u = new URL(v)
      if (u.protocol !== 'https:') throw new Error()
    } catch { toast.error('Links must be valid and start with https://'); return }
    if (links.length >= LIMITS.links) { toast.error(`Max ${LIMITS.links} links.`); return }
    setLinks([...links, v]); setLinkDraft('')
  }

  function onPick(list: FileList | null) {
    if (!list) return
    const next = [...files]
    for (const raw of Array.from(list)) {
      const f = normaliseFile(raw)
      const err = checkFile(f)
      if (err) { toast.error(err); continue }
      if (next.length >= LIMITS.files) { toast.error(`Max ${LIMITS.files} files.`); break }
      next.push(f)
    }
    setFiles(next)
    if (fileInput.current) fileInput.current.value = ''
  }

  async function handleSubmit() {
    if (!address) return
    setError(''); setBusy(true)
    try {
      // include a link that was typed but not added yet
      const pending = linkDraft.trim()
      await sendSubmission(
        { bountyId, submitter: address, note, links: pending ? [...links, pending] : links, files },
        (m) => signMessageAsync({ message: m }),
        setStep,
      )
      setDone(true); setNote(''); setLinks([]); setLinkDraft(''); setFiles([])
      toast.success('Submitted! The poster can now review your work.')
      onSubmitted?.()
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Something went wrong.'
      setError(/rejected|denied/i.test(msg) ? 'Signature cancelled. Nothing was submitted.' : msg)
    } finally { setBusy(false); setStep('') }
  }

  if (done) {
    return (
      <WindowCard title="SUBMITTED.EXE" titleBarColor="#C6F23A">
        <div className="flex flex-col gap-2">
          <div className="font-heading text-[20px] font-extrabold text-[#111]">Your work is in!</div>
          <div className="font-body text-[14px] text-[#111]/70">Only the poster can see it. If they pick you, the prize is sent straight to your wallet. You paid nothing.</div>
        </div>
      </WindowCard>
    )
  }

  return (
    <WindowCard title="SUBMIT_WORK.EXE" titleBarColor="#A78BFA">
      <div className="flex flex-col gap-3">
        <div className="font-mono-ui text-[11px] text-[#111]/70 border-2 border-[#111] rounded-lg p-2 bg-[#C6F23A]/30">
          Free to submit. You only sign a message, so no gas. Only the poster can see your work.
        </div>

        <label className="font-mono-bold text-[11px] uppercase tracking-wider">Note (optional)</label>
        <textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={LIMITS.note} rows={4}
          placeholder="Describe your work..."
          className="border-[3px] border-[#111] rounded-lg px-3 py-2.5 text-[16px] font-body bg-white focus:outline-none focus:bg-[#FFFDF0] w-full resize-none" />
        <div className="font-mono-ui text-[10px] text-right text-[#111]/40">{note.length}/{LIMITS.note}</div>

        <label className="font-mono-bold text-[11px] uppercase tracking-wider">Links (up to {LIMITS.links}, https only)</label>
        <div className="flex gap-2">
          <input value={linkDraft} onChange={(e) => setLinkDraft(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addLink() } }}
            placeholder="https://..." inputMode="url" autoCapitalize="none"
            className="border-[3px] border-[#111] rounded-lg px-3 py-2 text-[16px] font-body bg-white focus:outline-none w-full" />
          <PillButton size="sm" variant="cyan" showArrow={false} onClick={addLink}>Add</PillButton>
        </div>
        {links.map((l, i) => (
          <div key={l + i} className="flex items-center justify-between gap-2 border-2 border-[#111] rounded-lg px-2 py-1.5 bg-white">
            <span className="font-mono-ui text-[11px] truncate">{l}</span>
            <button type="button" onClick={() => setLinks(links.filter((_, j) => j !== i))} className="font-mono-bold text-[12px] px-2" aria-label="Remove link">x</button>
          </div>
        ))}

        <label className="font-mono-bold text-[11px] uppercase tracking-wider">Images and videos (up to {LIMITS.files})</label>
        <div className="font-mono-ui text-[10px] text-[#111]/50">png, jpg, webp up to 5 MB. mp4, webm up to 25 MB. For bigger videos paste a link.</div>
        <input ref={fileInput} type="file" accept={ACCEPT} multiple className="hidden" onChange={(e) => onPick(e.target.files)} />
        <PillButton size="sm" variant="yellow" showArrow={false} onClick={() => fileInput.current?.click()}>Add image or video</PillButton>
        {files.map((f, i) => (
          <div key={f.name + i} className="flex items-center justify-between gap-2 border-2 border-[#111] rounded-lg px-2 py-1.5 bg-white">
            <span className="font-mono-ui text-[11px] truncate">{f.name} ({fmtSize(f.size)})</span>
            <button type="button" onClick={() => setFiles(files.filter((_, j) => j !== i))} className="font-mono-bold text-[12px] px-2" aria-label="Remove file">x</button>
          </div>
        ))}

        {busy && <div className="font-mono-bold text-[12px] uppercase tracking-wider text-[#111]/70 animate-pulse">{step}</div>}
        {error && <div className="font-mono-bold text-[12px] text-[#FF3E9A] border-2 border-[#FF3E9A] rounded-lg p-2 bg-white">{error}</div>}
        <PillButton onClick={handleSubmit} loading={busy} disabled={busy}>Submit work for free </PillButton>
      </div>
    </WindowCard>
  )
}
