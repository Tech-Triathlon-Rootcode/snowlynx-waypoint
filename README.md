# SnowlynX Waypoint

Waypoint connects order placement, assisted dispatch planning, versioned loading, offline delivery evidence, and independent store receipt across four roles. This repository implements the SnowlynX Designathon direction for the Tech-Triathlon 2026 Hackathon.

## Quick start with Docker

Requirements: Docker Desktop with Docker Compose.

```bash
docker compose up --build
```

Open `http://localhost:3000`. The setup service applies migrations and resets the repeatable demonstration seed before the web service starts. PostgreSQL data persists in the `waypoint_postgres` volume.

## Local development

Requirements: Node.js 22+, pnpm 11+, and PostgreSQL.

```bash
cp .env.example .env
pnpm install
pnpm db:migrate
pnpm db:seed
pnpm dev
```

PowerShell equivalent:

```powershell
Copy-Item .env.example .env
pnpm install
pnpm db:migrate
pnpm db:seed
pnpm dev
```

## Seeded accounts

All accounts use password `SnowlynX2026!` in the demonstration environment.

| Role | Email | Scope |
| --- | --- | --- |
| Dispatcher | `dispatcher@waypoint.demo` | Peliyagoda depot |
| Loader | `loader@waypoint.demo` | Peliyagoda depot |
| Driver | `driver@waypoint.demo` | VEH035 |
| Store manager | `manager@waypoint.demo` | OUT001 |

Replace `DEMO_PASSWORD` and `SESSION_SECRET` outside the competition demonstration.

## Numbered judge walkthrough

1. Sign in as Dispatcher and open **Plan & allocate**. `ORD-2701` is selected.
2. Leave `VEH035`, trip 1, arrival `05:20`, and distance `42 km`. Review the ten explicit checks and allocate the order.
3. Publish the VEH035 trip. The manifest becomes version 1 and its orders move to Loading.
4. Sign out and sign in as Loader. Open **Issues & handoff**.
5. Report `18` of `20` units for `ORD-2701` with reason “Two units damaged during staging.” Departure remains blocked.
6. Sign in as Dispatcher, open **Delivery progress**, and approve the shortfall. The manifest becomes version 2 and `ORD-2701` must be checked again.
7. Return as Loader. Open **Loading checklist** and check every manifest item at version 2.
8. Open **Issues & handoff** and confirm loading complete.
9. Sign in as Driver. Open **My route**, then download and start the approved route.
10. Select `ORD-2701`, choose **Demonstrate offline**, record `18` units with a receiver name and acknowledgement, and save it on the device.
11. Observe that the route continues while the record is labeled device-only. Reloading retains the IndexedDB record.
12. Reconnect and choose **Sync saved records**. Retrying uses the same idempotency key and cannot duplicate delivery evidence.
13. Sign in as Store manager. **My orders** now shows the synchronized driver status and loading shortfall.
14. Open **Confirm receipt**, confirm the actual quantity, and optionally record an issue. The store receipt remains separate from driver proof.
15. Return as Dispatcher to review the final delivery state and any receipt or synchronization exception.

## Verification

```bash
pnpm typecheck
pnpm test
pnpm build
```

The application seed imports all 120 supplied outlets, 60 supplied vehicles, the calendar, district travel, and service allowances. Traffic-speed and road-condition files remain bundled as protected server-side source assets for later planning extensions. No bulk-download route exposes the competition data.

## Vercel deployment

1. Create a managed PostgreSQL database, preferably close to the Vercel function region.
2. Configure `DATABASE_URL`, `SESSION_SECRET`, `APP_URL`, and `DEMO_PASSWORD` in Vercel.
3. Run `pnpm db:migrate` and `pnpm db:seed` against the deployment database from a controlled environment.
4. Import the repository into Vercel with `apps/web` as the application root, or keep the repository root and use the root `pnpm build` command.
5. Verify all four accounts and the complete walkthrough on the production URL.

Do not expose a database URL, session secret, service credential, or raw competition dataset through a `NEXT_PUBLIC_` variable.

## Documentation

- [Architecture](docs/architecture.md)
- [Data model](docs/data-model.md)
- [AI disclosure](docs/ai-disclosure.md)
- [Design departures](docs/design-departures.md)
