# Telecom Network Management Platform (MVP)

Production-ready ISP network operations MVP built with Next.js + Supabase.

## Stack

- Next.js 16.1.6 (App Router)
- TypeScript + TailwindCSS
- shadcn/ui-style component primitives
- TanStack Query + Recharts
- Supabase (Auth, Postgres, Realtime, RLS)
- Docker / docker-compose

## Features

- Authentication: signup, login, logout, protected routes
- Role-based access: `admin`, `operator`, `technician`
- Dashboard with KPI widgets + realtime metric refresh
- Sites, equipment, subscribers modules
- Alerting + analytics pages
- Core telecom modules:
  - Point-to-point links, point-to-multipoint sectors/clients
  - Spectrum management
  - QoS + bandwidth throttling
  - Automated failover
  - Security suite policies
  - Coverage planning (GIS zones)
  - Config backup/restore + firmware campaigns
  - Guest networks
  - Load balancing + mesh support
  - API integrations + SNMP profiles
  - Traffic shaping
  - Mobile command control
- RLS scoped by `organization_id` and role-sensitive write policies
- API hardening: admin checks, rate limiting, audit logs
- Blueprint traceability matrix: `REQUIREMENTS_PDF_MATRIX.md`

## Project Structure

- `app/`
- `components/`
- `lib/`
- `hooks/`
- `services/`
- `types/`
- `supabase/`
- `db/`
- `scripts/`
- `tests/`

## Environment Variables

Copy `.env.example` to `.env.local` or `.env`.

```bash
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
INTERNAL_API_TOKEN=...
SEED_OWNER_EMAIL=admin@telecom-nms.local
```

## Setup

1. Install dependencies

```bash
pnpm install
```

2. Apply SQL migrations in order (Supabase SQL editor)

- `db/migrations/001_init.sql`
- `db/migrations/002_security_and_audit.sql`
- `db/migrations/003_rls_recursion_fix.sql`
- `db/migrations/004_core_features_expansion.sql`
- `db/migrations/005_depth_upgrade.sql`
- `db/migrations/006_blueprint_expansion.sql`
- `db/migrations/007_mobile_and_vendor_integration.sql`
- `db/migrations/008_gap_closure_workflows.sql`

3. Enable Realtime for tables

- `public.performance_metrics`
- `public.alarms`
- `public.failover_events`

## API Endpoint Groups

Available grouped APIs:
- `/api/auth`
- `/api/sites`
- `/api/equipment`
- `/api/subscribers`
- `/api/networks`
- `/api/monitoring`
- `/api/configuration`
- `/api/analytics`
- `/api/alerts`
- `/api/inventory`
- `/api/billing`
- `/api/coverage`
- `/api/maintenance`
- `/api/spectrum`
- `/api/reports`
- `/api/vendor/capabilities`
- `/api/vendor/provision`

## Mobile Field App

- Installable PWA entrypoint: `/mobile`
- Includes offline command queue with automatic sync when connectivity resumes.

## Vendor Provisioning

- Vendor provisioning UI: `/vendor`
- Initial adapter support:
  - `cambium` (baseline provisioning template workflow)
  - `mikrotik`
  - `generic` fallback

4. Start app

```bash
pnpm dev
```

## Seed Data

Create at least one user (signup), then run:

```bash
pnpm seed
```

Seed script is idempotent and converges toward:
- 10 sites
- 20 devices
- 100 subscribers
- 200 metrics

## Security Notes

- `/api/seed` and `/api/alerts/check` are admin-guarded.
- Internal automation can call protected APIs with:
  - Header: `x-internal-token: $INTERNAL_API_TOKEN`
  - Optional seed context: `x-org-id: <org_uuid>`
- Audit events are written to `public.audit_logs`.

## Testing

```bash
pnpm test
```

## Docker

App + minimal local stack:

```bash
docker compose up --build
```

Extended Supabase self-host style stack:

```bash
docker compose -f docker-compose.supabase.yml up -d
```

## Useful Scripts

```bash
pnpm dev
pnpm lint
pnpm build
pnpm test
pnpm seed
pnpm format
```
