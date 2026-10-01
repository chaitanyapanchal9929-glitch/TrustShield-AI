# TrustShield AI

TrustShield helps people review suspicious digital messages, understand text-based risk signals, and redact sensitive details before sharing.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the Express API service at `/api`
- `pnpm --filter @workspace/trustshield-ai run dev` — run the React/Vite app
- `pnpm run typecheck` — typecheck all workspace packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI
- `pnpm --filter @workspace/db run push` — apply development schema changes
- Runtime secrets: `SESSION_SECRET` and `GEMINI_API_KEY`
- The app uses the project PostgreSQL database. Scanned text and redacted text are never saved.

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React, Vite, Wouter, TanStack Query, Tailwind CSS
- API: Express 5
- Database: PostgreSQL + Drizzle ORM
- Validation: Zod schemas generated from `lib/api-spec/openapi.yaml`
- Password hashing: bcryptjs; authentication: signed, HttpOnly JWT cookie

## Where things live

- `artifacts/trustshield-ai/` — TrustShield web app
- `artifacts/api-server/src/routes/` — auth, scanner, history, and dashboard endpoints
- `artifacts/api-server/src/lib/scanner.ts` — transparent local text-signal and redaction rules
- `lib/api-spec/openapi.yaml` — API contract source of truth
- `lib/db/src/schema/` — account and metadata-only scan tables

## Architecture decisions

- Message analysis uses the Google Gen AI SDK with server-side `GEMINI_API_KEY`; it falls back to the local deterministic scanner when Gemini is unavailable.
- The scanner returns `analysisSource` (`gemini` or `rules`) so the UI can identify the provider used. The browser requires a visible consent checkbox before a scan can send text to Gemini.
- Submitted content is sent to Gemini for analysis when available. TrustShield does not persist submitted text, model output, or redacted text; the UI discloses provider processing and the Gemini API terms.
- Scans retain only user ID, input type, risk score/level, finding counts, and timestamp. Raw content, analysis evidence, and redacted text remain request-local.
- Authentication uses a signed HttpOnly cookie and a Replit-managed `SESSION_SECRET`; no token is stored in browser storage.
- User identity is derived from the verified cookie. Every history, dashboard, and delete query is scoped by that user ID.

## Product

- Explainable threat indicators, privacy findings, calibrated risk scores, defensive recommendations, and data redaction
- Authenticated metadata-only scan history, personal dashboard statistics, and history deletion
- URL values are treated as text; the server never fetches arbitrary URLs