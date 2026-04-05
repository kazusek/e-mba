# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

```bash
npm run dev          # dev server on localhost:3000
npm run build        # production build (run this to catch type errors)
npm run lint         # ESLint

npm run db:push      # push schema changes to Neon (reads .env.local)
npm run db:studio    # Drizzle Studio GUI
npm run db:generate  # generate migration SQL files
npm run db:migrate   # apply generated migrations
```

## Architecture

This is a Next.js 16 App Router application. The primary working directory is `emba-app/` — the parent `E-mba/` directory contains reference files and project docs.

### Data flow

Instabook (no API) → CSV export → `/import` page → `POST /api/import` → papaparse → upsert into Neon via Drizzle → audience rules evaluate contacts → emails sent via Resend.

### Key directories

- `src/lib/db/` — Drizzle ORM setup. `index.ts` exports `db` (neon-http driver). `schema/` has four files: `contacts.ts` (csvImports + contacts tables), `audiences.ts`, `emails.ts` (emailTemplates, emailAutomations, emailCampaigns, emailSendLogs), `index.ts` (barrel).
- `src/lib/csv/parsers.ts` — Column mappings for each Instabook report type. Each parser only sets fields present in that report so re-imports don't overwrite data with nulls. `SUPPORTED_IMPORT_TYPES` drives the dropdown on the import page.
- `src/lib/audiences/evaluate.ts` — The audience rule engine. `AUDIENCE_FIELDS` defines the 6 segmentable fields (optIn, totalVisits, daysSinceLastVisit, membershipName, membershipExpiresDays, joinedDaysAgo). `evaluateAudience(rules)` translates the jsonb rules into a Drizzle WHERE clause and returns matching contacts. Computed fields (daysSinceLastVisit, etc.) use `sql\`date_part(...)\`` since they're derived from stored timestamps, not stored directly.
- `src/app/(admin)/` — All admin pages share the sidebar layout in `(admin)/layout.tsx`. Nav active state is in `src/components/admin-nav.tsx` (client component). Current pages: `import/`, `audiences/`, `audiences/new/`, `audiences/[id]/edit/`.
- `src/app/api/` — Route handlers. `/api/import` accepts multipart form data. `/api/audiences` (list + create), `/api/audiences/[id]` (get + update + delete), `/api/audiences/preview` (evaluate rules without saving, returns count + 5 sample contacts).
- `src/components/` — Shared client components. `audience-builder-form.tsx` is the full audience builder (AND/OR toggle, condition rows, live preview). `delete-audience-button.tsx` handles the confirm → delete → `router.refresh()` pattern.

### Audience rule shape

Rules are stored as jsonb in `audiences.rules`:

```json
{
  "operator": "AND",
  "conditions": [
    { "field": "daysSinceLastVisit", "op": "gte", "value": 30 },
    { "field": "membershipName", "op": "is_not_empty", "value": null }
  ]
}
```

Valid ops per field type: booleans → `eq / is_empty / is_not_empty`; numbers → `gte / lte / eq / is_not_empty`; strings → `eq / not_eq / is_empty / is_not_empty`. The `OP_LABELS` and `AUDIENCE_FIELDS` constants in `evaluate.ts` are the single source of truth for what's valid — the builder UI reads from them directly.

### Critical constraints

- **`db.transaction()` is NOT supported** by the neon-http driver — use individual `db.*` calls.
- **Neon connection string** must not include `&channel_binding=require` — strip it from any string copied from the Neon console.
- **`db:push` reads `.env.local`** via `dotenv` in `drizzle.config.ts`. The DATABASE_URL must be set there before running any db commands.
- Any page using `useSearchParams()` must export `export const dynamic = 'force-dynamic'`.
- Route handler params are a Promise: `{ params }: { params: Promise<{ id: string }> }` → `const { id } = await params`.

### Database schema decisions

- `contacts` is upserted by `email` (unique index). Fields are nullable — different Instabook reports populate different columns, so a contact built from multiple imports accumulates data without overwriting previous values with nulls.
- `emailTemplates` uses a free-text `name` (no type enum) — templates are reusable across campaigns and automations.
- `emailCampaigns.audienceId` references `audiences` — replaces the hardcoded `segmentType` enum from the booking system reference code.
- Count in `audiences.contactCount` is recalculated on every save (POST/PUT). It reflects the count at save time, not real-time.

### UI conventions

- UI primitives: `@base-ui/react` (not Radix UI)
- Toast notifications: `sonner` — `toast.success()` / `toast.error()`
- Page heading: `text-2xl font-bold tracking-tight sm:text-3xl`
- Container padding: `px-4 py-6 lg:px-8 lg:py-8`
- The `Toaster` is mounted in `src/app/layout.tsx` at `position="bottom-right"`
- Server component list pages pair with client `*Button` components that call the API and trigger `router.refresh()` to re-render the server component tree.

### Reference code

`E-mba/reference/` contains working, production-tested code from a related booking system. When porting from reference files: remove all `studioId` columns/scoping, replace `requireAdminApi()` auth with the simpler `ADMIN_SECRET` env var check, and replace `users`/`studioUsers` references with `contacts`.
