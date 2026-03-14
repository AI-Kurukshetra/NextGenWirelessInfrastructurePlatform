You are a senior full-stack engineer working inside a repository.

Your task is to build a production-ready MVP for a telecom network management platform.

The platform allows ISPs to monitor wireless infrastructure, manage network devices, and manage subscribers.

You must build the system end-to-end using the stack defined below.

------------------------------------------------

STACK

Frontend
- Next.js 16.1.6 (App Router)
- TypeScript
- TailwindCSS
- shadcn/ui
- TanStack Query
- Recharts for charts

Backend
- Database + Auth | Supabase
- Supabase Realtime
- Row Level Security

Dev Tools
- pnpm
- Docker
- ESLint
- Prettier

------------------------------------------------

PROJECT STRUCTURE

Create the following structure.

app/
components/
lib/
hooks/
services/
types/
supabase/
db/
scripts/

------------------------------------------------

STEP 1 — INITIALIZE PROJECT

Create a Next.js project.

Commands:

pnpm create next-app@latest telecom-nms --typescript --tailwind --app

Install dependencies:

pnpm add @supabase/supabase-js
pnpm add @tanstack/react-query
pnpm add recharts
pnpm add lucide-react
pnpm add clsx

Install dev dependencies:

pnpm add -D prettier eslint

------------------------------------------------

STEP 2 — SETUP SUPABASE

Create supabase client in:

lib/supabase.ts

Use environment variables:

NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY

------------------------------------------------

STEP 3 — DATABASE SCHEMA

Generate SQL migrations for the following tables.

organizations
users
sites
equipment
links
subscribers
service_plans
performance_metrics
alarms

Schema example:

sites
- id uuid pk
- name text
- latitude numeric
- longitude numeric
- tower_height integer
- organization_id uuid
- created_at timestamp

equipment
- id uuid pk
- name text
- model text
- firmware_version text
- site_id uuid
- status text
- temperature numeric
- last_seen timestamp

subscribers
- id uuid pk
- name text
- email text
- service_plan_id uuid
- status text
- connection_site uuid

service_plans
- id uuid pk
- name text
- speed_limit integer
- monthly_price numeric
- bandwidth_cap integer

performance_metrics
- id uuid
- equipment_id uuid
- throughput numeric
- latency numeric
- packet_loss numeric
- signal_strength numeric
- recorded_at timestamp

alarms
- id uuid
- severity text
- message text
- equipment_id uuid
- site_id uuid
- resolved boolean

------------------------------------------------

STEP 4 — AUTHENTICATION

Implement Supabase authentication.

Features:

login
signup
logout
protected routes

Roles:

admin
operator
technician

------------------------------------------------

STEP 5 — DASHBOARD

Create dashboard page:

/dashboard

Widgets:

Network health
Active sites
Connected subscribers
Equipment status
Alert count

Charts:

Throughput
Latency
Packet loss

Use Recharts.

------------------------------------------------

STEP 6 — SITES MANAGEMENT

Create pages:

/sites
/sites/[id]

Features:

Create site
Edit site
Delete site
View site details

------------------------------------------------

STEP 7 — EQUIPMENT MANAGEMENT

Pages:

/equipment
/equipment/[id]

Features:

Add device
Edit device
Monitor health
Show firmware version

------------------------------------------------

STEP 8 — SUBSCRIBER MANAGEMENT

Pages:

/subscribers

Features:

Create subscriber
Assign service plan
View connection site
Update status

------------------------------------------------

STEP 9 — REALTIME METRICS

Use Supabase Realtime.

Stream performance_metrics.

Dashboard should update automatically.

------------------------------------------------

STEP 10 — ALERT SYSTEM

Create alarms when:

device offline
latency too high
temperature threshold exceeded

Display alerts in:

/alerts

------------------------------------------------

STEP 11 — ANALYTICS

Create page:

/analytics

Charts:

throughput trends
subscriber growth
network uptime

------------------------------------------------

STEP 12 — UI COMPONENTS

Build reusable components:

Sidebar
Topbar
MetricCard
ChartCard
Table
AlertList

------------------------------------------------

STEP 13 — SECURITY

Enable Row Level Security.

Ensure:

users only see their organization data.

------------------------------------------------

STEP 14 — SEED DATA

Create script:

scripts/seed.ts

Generate:

10 sites
20 equipment devices
100 subscribers
sample metrics

------------------------------------------------

STEP 15 — DOCKER

Create Dockerfile.

Add docker-compose with:

Next.js
Supabase local stack

------------------------------------------------

STEP 16 — README

Create README with:

setup instructions
env variables
local dev commands

Commands:

pnpm install
pnpm dev

------------------------------------------------

OUTPUT

You must:

1. Create all project files
2. Generate Supabase SQL
3. Implement UI pages
4. Implement services
5. Provide seed scripts
6. Ensure the app runs locally

Return code changes as diffs where possible.


For more details refer to cambium_networks_blueprint_20260310_213252.pdf
------------------------------------------------