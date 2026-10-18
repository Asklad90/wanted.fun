/**
 * Should we pre-ask the wallet for the "submit" signature when a bounty page opens?
 *
 * Only when the submit form is actually going to be shown to this wallet — otherwise
 * people who already submitted (or can't submit) get a pointless "Sign message" popup
 * every time they open the bounty. Mirrors the form-visibility rule in BountyPage.
 */
export interface PrimeInput {
  /** connected wallet */
  address?: string
  /** bounty creator */
  poster?: string
  /** wallet the loaded submissions list was fetched for (null = not loaded yet) */
  subsLoadedFor: string | null
  /** bounty is still OPEN (not expired / cancelled / full) */
  open: boolean
  /** submitter addresses already on the bounty (as visible to this wallet) */
  submitters: string[]
  /** onchain payout status for this wallet (0/undefined = none) */
  payoutStatus?: number
}

export function shouldPrimeSubmitAuth(i: PrimeInput): boolean {
  if (!i.address || !i.poster) return false
  const me = i.address.toLowerCase()
  if (me === i.poster.toLowerCase()) return false // creators can't submit
  if (i.subsLoadedFor !== me) return false // don't guess before we know whether they've submitted
  if (!i.open) return false
  if (i.submitters.some(s => s.toLowerCase() === me)) return false // already submitted
  if (i.payoutStatus !== undefined && i.payoutStatus !== 0) return false // already a winner
  return true
}
