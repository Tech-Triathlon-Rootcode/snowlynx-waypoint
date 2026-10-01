import "server-only";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import {
  auditEvents,
  deliveryProofs,
  getDb,
  loadingChecks,
  loadingIssues,
  orders,
  outlets,
  receipts,
  trips,
  vehicles,
} from "@snowlynx/db";

export const DEMO_DATE = "2026-06-27";

export async function listOrders() {
  return getDb()
    .select({
      id: orders.id,
      outletId: orders.outletId,
      brand: outlets.brand,
      district: outlets.district,
      depot: outlets.depot,
      dockType: outlets.dockType,
      parkingConstraint: outlets.parkingConstraint,
      windowOpen: outlets.windowOpen,
      windowClose: outlets.windowClose,
      temperature: orders.temperature,
      weightKg: orders.weightKg,
      volumeM3: orders.volumeM3,
      handlingUnits: orders.handlingUnits,
      loadedUnits: orders.loadedUnits,
      deliveredUnits: orders.deliveredUnits,
      status: orders.status,
      plannedArrival: orders.plannedArrival,
      priorDeferrals: orders.priorDeferrals,
      deferralReason: orders.deferralReason,
      nextRun: orders.nextRun,
      shortfallReason: orders.shortfallReason,
      revision: orders.revision,
      tripId: orders.tripId,
      stopSequence: orders.stopSequence,
      vehicleId: trips.vehicleId,
      tripNumber: trips.tripNumber,
      tripStatus: trips.status,
      manifestVersion: trips.manifestVersion,
    })
    .from(orders)
    .innerJoin(outlets, eq(orders.outletId, outlets.id))
    .leftJoin(trips, eq(orders.tripId, trips.id))
    .where(eq(orders.requestedDate, DEMO_DATE))
    .orderBy(asc(orders.id));
}

export async function getOrder(orderId: string) {
  const rows = await listOrders();
  return rows.find((row) => row.id === orderId) ?? null;
}

export async function listVehicles() {
  return getDb().select().from(vehicles).orderBy(asc(vehicles.id));
}

export async function getPrimaryTrip() {
  const [trip] = await getDb()
    .select({
      id: trips.id,
      vehicleId: trips.vehicleId,
      deliveryDate: trips.deliveryDate,
      tripNumber: trips.tripNumber,
      status: trips.status,
      departureTime: trips.departureTime,
      distanceKm: trips.distanceKm,
      manifestVersion: trips.manifestVersion,
      fuelReserved: trips.fuelReserved,
      publishedAt: trips.publishedAt,
      startedAt: trips.startedAt,
      vehicleType: vehicles.type,
      vehicleTemperature: vehicles.temperature,
      weightCapacityKg: vehicles.weightCapacityKg,
      volumeCapacityM3: vehicles.volumeCapacityM3,
    })
    .from(trips)
    .innerJoin(vehicles, eq(trips.vehicleId, vehicles.id))
    .where(and(eq(trips.vehicleId, "VEH035"), eq(trips.deliveryDate, DEMO_DATE), eq(trips.tripNumber, 1)))
    .limit(1);
  return trip ?? null;
}

export async function getTripOrders(tripId: string) {
  return getDb()
    .select({
      id: orders.id,
      outletId: orders.outletId,
      brand: outlets.brand,
      district: outlets.district,
      dockType: outlets.dockType,
      parkingConstraint: outlets.parkingConstraint,
      windowOpen: outlets.windowOpen,
      windowClose: outlets.windowClose,
      temperature: orders.temperature,
      weightKg: orders.weightKg,
      volumeM3: orders.volumeM3,
      handlingUnits: orders.handlingUnits,
      loadedUnits: orders.loadedUnits,
      deliveredUnits: orders.deliveredUnits,
      status: orders.status,
      plannedArrival: orders.plannedArrival,
      stopSequence: orders.stopSequence,
      revision: orders.revision,
      shortfallReason: orders.shortfallReason,
    })
    .from(orders)
    .innerJoin(outlets, eq(orders.outletId, outlets.id))
    .where(eq(orders.tripId, tripId))
    .orderBy(asc(orders.stopSequence));
}

export async function getLoadingState(tripId: string, manifestVersion: number) {
  const [checks, issues] = await Promise.all([
    getDb().select().from(loadingChecks).where(and(eq(loadingChecks.tripId, tripId), eq(loadingChecks.manifestVersion, manifestVersion))),
    getDb().select().from(loadingIssues).where(eq(loadingIssues.tripId, tripId)).orderBy(desc(loadingIssues.createdAt)),
  ]);
  return { checks, issues };
}

export async function getProof(orderId: string) {
  const [proof] = await getDb().select().from(deliveryProofs).where(eq(deliveryProofs.orderId, orderId)).orderBy(desc(deliveryProofs.createdAt)).limit(1);
  return proof ?? null;
}

export async function getReceipt(orderId: string) {
  const [receipt] = await getDb().select().from(receipts).where(eq(receipts.orderId, orderId)).limit(1);
  return receipt ?? null;
}

export async function getEvents(orderIds: string[]) {
  if (!orderIds.length) return [];
  return getDb().select().from(auditEvents).where(inArray(auditEvents.orderId, orderIds)).orderBy(desc(auditEvents.createdAt));
}

export async function getSummaryCounts() {
  const rows = await getDb()
    .select({ status: orders.status, count: sql<number>`count(*)::int` })
    .from(orders)
    .where(eq(orders.requestedDate, DEMO_DATE))
    .groupBy(orders.status);
  return Object.fromEntries(rows.map((row) => [row.status, row.count]));
}
