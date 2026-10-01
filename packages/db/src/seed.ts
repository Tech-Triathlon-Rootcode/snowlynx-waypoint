import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { config } from "dotenv";
import { parse } from "csv-parse/sync";
import { hash } from "bcryptjs";
import { sql } from "drizzle-orm";
import { getDb, getPool } from "./client";
import {
  auditEvents,
  calendarDays,
  deliveryProofs,
  districtTravel,
  loadingChecks,
  loadingIssues,
  orders,
  outlets,
  receipts,
  serviceAllowances,
  syncOperations,
  trips,
  users,
  vehicles,
} from "./schema";

const here = dirname(fileURLToPath(import.meta.url));
const seedDir = join(here, "..", "seed-data");

// Local CLI only (never bundled by Next.js): load .env via process.cwd()
// so bundlers never try to statically resolve it. Must run before getDb().
if (!process.env.DATABASE_URL) {
  config({ path: join(process.cwd(), ".env"), quiet: true });
  config({ path: join(process.cwd(), "../../.env"), quiet: true });
}
const db = getDb();

async function csv<T>(name: string): Promise<T[]> {
  const content = await readFile(join(seedDir, name), "utf8");
  return parse(content, { columns: true, skip_empty_lines: true, bom: true }) as T[];
}

type CsvOutlet = Record<string, string> & { outlet_id: string };
type CsvVehicle = Record<string, string> & { vehicle_id: string };
type CsvCalendar = Record<string, string> & { date: string };

const outletRows = await csv<CsvOutlet>("outlets.csv");
const vehicleRows = await csv<CsvVehicle>("vehicles.csv");
const calendarRows = await csv<CsvCalendar>("calendar.csv");
const travelRows = await csv<Record<string, string>>("district_travel.csv");
const allowanceRows = await csv<Record<string, string>>("service_allowance.csv");

