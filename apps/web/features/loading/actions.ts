"use server";

import { and, count, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auditEvents, getDb, loadingChecks, loadingIssues, orders, trips, vehicles } from "@snowlynx/db";
import { requireUser } from "@/lib/auth";

function back(kind: "notice" | "error", message: string): never { redirect(`/loader/handoff?${kind}=${encodeURIComponent(message)}`); }

export async function checkLoadedOrderAction(formData: FormData) {
  const user = await requireUser("loader");
  const tripId = String(formData.get("tripId") ?? "");
  const orderId = String(formData.get("orderId") ?? "");
  const version = Number(formData.get("manifestVersion"));
  const db = getDb();
  const [trip] = await db.select().from(trips).where(eq(trips.id, tripId)).limit(1);
  if (!trip || trip.status !== "PUBLISHED" || trip.manifestVersion !== version) back("error", "Refresh the manifest before checking this item.");
  const [vehicle] = await db.select().from(vehicles).where(eq(vehicles.id, trip.vehicleId)).limit(1);
  if (!vehicle || vehicle.depot !== user.scopeId) back("error", "This manifest is outside the loader’s depot scope.");
  await db.insert(loadingChecks).values({ tripId, orderId, manifestVersion: version }).onConflictDoNothing();
  revalidatePath("/loader");
}

export async function reportLoadingIssueAction(formData: FormData) {
  const user = await requireUser("loader");
  const tripId = String(formData.get("tripId") ?? "");
  const orderId = String(formData.get("orderId") ?? "");
  const actualUnits = Number(formData.get("actualUnits"));
  const reason = String(formData.get("reason") ?? "").trim();
  const db = getDb();
  const [order] = await db.select().from(orders).where(and(eq(orders.id, orderId), eq(orders.tripId, tripId))).limit(1);
  if (!order || !Number.isInteger(actualUnits) || actualUnits < 0 || actualUnits >= order.handlingUnits || reason.length < 4) back("error", "Enter a lower whole-unit quantity and explain the shortfall.");
  const [scopedTrip] = await db.select({ depot: vehicles.depot }).from(trips).innerJoin(vehicles, eq(trips.vehicleId, vehicles.id)).where(eq(trips.id, tripId)).limit(1);
  if (!scopedTrip || scopedTrip.depot !== user.scopeId) back("error", "This manifest is outside the loader’s depot scope.");
  await db.transaction(async (tx) => {
    await tx.insert(loadingIssues).values({ tripId, orderId, actualUnits, reason });
    await tx.insert(auditEvents).values({ tripId, orderId, actorRole: user.role, eventType: "LOADING_ISSUE", summary: `${actualUnits} of ${order.handlingUnits} units available: ${reason}` });
  });
  revalidatePath("/");
  back("notice", "The issue is visible to dispatch. Departure remains blocked.");
}

export async function releaseTripAction(formData: FormData) {
  const user = await requireUser("loader");
  const tripId = String(formData.get("tripId") ?? "");
  const db = getDb();
  const [trip] = await db.select().from(trips).where(eq(trips.id, tripId)).limit(1);
  if (!trip || trip.status !== "PUBLISHED") back("error", "This manifest is not awaiting handoff.");
  const [vehicle] = await db.select().from(vehicles).where(eq(vehicles.id, trip.vehicleId)).limit(1);
  if (!vehicle || vehicle.depot !== user.scopeId) back("error", "This manifest is outside the loader’s depot scope.");
  const [[orderCount], [checkCount], [issueCount]] = await Promise.all([
    db.select({ value: count() }).from(orders).where(eq(orders.tripId, tripId)),
    db.select({ value: count() }).from(loadingChecks).where(and(eq(loadingChecks.tripId, tripId), eq(loadingChecks.manifestVersion, trip.manifestVersion))),
    db.select({ value: count() }).from(loadingIssues).where(and(eq(loadingIssues.tripId, tripId), eq(loadingIssues.resolved, false))),
  ]);
  if (issueCount.value > 0) back("error", "Dispatcher review is required for unresolved loading issues.");
  if (checkCount.value !== orderCount.value) back("error", `Check all ${orderCount.value} manifest items at version ${trip.manifestVersion}.`);
  await db.transaction(async (tx) => {
    await tx.update(trips).set({ status: "READY", updatedAt: new Date() }).where(eq(trips.id, tripId));
    await tx.update(orders).set({ status: "READY", updatedAt: new Date() }).where(eq(orders.tripId, tripId));
    await tx.insert(auditEvents).values({ tripId, actorRole: user.role, eventType: "LOADING_HANDOFF", summary: "Loading completed and the current manifest was released to the driver." });
  });
  revalidatePath("/");
  back("notice", "Handoff complete. The driver can download the route.");
}
