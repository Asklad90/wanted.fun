# Wanted.fun

A USDC bounty wall on [Arc](https://www.arc.io). Post a bounty, lock the prize in escrow, let people submit work for free, and pay the winners you pick.

**The rule that makes it trustworthy:** a bounty can only exist if its full prize is already locked in the escrow contract. Workers never do work for an unfunded bounty.

## How it works

1. **Post:** the poster approves USDC and calls `createBounty`. The contract pulls `reward x winners` USDC in the same transaction and checks it received the exact amount. If the deposit fails, no bounty is created.
2. **Submit (free):** workers add a note, links, images or video and sign a message with their wallet. No gas, no USDC needed. Submissions are stored off-chain and are visible only to the poster and the submitter.
3. **Review:** the poster opens every submission (links, images, video) and approves winners.
4. **Pay:** `approveWinner` pays the winner from escrow in the same transaction. If a transfer fails (for example a blocklisted address) the payout becomes pending and that winner can `claim` it, so other winners are never blocked.
5. **Unused prize:** slots nobody won can only be reclaimed by the poster after `deadline + reviewWindow`.

## What it uses Arc for

- USDC escrow and payouts on Arc, using the native USDC ERC-20 interface.
- USDC is also Arc's gas token, so posters and winners only ever hold one asset.
- Gasless submission for workers: they only sign a message; the poster pays gas when approving.

## Trust model (honest limits)

- Prizes are locked on-chain and the contract has no owner, admin, upgrade or pause.
- The poster decides who wins. A poster can choose not to approve anyone and reclaim the unused prize after the review window. There is no dispute system.
- Posters can only cancel in the first 10 minutes after posting, before any winner, so they cannot pull the prize once workers have started.
- Submissions (the work itself) live in a backend (Supabase), not on-chain. Submissions are signed by the worker's wallet, so a poster cannot forge them. If the backend is down, submissions cannot be viewed. Escrow and payouts do not depend on it.

## Architecture

| Part | Where |
|---|---|
| Escrow contract (Solidity, OpenZeppelin, Foundry tests) | `contracts/WantedEscrow.sol`, `contracts/test/` |
| Frontend (React, Vite, wagmi, viem) | `src/` |
| Submissions backend (Supabase Edge Function + private storage) | `supabase/` |

Wallet signatures (`personal_sign`) authenticate everyone. The backend reads the poster address from the contract on-chain, so only the real poster can open all submissions, and workers only ever see their own.

## Run it

```bash
npm install
npm run dev
```

Environment variables (all optional except the contract address):

| Name | Purpose |
|---|---|
| `VITE_CHAIN_ID` | `5042` for Arc Mainnet, `5042002` for Arc Testnet (default) |
| `VITE_CONTRACT_ADDRESS` | deployed `WantedEscrow` address |
| `VITE_WALLETCONNECT_PROJECT_ID` | enables WalletConnect (browser wallets work without it) |
| `VITE_SUBMISSIONS_API_URL` | override the submissions backend URL |

## Contracts

```bash
forge test
```

Constructor arguments: the USDC address and the review window in seconds (use `604800` for 7 days on mainnet; it is immutable).

## Deploying the backend

Apply `supabase/migrations/*.sql`, deploy `supabase/functions/wanted-api`, and add the deployed escrow address to the `chains.contracts` allowlist.
