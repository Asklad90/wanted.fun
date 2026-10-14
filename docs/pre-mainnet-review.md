# Want.fun — Pre-Mainnet Review
**Date:** 2026-10-14  
**Contract:** `WantedEscrow.sol`  
**Target chain:** Arc Mainnet (chain ID 5042)  
**USDC:** `0x3600000000000000000000000000000000000000`

---

## Automated Checks

| Check | Result |
|---|---|
| Foundry unit + fuzz + invariant tests | **57/57 PASS** |
| Lint (oxlint) | **0 errors, 0 warnings** |
| TypeScript typecheck | **0 errors** |
| Forge build | **Clean** (warnings: `block.timestamp` lint — expected for a time-based contract) |
| Vite production build | **Clean** |

---

## Contract Findings

### [Medium] Permanent USDC lock when `claim()` keeps reverting
**Location:** `approveWinner` / `claim` / `reclaimUnused`  
**Detail:** If `approveWinner` direct transfer fails (e.g. blocklisted recipient on USDC), the winner is marked `Pending` and that slot stays in `escrowRemaining`. `reclaimUnused` correctly excludes pending value — so funds are neither claimable by the winner (USDC keeps rejecting) nor reclaimable by the poster. On standard USDC (Circle-issued), blocklisting is rare and reserved for OFAC/sanctions enforcement. For a hackathon bounty board this is an accepted edge-case risk.  
**Verdict for mainnet launch:** Acceptable. Affects only blocklisted addresses. Real-world probability near zero.

### [Medium] Poster inaction grief — poster can take submissions and approve nobody
**Location:** `approveWinner`, overall lifecycle  
**Detail:** No on-chain mechanism forces winner selection. A dishonest poster can collect submissions, let the review window expire, and reclaim all unused escrow. Workers lose time but no funds — USDC was never theirs to begin with.  
**Verdict for mainnet launch:** Accepted by design — this is a trust-based bounty board, not a trustless escrow. The off-chain reputation layer (public submissions, wallet address visibility) is the deterrent. Document this clearly in the UI.

### [Low] Single spam submission disables poster's `cancel()`
**Location:** `cancel()` — requires `_submissionCountByBounty == 0`  
**Detail:** One submission (even spam) permanently removes the cancel option. Poster is stuck with an open bounty they can't close until the review window expires, then can reclaim escrow via `reclaimUnused`.  
**Verdict for mainnet launch:** Acceptable. Funds are never lost — poster can always reclaim after the review window. Worst case is waiting 7 days.

### [Info] `block.timestamp` manipulation
**Location:** All deadline comparisons  
**Detail:** Forge lint flags `block.timestamp` usage. On Arc (sub-second finality, sequencer-based), timestamp manipulation is not a practical attack vector. All 12 `block.timestamp` usages are appropriate for time-gating.  
**Verdict for mainnet launch:** Not a concern on Arc.

### [Info] `BountyBoard.sol` is unused
The legacy `BountyBoard.sol` contract is in the repo but not deployed or used. It has two findings (reclaimable escrow asymmetry, missing deadline check on submissions). These do not affect `WantedEscrow.sol`.

---

## Configuration Review

| Item | Value | Status |
|---|---|---|
| `VITE_CHAIN_ID` | Set to `5042` in Vercel Production | Must set before deploy |
| `VITE_CONTRACT_ADDRESS` | Must be set to Arc Mainnet deploy address | Must set after deploy |
| USDC address (constructor arg) | `0x3600000000000000000000000000000000000000` | Correct for Arc Mainnet |
| `reviewWindow` (constructor arg) | `604800` (7 days) | Correct |
| `DATABASE_URL` | Neon Postgres — set in Vercel | Done |
| `VITE_WALLETCONNECT_PROJECT_ID` | Set in Vercel | Done |
| Rate limiting | In-memory (soft limit only on Vercel) | Accepted for hackathon |
| `.npmrc` `legacy-peer-deps=true` | Present | Done |
| `bun install` + `bun run build` in `vercel.json` | Present | Done |

---

## Frontend / Backend Review

| Area | Status |
|---|---|
| Chain-switch prompt on wrong network | Present in `CreateBountyForm`, `BountyPage`, `SingleOffchainSubmission` |
| Wallet signature auth on all mutating API calls | Present (`_auth.ts` + `signAuth` in client) |
| MIME magic-byte validation on file uploads | Present in `submissions.ts` + `examples.ts` |
| Input length validation | Present on all API routes |
| CORS locked to `https://want.fun` on `/api/*` | Present in `vercel.json` |
| CSP: `unsafe-eval` removed | Done |
| CSP: `connect-src` narrowed | Done (WalletConnect + Arc RPC domains) |
| Rate limiting (IP + per-wallet) | Present — soft limit caveat noted |
| `.gitignore` covers `.env`, `*.db`, `contracts/out/` | Yes |
| No secrets committed | Verified |
| Vercel build: bun + lockfile pinned | Done |

---

## Mainnet Deploy Checklist

Before pushing the contract:
- [ ] Run `forge test` one final time from your machine — confirm 57/57 pass
- [ ] Deploy `WantedEscrow` to Arc Mainnet with args: `usdc=0x3600000000000000000000000000000000000000`, `reviewWindow=604800`
- [ ] Copy deployed address

In Vercel (Production env vars only):
- [ ] Set `VITE_CONTRACT_ADDRESS=<mainnet address>`
- [ ] Set `VITE_CHAIN_ID=5042`
- [ ] Redeploy (or push a commit to trigger it)

Post-deploy:
- [ ] Test `createBounty` with a small amount on mainnet
- [ ] Verify `CONNECT WALLET` modal loads wallet icons correctly
- [ ] Verify `Built on Arc` badge displays
- [ ] Confirm submissions API works (POST /api/bounties/:id/submissions returns 201)

---

## Summary

The contract is **ready for mainnet deployment**. All 57 tests pass, no critical findings, no high-severity findings. The three findings above are all accepted-by-design for a hackathon launch. The only blockers are the two Vercel env vars (`VITE_CONTRACT_ADDRESS` and `VITE_CHAIN_ID=5042`) which must be set after the mainnet contract deploy.

The frontend and backend are secure for a launch-scale deployment. Rate limiting is soft (in-memory) — harden with Vercel KV before scaling to high traffic.
