# TrustShield AI

**Check before you trust. Protect before you share.**

TrustShield is a privacy-first web app for reviewing suspicious messages and protecting personal details before sharing them. The scanner uses Gemini for analysis when the API is available, with explicit local text-pattern rules as a fallback. It shows the matching evidence and explains the limits of the assessment rather than presenting a score as a security guarantee.

## Features

- Scan email, SMS, chat, website text, or other content for urgency, credential/payment requests, threatening language, link instructions, and possible impersonation indicators.
- Detect explicitly labeled names, street addresses, email addresses, phone numbers, likely payment-card numbers, account/routing details, government-ID-like patterns, and credential values.
- Redact detected values and copy the protected text.
- Create an account and review metadata-only history isolated to that account.
- See personal scan totals, high-risk counts, privacy findings, redaction activity, and a recent seven-day trend.
- Delete one scan record or all scan and redaction metadata.

## Privacy and limitations

- The app does not save original messages, extracted evidence, analysis responses, or redacted text.
- Metadata stored for history: account ID, input type, risk level and score, finding counts, and timestamp. Redaction events store only the user ID, finding count, and timestamp.
- Message text is sent from the app's API to Google's Gemini API for analysis when `GEMINI_API_KEY` is configured. The local rule-based scanner runs if Gemini is unavailable. Redaction remains local rule-based processing.
- TrustShield does not store submitted text, Gemini responses, or redacted text. Google's processing is governed by the Gemini API terms; users should avoid submitting information they are not comfortable sending to the provider.
- A low score is not proof of safety. The scanner does not verify senders, inspect attachments, or open links. Supplied URLs are treated as text.
- Rules can miss context or produce false positives; verify consequential requests through a trusted, independent channel.

## Development

The Replit project uses the shared pnpm workspace and PostgreSQL database.

```sh
pnpm install
pnpm --filter @workspace/db run push
pnpm --filter @workspace/api-spec run codegen
pnpm run typecheck
```

The configured Replit workflows run:

- API: `pnpm --filter @workspace/api-server run dev`
- Web: `pnpm --filter @workspace/trustshield-ai run dev`

The API is served under `/api` and the web app at `/`.

## Environment

Replit provides the PostgreSQL connection and `SESSION_SECRET`. Add `GEMINI_API_KEY` as a Replit Secret to enable Gemini analysis. For local development outside Replit, set `DATABASE_URL` to a PostgreSQL database, `SESSION_SECRET` to a randomly generated secret of at least 32 bytes, and `GEMINI_API_KEY` to your Google AI Studio key. Keep `.env` out of version control.

The Gemini key is used server-side only and is never returned to the browser. Each analysis response identifies whether Gemini or the local rule-based fallback supplied it.

## Deploying on Vercel

Import the repository into Vercel with the repository root as the project root. `vercel.json` builds the workspace, serves the Express API through a Vercel Function, and rewrites client-side routes to the SPA. API calls stay on the same origin.

Add these environment variables in Vercel for the environments you deploy:

- `DATABASE_URL` — a PostgreSQL database reachable by Vercel. Replit's built-in database is not automatically available to Vercel.
- `SESSION_SECRET` — a unique secret of at least 32 bytes.
- `GEMINI_API_KEY` — optional; without it, analysis uses the local rule-based scanner.

Before using the deployed app, provision the PostgreSQL schema with the existing database push command from the Development section, using the Vercel database's connection string. Vercel does not run database schema changes automatically.

## API

- `POST /api/auth/register` — create an account and start a session
- `POST /api/auth/login` — sign in
- `GET /api/auth/me` — get the current account
- `POST /api/auth/logout` — clear the session cookie
- `POST /api/scans/analyze` — analyze submitted text and persist safe metadata only
- `POST /api/scans/redact` — return redacted text and record counts only
- `GET /api/scans/history` — list the signed-in user's latest metadata
- `DELETE /api/scans/history/:id` — delete one owned record
- `DELETE /api/scans/history` — delete the user's scan and redaction metadata
- `GET /api/dashboard/stats` — return user-scoped totals and recent activity
- `GET /api/healthz` — service health

All request and response contracts are defined in `lib/api-spec/openapi.yaml`; generated hooks and validation schemas are in `lib/api-client-react` and `lib/api-zod`.

## 3–5 minute demo

1. Create a new account and open the dashboard.
2. Scan a message that asks for a password or verification code urgently.
3. Review the score, quoted signals, privacy findings, recommendations, and trust limitations.
4. Use “Protect My Data” on content containing a sample email address or phone number, then copy the redacted result.
5. Visit History to see that counts and risk metadata are saved but the message itself is not.
6. Delete the test record and show the dashboard updating.

## Security notes

- Passwords are hashed with bcryptjs (12 rounds); plaintext passwords are never stored.
- Auth uses a seven-day, signed HttpOnly, SameSite=Lax cookie. The signing key is read from `SESSION_SECRET`, never returned to the client.
- Requests have size limits and registration, sign-in, scan, and redaction routes are rate-limited.
- User-provided text is validated and rendered as text, never as HTML. Request logs omit bodies and sensitive headers.