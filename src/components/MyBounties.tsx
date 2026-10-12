import { useEffect, useState } from 'react'
import { useAccount, useReadContract, useSignMessage } from 'wagmi'
import { BountyCard, BountyData } from './BountyCard'
import { WindowCard } from './WindowCard'
import { PillButton } from './PillButton'
import { TrophyIcon, FolderIcon } from './Icons'
import { BOUNTY_BOARD_ABI } from '../bounty-abi'
import { CHAIN_ID, CONTRACT_ADDRESS } from '../bounty-config'
import { hasCachedAuth, mySubmissions } from '../lib/submissions-api'

interface MyBountiesProps {
  onSelectBounty: (id: bigint) => void
  onCreateBounty: () => void
}

function useBounty(id: bigint) {
  const { data } = useReadContract({
    address: CONTRACT_ADDRESS, abi: BOUNTY_BOARD_ABI, functionName: 'getBounty',
    args: [id], chainId: CHAIN_ID,
  })
  return data as BountyData | undefined
}

function BountyItem({ id, onSelect }: { id: bigint; onSelect: (id: bigint) => void }) {
  const bounty = useBounty(id)
  if (!bounty) return <div className="border-[3px] border-[#111] rounded-lg bg-[#FFFDF0] animate-pulse h-52" />
  return <BountyCard bounty={bounty} onClick={() => onSelect(id)} />
}

export function MyBounties({ onSelectBounty, onCreateBounty }: MyBountiesProps) {
  const { address } = useAccount()

  const { data: ids } = useReadContract({
    address: CONTRACT_ADDRESS, abi: BOUNTY_BOARD_ABI, functionName: 'getBountiesByPoster',
    args: [address ?? '0x0000000000000000000000000000000000000000'],
    chainId: CHAIN_ID, query: { enabled: !!address },
  }) as { data: bigint[] | undefined }

  if (!address) return (
    <WindowCard title="MY_BOUNTIES.EXE" titleBarColor="#FF3E9A">
      <div className="font-mono-bold text-[12px] uppercase tracking-widest text-[#111]/60 text-center py-8">Connect wallet to see your bounties</div>
    </WindowCard>
  )

  const list = ids ?? []

  if (list.length === 0) return (
    <WindowCard title="MY_BOUNTIES.EXE" titleBarColor="#FF3E9A">
      <div className="checkerboard rounded-lg py-12 flex flex-col items-center gap-4">
        <TrophyIcon size={40} />
        <div className="font-mono-bold text-[12px] uppercase tracking-widest text-[#111]/60">You haven't posted any bounties yet</div>
        <PillButton onClick={onCreateBounty} variant="yellow">Post a bounty →</PillButton>
      </div>
    </WindowCard>
  )

  return (
    <div className="flex flex-col gap-4">
      <h2 className="font-heading text-[18px] font-bold text-[#111]">My Bounties ({list.length})</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {[...list].reverse().map(id => <BountyItem key={id.toString()} id={id} onSelect={onSelectBounty} />)}
      </div>
    </div>
  )
}

interface MySubmissionsProps {
  onSelectBounty: (id: bigint) => void
}

export function MySubmissions({ onSelectBounty }: MySubmissionsProps) {
  const { address } = useAccount()
  const { signMessageAsync } = useSignMessage()
  const [remoteIds, setRemoteIds] = useState<bigint[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const { data: ids } = useReadContract({
    address: CONTRACT_ADDRESS, abi: BOUNTY_BOARD_ABI, functionName: 'getBountiesBySubmitter',
    args: [address ?? '0x0000000000000000000000000000000000000000'],
    chainId: CHAIN_ID, query: { enabled: !!address },
  }) as { data: bigint[] | undefined }

  // Free (off-chain) submissions are private, so loading them needs a free signature.
  async function loadRemote() {
    if (!address) return
    setLoading(true); setError('')
    try {
      const r = await mySubmissions(address, (m) => signMessageAsync({ message: m }))
      setRemoteIds(r.submissions.map((x) => BigInt(x.bountyId)))
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Could not load submissions.'
      setError(/rejected|denied/i.test(msg) ? 'Signature cancelled.' : msg)
    } finally { setLoading(false) }
  }
  useEffect(() => {
    if (address && hasCachedAuth('mine', address)) void loadRemote()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address])

  if (!address) return (
    <WindowCard title="MY_SUBMISSIONS.EXE" titleBarColor="#A78BFA">
      <div className="font-mono-bold text-[12px] uppercase tracking-widest text-[#111]/60 text-center py-8">Connect wallet to see your submissions</div>
    </WindowCard>
  )

  const merged = new Map<string, bigint>()
  for (const id of [...(ids ?? []), ...(remoteIds ?? [])]) merged.set(id.toString(), id)
  const list = [...merged.values()].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))

  const unlock = remoteIds === null && (
    <div className="flex flex-col gap-2 items-start border-[3px] border-[#111] rounded-lg p-3 bg-[#7FF3F0]/30">
      <div className="font-body text-[13px] text-[#111]/80">Your free submissions are private. Sign a free message to load them.</div>
      {error && <div className="font-mono-bold text-[12px] text-[#FF3E9A]">{error}</div>}
      <PillButton size="sm" variant="cyan" onClick={loadRemote} loading={loading}>Load my submissions </PillButton>
    </div>
  )

  if (list.length === 0) return (
    <div className="flex flex-col gap-4">
      {unlock}
      <WindowCard title="MY_SUBMISSIONS.EXE" titleBarColor="#A78BFA">
        <div className="checkerboard rounded-lg py-12 flex flex-col items-center gap-4">
          <FolderIcon size={40} />
          <div className="font-mono-bold text-[12px] uppercase tracking-widest text-[#111]/60">No submissions yet</div>
        </div>
      </WindowCard>
    </div>
  )

  return (
    <div className="flex flex-col gap-4">
      {unlock}
      <h2 className="font-heading text-[18px] font-bold text-[#111]">My Submissions ({list.length})</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {[...list].reverse().map(id => <BountyItem key={id.toString()} id={id} onSelect={onSelectBounty} />)}
      </div>
    </div>
  )
}
