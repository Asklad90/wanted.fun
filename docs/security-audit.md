# Want.fun — Pre-Mainnet Security Audit
**Date:** 2026-10-14  
**Branch:** `security/pre-mainnet-hardening`  
**Scope:** Frontend, API routes (`/api/`), contract usage, git hygiene, infra config

---

## Summary

| Severity | Found | Fixed in this branch |
|----------|-------|----------------------|
| Critical | 1     | 1 |
| High     | 5     | 5 |
| Medium   | 6     | 6 |
| Low      | 4     | 4 |
| Info     | 3     | 3 |

---

## Critical

### C1 — API trusted wallet address from request body (no auth)
**Files:** all `/api/bounties/[id]/*.ts`  
**Detail:** Any caller could pass any `submitter` or `address` in the POST body and the server accepted it verbatim. A malicious actor could submit on behalf of any wallet, toggle any bounty's visibility, or overwrite any bounty's examples — without owning the wallet.  
**Fix:** All mutating endpoints (`POST /submissions`, `PATCH /visibility`, `POST /examples`) now require a wallet-signed EIP-191 message (`want.fun:{action}:{bountyId}:{timestamp}`). The server uses viem's `verifyMessage` to recover the signer and rejects requests where the recovered address doesn't match. Messages expire after 5 minutes (replay protection via timestamp). Frontend `submissions-api.ts` now calls `walletClient.signMessage` before every mutating request.

---

## High

### H1 — File uploads accepted by MIME declared in prefix only
**Files:** `api/bounties/[id]/submissions.ts`, `api/bounties/[id]/examples.ts`  
**Detail:** Data URLs were validated by the `data:image/jpeg;base64,` prefix alone. An attacker could set `data:image/jpeg;base64,<actual HTML/script>` and the server would store it, then the browser would render it as an image tag with a JS payload.  
**Fix:** Both handlers now inspect the actual magic bytes (first 12 bytes decoded from base64) and verify they match the declared MIME. Any mismatch is rejected with a 400.

### H2 — `detail: String(e)` leaked internal error info to clients
**Files:** all `/api/bounties/[id]/*.ts`  
**Detail:** Every `catch` block returned `{ error: 'Server error', detail: String(e) }`. This exposes stack traces, Postgres error messages (which can include table names, query structure, and connection metadata), and any secret that ends up in an error message.  
**Fix:** All `catch` blocks now return only `{ error: 'Server error' }`. Error detail is still logged server-side via `console.error`.

### H3 — No auth on visibility and examples routes
**Files:** `api/bounties/[id]/visibility.ts`, `api/bounties/[id]/examples.ts`  
**Detail:** Anyone knowing a bounty ID could flip it public/private or overwrite its examples.  
**Fix:** Both routes now require wallet signature auth (see C1). The visibility and examples handlers additionally cross-check the authenticated address against the `poster` column in the `bounties` table. If a poster is recorded, only that address can change the record.

### H4 — CORS wildcard `*` on local dev server
**File:** `server/index.ts`  
**Detail:** The local Bun server set `Access-Control-Allow-Origin: *`, allowing any origin to call it. In a dev context this is low-risk, but it establishes a bad default that could be copy-pasted to production.  
**Fix:** Server now allows only `localhost:5173`, `localhost:3000`, `127.0.0.1:5173`.

### H5 — `console.jsonl`, `traces.jsonl`, `data/submissions.db` tracked in git
**Detail:** These files were committed in the git history. `console.jsonl` can contain wallet addresses, RPC responses, and error messages. `submissions.db` contains full submission content and wallet addresses. `traces.jsonl` contains RPC trace data.  
**Fix:** All three removed from the git index with `git rm --cached`. `.gitignore` updated to permanently exclude them. The history cannot be rewritten without a force-push — you should run `git filter-repo` or BFG to purge them from the full history before the repo is made public (see item 6 in action plan below).

---

## Medium

### M1 — No rate limiting on GET /submissions, PATCH /visibility, GET/POST /examples, POST /register
**Fix:** Every route now has a dedicated `createRateLimiter` instance. GET routes: 60/min per IP. POST/PATCH routes: 5–20 per 10-minute window per IP. Submissions additionally rate-limited per wallet address (3 per 10 min).

### M2 — Preview Vercel deployments share production database
**File:** `api/_db.ts`  
**Detail:** Every Vercel preview deployment (pull-request previews) used the same `POSTGRES_URL` as production, meaning test data could contaminate production tables.  
**Fix:** `_db.ts` now prefers `PREVIEW_POSTGRES_URL` when set. Create a separate Neon branch and set `PREVIEW_POSTGRES_URL` in Vercel's "Preview" environment to isolate test data.

