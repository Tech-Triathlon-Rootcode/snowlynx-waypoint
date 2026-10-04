# SnowlynX Waypoint

[![CI](https://github.com/Tech-Triathlon-Rootcode/snowlynx-waypoint/actions/workflows/ci.yml/badge.svg)](https://github.com/Tech-Triathlon-Rootcode/snowlynx-waypoint/actions/workflows/ci.yml)

SnowlynX Waypoint is a role-based delivery coordination system built for the Tech-Triathlon 2026 Hackathon. It connects store ordering, assisted dispatch planning, versioned loading, offline delivery evidence, and independent store receipt in one traceable workflow.

- **Live demo:** [snowlynx-waypoint.vercel.app](https://snowlynx-waypoint.vercel.app)
- **Repository:** [Tech-Triathlon-Rootcode/snowlynx-waypoint](https://github.com/Tech-Triathlon-Rootcode/snowlynx-waypoint)

## What the application demonstrates

- Four server-authorized roles: dispatcher, loader, driver, and store manager.
- Constraint-aware allocation covering depot, temperature, vehicle access, weight, volume, delivery window, fuel, operating day, two-trip limit, and manifest lock.
- Versioned manifests and re-checking after an approved loading shortfall.
- A driver route that can be downloaded before departure and used offline.
- IndexedDB-backed delivery evidence with visible pending state, idempotent retry, and conflict preservation.
- A store receipt that remains separate from the driver's proof of delivery.
- Repeatable data for 120 outlets, 60 vehicles, four accounts, and a complete demonstration day.

## Run with Docker (recommended for judging)

Requirements: Docker Desktop or Docker Engine with Docker Compose.

```bash
docker compose up --build
```

Open [http://localhost:3000](http://localhost:3000). No `.env` file is required for this path: Compose supplies isolated local demonstration values. The one-shot `setup` service applies migrations and restores the repeatable seed before the web service starts. PostgreSQL data persists in the `waypoint_postgres` volume.

> **Seed warning:** starting the full Compose stack runs the demonstration seed, which replaces workflow data such as orders, trips, loading records, proofs, and receipts. Do not point this setup at a database containing data you need to keep.

Stop the stack without deleting its database volume:

```bash
docker compose down
```

## Local development

Requirements: Node.js 22, Corepack, pnpm 11.19.0, and PostgreSQL 17. The quickest development setup uses the Compose PostgreSQL service and runs Next.js on the host.

```bash
corepack enable
pnpm install --frozen-lockfile
cp .env.example .env
docker compose up -d postgres
pnpm db:setup
pnpm dev
```

PowerShell equivalent:

```powershell
corepack enable
pnpm install --frozen-lockfile
Copy-Item .env.example .env
docker compose up -d postgres
pnpm db:setup
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000). If PostgreSQL is already installed locally, create the database and user represented by `DATABASE_URL` instead of starting the Compose database.

### Environment variables

| Variable | Required for | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | App, migrations, seed | Server-only PostgreSQL connection string |
| `SESSION_SECRET` | App | At least 32 random characters used to sign HTTP-only sessions |
| `DEMO_PASSWORD` | Seed only | Password assigned to the four seeded accounts |
| `APP_URL` | Deployment convention | Canonical application URL; retained for deployment configuration and future absolute links |

Generate a session secret instead of reusing the placeholder:

```bash
openssl rand -base64 48
```

```powershell
[Convert]::ToBase64String([Security.Cryptography.RandomNumberGenerator]::GetBytes(48))
```

Never commit `.env`, and never expose database credentials or session secrets through a `NEXT_PUBLIC_` variable.

## Seeded accounts

All seeded accounts use `SnowlynX2026!` unless `DEMO_PASSWORD` is changed before seeding.

| Role | Email | Operational scope |
| --- | --- | --- |
| Dispatcher | `dispatcher@waypoint.demo` | Peliyagoda depot |
| Loader | `loader@waypoint.demo` | Peliyagoda depot |
| Driver | `driver@waypoint.demo` | Vehicle `VEH035` |
| Store manager | `manager@waypoint.demo` | Outlet `OUT001` |

These credentials are intentionally public for the competition demonstration and must not be reused for a real deployment.

## Judge walkthrough

Start from a fresh seed so the identifiers and statuses below are deterministic.

1. Sign in as **Dispatcher** and open **Plan & allocate**. `ORD-2701` is selected.
2. Leave `VEH035`, trip 1, arrival `05:20`, and distance `42 km`. Review the ten explicit checks and allocate the order.
3. Publish the `VEH035` trip. The manifest becomes version 1 and its orders move to Loading.
4. Sign out, sign in as **Loader**, and open **Issues & handoff**.
5. Report `18` of `20` units for `ORD-2701` with the reason “Two units damaged during staging.” Departure remains blocked.
6. Sign in as **Dispatcher**, open **Delivery progress**, and approve the shortfall. The manifest becomes version 2 and `ORD-2701` must be checked again.
7. Return as **Loader**, open **Loading checklist**, and check every manifest item at version 2.
8. Open **Issues & handoff** and confirm loading complete.
9. Sign in as **Driver**, open **My route**, then download and start the approved route.
10. Select `ORD-2701`, choose **Demonstrate offline**, record `18` units with a receiver name and acknowledgement, and save it on the device.
11. Observe that the route continues while the record is labeled device-only. Reloading retains the IndexedDB record.
12. Reconnect and choose **Sync saved records**. Retrying uses the same idempotency key and cannot duplicate delivery evidence.
13. Sign in as **Store manager**. **My orders** shows the synchronized driver status and loading shortfall.
14. Open **Confirm receipt**, confirm the actual quantity, and optionally record an issue. The store receipt remains separate from driver proof.
15. Return as **Dispatcher** to review the final delivery state and any receipt or synchronization exception.

The public deployment uses shared demo state, so another evaluator may already have advanced the workflow. Use the Docker path for a guaranteed fresh walkthrough.

## Architecture

| Layer | Implementation |
| --- | --- |
| Web application | Next.js 16 App Router, React 19, TypeScript |
| Server boundaries | Server Components, Server Actions, and one synchronization Route Handler |
| Domain rules | Framework-independent TypeScript package with Zod boundary validation |
| Persistence | PostgreSQL through Drizzle ORM and version-controlled SQL migrations |
| Hosted database | Supabase managed PostgreSQL; the application does not depend on the Supabase browser SDK |
| Authentication | Seeded accounts, bcrypt password hashes, and signed HTTP-only session cookies |
| Offline layer | Service worker, IndexedDB route snapshot, and pending proof queue |
| Delivery | Vercel for the web application; Docker Compose for reproducible local judging |

Role and operational-scope checks are enforced in server-side actions and queries. The current competition build does not use Supabase Auth, Row Level Security, Realtime, or Storage; this deliberate scope decision is documented rather than represented as implemented functionality.

### Repository layout

```text
apps/web/          Next.js routes, role shells, features, and offline UI
packages/domain/   Allocation and delivery rules plus unit tests
packages/db/       Drizzle schema, migrations, source imports, and seed
docs/              Architecture, data model, AI disclosure, and departures
```

## Verification

```bash
pnpm typecheck
pnpm test
pnpm build
docker build --target runner -t snowlynx-waypoint .
```

GitHub Actions runs the same typecheck, unit-test, Next.js build, and production-image build on every push and pull request.

## Deploy to Vercel with Supabase Postgres

1. Create a Supabase project near the Vercel function region.
2. Import this GitHub repository into Vercel and keep the **repository root** as the Root Directory. The committed `vercel.json` supplies the monorepo build settings.
3. Add `DATABASE_URL`, `SESSION_SECRET`, `DEMO_PASSWORD`, and `APP_URL` to the Vercel Production environment. Use the Supabase transaction-pooler URL for the runtime `DATABASE_URL`.
4. From a controlled local environment, temporarily use the Supabase direct or session-pooler connection for `pnpm db:migrate`.
5. Run `pnpm db:seed` once only if the target database may be reset to the demonstration state.
6. Deploy and verify all four accounts and the complete walkthrough on the production URL.

`pnpm db:seed` is intentionally repeatable and destructive to demonstration workflow data. It must not run automatically on every production deployment.

## Documentation

- [Architecture](docs/architecture.md)
- [Data model](docs/data-model.md)
- [AI disclosure](docs/ai-disclosure.md)
- [Design departures](docs/design-departures.md)