await db.transaction(async (tx) => {
  await tx.delete(auditEvents);
  await tx.delete(syncOperations);
  await tx.delete(receipts);
  await tx.delete(deliveryProofs);
  await tx.delete(loadingChecks);
  await tx.delete(loadingIssues);
  await tx.delete(orders);
  await tx.delete(trips);
  await tx.delete(districtTravel);
  await tx.delete(serviceAllowances);

  for (const row of outletRows) {
    await tx
      .insert(outlets)
      .values({
        id: row.outlet_id,
        brand: row.brand,
        district: row.district,
        depot: row.depot,
        dockType: row.dock_type,
        parkingConstraint: row.parking_constraint,
        mallWindow: row.mall_window || null,
        windowOpen: row.window_open_time,
        windowClose: row.window_close_time,
      })
      .onConflictDoUpdate({ target: outlets.id, set: { brand: row.brand, district: row.district, depot: row.depot } });
  }

  for (const row of vehicleRows) {
    const quota = Number(row.weekly_fuel_quota_l);
    const demoRemaining = row.vehicle_id === "VEH035" ? 32 : row.vehicle_id === "VEH036" ? 2 : Math.min(quota, 60);
    await tx
      .insert(vehicles)
      .values({
        id: row.vehicle_id,
        type: row.type,
        temperature: row.temp,
        weightCapacityKg: Number(row.weight_cap_kg),
        volumeCapacityM3: Number(row.volume_cap_m3),
        fuelType: row.fuel_type,
        kmPerLitre: Number(row.km_per_l),
        weeklyFuelQuotaL: quota,
        fuelRemainingL: demoRemaining,
        depot: row.depot,
      })
      .onConflictDoUpdate({ target: vehicles.id, set: { fuelRemainingL: demoRemaining, depot: row.depot } });
  }

  for (const row of calendarRows) {
    await tx
      .insert(calendarDays)
      .values({
        day: row.date,
        dayOfWeek: Number(row.dow),
        dayName: row.dow_name,
        isoYear: Number(row.iso_year),
        isoWeek: Number(row.iso_week),
        isPayday: row.is_payday === "1",
        festival: row.festival || null,
        festivalRamp: Number(row.festival_ramp),
        isHoliday: row.is_holiday === "1",
        monsoon: row.monsoon === "1",
        isOperating: row.is_operating === "1",
      })
      .onConflictDoNothing();
  }

  await tx.insert(districtTravel).values(
    travelRows.map((row) => ({
      district: row.district,
      depot: row.depot,
      roadClass: row.road_class,
      freeFlowKmh: Number(row.free_flow_kmh),
      depotDistanceKm: Number(row.depot_to_district_km),
      depotMinutes: Number(row.depot_to_district_freeflow_min),
      interStopKm: Number(row.inter_stop_km),
      interStopMinutes: Number(row.inter_stop_freeflow_min),
    })),
  );

  await tx.insert(serviceAllowances).values(
    allowanceRows.map((row) => ({
      brand: row.brand,
      dockType: row.dock_type,
      serviceMinutes: Number(row.service_allowance_min),
    })),
  );

  const passwordHash = await hash(process.env.DEMO_PASSWORD ?? "SnowlynX2026!", 12);
  const accounts = [
    ["dispatcher@waypoint.demo", "Nadeesha Perera", "dispatcher", "Peliyagoda"],
    ["loader@waypoint.demo", "Ruwan Silva", "loader", "Peliyagoda"],
    ["driver@waypoint.demo", "Saman Jayasinghe", "driver", "VEH035"],
    ["manager@waypoint.demo", "Kavindi Fernando", "manager", "OUT001"],
  ] as const;
  for (const [email, name, role, scopeId] of accounts) {
    await tx
      .insert(users)
      .values({ email, name, role, scopeId, passwordHash })
      .onConflictDoUpdate({ target: users.email, set: { name, role, scopeId, passwordHash } });
  }

  const [trip35] = await tx
    .insert(trips)
    .values({ vehicleId: "VEH035", deliveryDate: "2026-06-27", tripNumber: 1, status: "DRAFT", departureTime: "05:00", distanceKm: 42 })
    .returning();
  const [trip13] = await tx
    .insert(trips)
    .values({ vehicleId: "VEH013", deliveryDate: "2026-06-27", tripNumber: 2, status: "DRAFT", departureTime: "09:00", distanceKm: 26 })
    .returning();

  const specs = [
    ["OUT001", "chilled", 420, 2.8, 20],
    ["OUT002", "ambient", 260, 1.6, 12],
    ["OUT003", "chilled", 180, 1.2, 8],
    ["OUT004", "ambient", 900, 4.5, 30],
    ["OUT005", "chilled", 1200, 8, 40],
    ["OUT006", "ambient", 800, 5, 28],
    ["OUT007", "chilled", 950, 6.5, 32],
    ["OUT008", "ambient", 600, 4, 22],
    ["OUT015", "ambient", 900, 32, 25],
    ["OUT016", "ambient", 700, 18, 18],
    ["OUT021", "ambient", 600, 6, 4],
    ["OUT022", "ambient", 1900, 8, 6],
  ] as const;

  for (let index = 0; index < specs.length; index += 1) {
    const [outletId, temperature, weightKg, volumeM3, handlingUnits] = specs[index];
    const id = `ORD-${2701 + index}`;
    const is35 = index === 1 || index === 2;
    const is13 = index === 9;
    const isDeferred = index === 11;
    await tx.insert(orders).values({
      id,
      outletId,
      requestedDate: "2026-06-27",
      temperature,
      weightKg,
      volumeM3,
      handlingUnits,
      loadedUnits: null,
      status: isDeferred ? "DEFERRED" : is35 || is13 ? "ALLOCATED" : "CONFIRMED",
      tripId: is35 ? trip35.id : is13 ? trip13.id : null,
      stopSequence: index === 1 ? 2 : index === 2 ? 3 : is13 ? 1 : null,
      plannedArrival: index === 1 ? "06:00" : index === 2 ? "06:35" : is13 ? "09:30" : null,
      priorDeferrals: index === 6 ? 1 : index === 11 ? 2 : 0,
      deferralReason: isDeferred ? "Weight capacity reserved for previously deferred deliveries" : null,
      nextRun: isDeferred ? "2026-06-29" : null,
    });
    await tx.insert(auditEvents).values({
      orderId: id,
      actorRole: "manager",
      eventType: "ORDER_CONFIRMED",
      summary: "Order confirmed before the 16:00 cutoff",
    });
  }

});

const counts = await db.select({ outlets: sql<number>`count(*)::int` }).from(outlets);
const vehicleCount = await db.select({ vehicles: sql<number>`count(*)::int` }).from(vehicles);
console.log(`Seeded ${counts[0].outlets} outlets, ${vehicleCount[0].vehicles} vehicles, four role accounts, and the 27 June demonstration day.`);
await getPool().end();