### M3 — No security headers in Vercel deployment
**File:** `vercel.json`  
**Fix:** Added `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `X-XSS-Protection: 1; mode=block`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy`, `Strict-Transport-Security` (HSTS, 2-year max-age), and a `Content-Security-Policy`. The CSP allows `'unsafe-inline'` and `'unsafe-eval'` for `script-src` because wagmi/viem inject inline scripts — tightening this further requires auditing all third-party wallet adapters.

### M4 — `javascript:` and `data:text/html` links not blocked in text submissions
**Files:** `api/bounties/[id]/submissions.ts`, `server/index.ts`  
**Fix:** Text content is now checked with `/javascript\s*:/i` and `/data\s*:\s*text\/html/i` and rejected with a 400 before storage.

### M5 — Bounty ID not validated for length or injection
**Files:** all API handlers  
**Detail:** Bounty IDs come from the URL path. No length check meant a very long ID could be passed to parameterized queries (they handle injection, but long strings waste DB space).  
**Fix:** All handlers now validate `bountyId.length <= 200` and `typeof bountyId === 'string'`.

### M6 — `viewer` and `poster` query params not validated as addresses
**File:** `api/bounties/[id]/submissions.ts` (GET)  
**Fix:** Handler now validates both against `/^0x[0-9a-f]{40}$/` before using them.

---

## Low

### L1 — `VITE_` prefix used correctly — no secrets in browser bundle
All `VITE_*` env vars are contract addresses and chain IDs — all public onchain values. No API keys, DB credentials, or secrets use the `VITE_` prefix. No hardcoded secrets found in any source file.

### L2 — `contracts/out/` (compiled artifacts) tracked in git
Compiled artifacts are large (>1 MB), deterministically reproducible with `forge build`, and should not be versioned.  
**Fix:** Added to `.gitignore`. Removed from git index with `git rm --cached -r contracts/out/`. Run `forge build` locally after a fresh clone.

### L3 — Dependency vulnerabilities (transitive)
35 vulnerabilities found in transitive deps (`@circle-fin/*`, `wagmi`, `@vercel/node`, `tailwindcss`). All are in build-time or server-side transitive deps; none are directly exploitable via this app's attack surface. Ran `bun update` to pull latest compatible versions. Remaining vulnerabilities require upstream fixes.

### L4 — No explicit method guard on some routes (missing 405 fallback)
**Fix:** All route branches in `server/index.ts` now have an explicit `if (match) return err('Method not allowed', 405)` guard after the allowed-method branches.

---

## Info

### I1 — `bun:sqlite` WAL files in git  
`data/submissions.db-shm` and `-wal` files were tracked. Fixed with `.gitignore` update.

### I2 — `AGENTS.md` contains deployed contract address  
This is intentional (public onchain address). No secrets in that file.

### I3 — Server logs error detail server-side  
`console.error('handler error:', e)` in every catch block is correct — logs to Vercel's function log (not visible to clients). Kept as-is.

---

## Action Items for You (Cannot be done by Arc Studio)

1. **Purge git history** of `console.jsonl`, `traces.jsonl`, `data/submissions.db*`. Use `git filter-repo` or BFG Repo Cleaner before making the repo public:
   ```
   bun add -D git-filter-repo   # or install globally
   git filter-repo --invert-paths --path console.jsonl --path traces.jsonl \
     --path data/submissions.db --path data/submissions.db-shm --path data/submissions.db-wal
   ```
   Then force-push: `git push --force-with-lease origin security/pre-mainnet-hardening`

2. **Set `PREVIEW_POSTGRES_URL`** in Vercel → Project Settings → Environment Variables, scoped to "Preview" environments. Create a separate Neon branch for this.

3. **Rotate your Neon/Postgres password** since the connection string was in commits (even if only in env vars on Vercel, double-check that `DATABASE_URL` never appeared in any commit message or `.env` file that got committed).

4. **Update the CORS origin** in `vercel.json` from `https://want.fun` to your actual Vercel domain (or keep it as `https://want.fun` once your custom domain is confirmed).

5. **Pre-mainnet independent audit** — the contract's core logic (escrow, winner approval, refund) is straightforward and well-tested, but a 30–60 min review from an external auditor before locking real funds is still recommended.
