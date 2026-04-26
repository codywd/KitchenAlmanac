# KitchenAlmanac Production Ops Runbook

KitchenAlmanac is a private household app on Vercel with Prisma/Postgres, custom email/password sessions, family-scoped API keys, and Vercel runtime logs. Keep production operations boring: small PRs, checked deploys, explicit secrets, and no production seed unless Chris asks for it directly.

## Required Production Environment

- `DATABASE_URL`: production Postgres connection string used by Prisma.
- `CRON_SECRET`: random secret used by Vercel Cron for `GET /api/ops/maintenance`.

## Deploy Checks

Before merging to `main`, confirm GitHub Actions are green:

- `npm ci`
- `npm test`
- `npm run lint`
- `npm run build`
- `npm audit --omit=dev --audit-level=high`
- CodeQL
- Dependency Review on pull requests

Vercel production should track `main` and keep the build command as `prisma migrate deploy && next build`.

## Rollback

Use the Vercel dashboard to redeploy the last known-good production deployment. If a database migration shipped with the failed deploy, do not manually edit production data during rollback. Add a follow-up Prisma migration that restores compatibility.

## Database Migration Policy

- Add Prisma migrations in source control.
- Use `prisma migrate deploy` in production builds.
- Keep migrations backward-compatible with the previous deployment whenever possible.
- Never run `prisma migrate reset` against production.

## Secrets And API-Key Rotation

- Rotate `CRON_SECRET` by updating the Vercel production environment variable, redeploying, and confirming `/api/ops/maintenance` accepts only the new bearer token.
- New family API keys expire by default after 90 days. Use the 30/90/180-day choices for new keys.
- Legacy API keys without expiry should be rotated and revoked after replacement.
- Raw API keys are shown once. Do not paste them into logs, issues, commits, or screenshots.

## Failed-Login Triage

Check `/ops` for recent auth failures and rate-limit lockouts. Use Vercel Runtime Logs to correlate structured `audit_event` entries by request ID. Do not reveal whether an email address exists; login failures intentionally use a generic user-facing response.

## Cron Failures

Vercel Cron calls `GET /api/ops/maintenance` daily with `Authorization: Bearer $CRON_SECRET`. If maintenance fails:

- Confirm `CRON_SECRET` exists in Vercel production.
- Open `/api/health` to confirm database reachability.
- Check Vercel Runtime Logs for `ops.maintenance` or `audit_event_write_failed`.
- Run a one-off authenticated request to `/api/ops/maintenance` only with the current secret.

## Vercel Logs

Use Vercel Runtime Logs as the source of truth for production request/action events. Logs are structured JSON and should not include passwords, raw API keys, session cookies, bearer tokens, or secret values.

## Production Seeding

Do not seed production credentials, demo data, or first-login users unless the user explicitly requests it and provides the intended values.
