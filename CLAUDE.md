# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
pnpm dev        # Start dev server (Webpack, not Turbopack — intentional)
pnpm build      # Production build
pnpm lint       # ESLint via next lint
```

No test suite is configured. There is no `test` script.

## Required Environment Variables

Copy from `.env.local`:

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Supabase PostgreSQL connection string (pooler port 6543) |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon/public key |
| `BLOCKCHAIN_RPC_URL` | Local QBFT node RPC (default: `http://127.0.0.1:8545`) |
| `BLOCKCHAIN_CHAIN_ID` | Chain ID (default: `1337`) |
| `BACKEND_PRIVATE_KEY` | Backend signer wallet private key |
| `TRADE_REGISTRY_ADDRESS` | Deployed `TradeRegistry` contract address |
| `JWT_SECRET` | JWT signing secret |

## Architecture

### Role-Based System

Five user roles each with their own dashboard: `admin`, `broker`, `investor`, `issuer`, `regulator`. Route: `/dashboards` — the page at `app/dashboards/page.jsx` reads the session user's role and redirects to the appropriate sub-dashboard. Each role-specific component lives in `components/dashboards/`.

### Authentication — Two Parallel Systems

There are **two auth flows** that coexist:

1. **JWT + Bearer token** (`lib/auth.js`): Used by API routes. Login returns a JWT; API handlers call `requireAuth(request)` or `requireRole(request, roles)` which validates the `Authorization: Bearer <token>` header against the database.

2. **Cookie session** (`lib/session.js` + `middleleware.js`): A `user_session` cookie (JSON, httpOnly) is set server-side. The middleware reads this cookie to protect `/kyc` and `/dashboards` routes and enforces KYC status before allowing dashboard access.

3. **Client-side localStorage** (`lib/auth-context.js`): `AuthProvider` persists session state to `localStorage` under `mdsm_session` and exposes `useAuth()` hook to components. This is a legacy/demo pattern — newer API-integrated components should use the JWT flow.

### Database (`lib/db.js`)

Single `pg.Pool` exported from `lib/db.js`. Use these helpers — do not create new Pool instances in API routes:

- `query(sql, params)` — raw query, returns pg result
- `getRows(sql, params)` — returns `result.rows`
- `getRow(sql, params)` — returns `result.rows[0] ?? null`
- `withTransaction(callback)` — wraps in BEGIN/COMMIT/ROLLBACK, passes `client` to callback

`lib/db.js` also contains `register()` — a second registration function that handles the `issuers` table. `lib/auth.js` has its own `register()` for the `full_name`/`first_name`/`last_name` schema. These overlap; the API route at `app/api/auth/register/` determines which one is actually called.

### API Routes (`app/api/`)

All route handlers follow this pattern:
- Validate request body with Zod via `validateRequest(request, schema)` from `lib/validate.js`
- Authenticate with `requireAuth(request)` or `requireRole(request, roles)` from `lib/auth.js`
- Return via `corsResponse(data)` or `corsError(message, status)` from `lib/cors.js`
- Sensitive actions are logged via `logAudit(...)` from `lib/audit.js`

Every route that accepts requests from the browser must export `OPTIONS` returning `handleOptions()` for CORS preflight.

### Blockchain Integration

The blockchain layer records trades on a local QBFT (Quorum IBFT) network:

- `blockchain/config/index.js` — network config (RPC URL, chain ID, contract addresses)
- `blockchain/contracts/TradeRegistry.js` — ethers.js interface to the deployed `TradeRegistry` smart contract
- `blockchain/utils/clients.js` — provider/signer setup

**Trade recording flow** (in `lib/services/orderService.js`):
1. DB transaction: fetch order, insert `trades` row as `pending`, update order to `processing`
2. Commit DB transaction
3. Call `recordTradeOnChain(...)` — sends tx to the QBFT node
4. Update `trades.status = 'filled'` and set `onchain_tx_hash` on both `trades` and `orders`

If the blockchain call fails after the DB commit, the trade stays `pending` on-chain while the DB shows `processing`. Handle this via manual reconciliation or a retry job.

### Path Aliases

`@/` maps to the project root (configured in `jsconfig.json`). Use `@/lib/...`, `@/components/...`, etc.

### UI Components

`components/ui/` contains Shadcn/ui components (Radix UI primitives + Tailwind). Do not modify these directly — regenerate with `shadcn` CLI if updates are needed. Feature components are in `components/dashboards/`, `components/investor/`, and `components/auth/`.
