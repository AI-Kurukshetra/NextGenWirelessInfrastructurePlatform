# Supabase Setup

1. Create Supabase project (cloud) or run local stack.
2. Apply SQL migrations in order:
   - `db/migrations/001_init.sql`
   - `db/migrations/002_security_and_audit.sql`
   - `db/migrations/003_rls_recursion_fix.sql`
   - `db/migrations/004_core_features_expansion.sql`
3. Enable Realtime on:
   - `public.performance_metrics`
   - `public.alarms`
4. Set app env values from `.env.example`.

## Local stack options

- `docker-compose.yml`: web app + minimal local postgres/studio services
- `docker-compose.supabase.yml`: extended local Supabase-style services (db/auth/rest/realtime/studio)
