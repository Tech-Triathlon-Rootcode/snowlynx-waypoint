"use server";

import { and, count, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auditEvents, deliveryProofs, getDb, loadingChecks, loadingIssues, orders, syncOperations, trips, vehicles } from "@snowlynx/db";
import { requireUser } from "@/lib/auth";
import { DEMO_DATE, getTripOrders } from "@/lib/queries";
import { assignmentSchema, deferralSchema } from "./schemas";
import { evaluateAssignment } from "./service";

function back(path: string, kind: "notice" | "error", message: string): never {
  redirect(`${path}?${kind}=${encodeURIComponent(message)}`);
}

export async function assignOrderAction(formData: FormData) {
  const user = await requireUser("dispatcher");
  const parsed = assignmentSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) back("/dispatcher/plan", "error", parsed.error.issues[0]?.message ?? "Check the assignment fields.");
  try {
    const { orderId, vehicleId, tripNumber, plannedArrival, distanceKm } = parsed.data;
    const evaluated = await evaluateAssignment(orderId, vehicleId, tripNumber, plannedArrival, distanceKm);
    if (evaluated.order.outlet.depot !== user.scopeId || evaluated.vehicle.depot !== user.scopeId) throw new Error("This dispatcher account can plan only its assigned depot.");
    if (!evaluated.result.valid) throw new Error(`${evaluated.result.checks.filter((check) => !check.passed).map((check) => check.label).join(", ")} must be resolved.`);
    const db = getDb();
    await db.transaction(async (tx) => {
      let trip = evaluated.trip;
      if (!trip) {
        [trip] = await tx.insert(trips).values({ vehicleId, deliveryDate: DEMO_DATE, tripNumber, distanceKm, departureTime: tripNumber === 1 ? "05:00" : "09:00" }).returning();
      }
      const [sequence] = await tx.select({ value: count() }).from(orders).where(eq(orders.tripId, trip.id));
      await tx.update(orders).set({ tripId: trip.id, stopSequence: sequence.value + 1, plannedArrival, status: "ALLOCATED", revision: sql`${orders.revision} + 1`, deferralReason: null, nextRun: null, updatedAt: new Date() }).where(eq(orders.id, orderId));
      await tx.update(trips).set({ distanceKm, updatedAt: new Date() }).where(eq(trips.id, trip.id));
      await tx.insert(auditEvents).values({ orderId, tripId: trip.id, actorRole: user.role, eventType: "ORDER_ALLOCATED", summary: `${orderId} allocated to ${vehicleId}, trip ${tripNumber}.` });
    });
    revalidatePath("/dispatcher");
  } catch (error) {
    back("/dispatcher/plan", "error", error instanceof Error ? error.message : "Assignment failed.");
  }
  back("/dispatcher/plan", "notice", `${parsed.data.orderId} was allocated successfully.`);
}

export async function deferOrderAction(formData: FormData) {
  const user = await requireUser("dispatcher");
  const parsed = deferralSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) back("/dispatcher/plan", "error", parsed.error.issues[0]?.message ?? "Check the deferral fields.");
  const db = getDb();
  const [order] = await db.select().from(orders).where(eq(orders.id, parsed.data.orderId)).limit(1);
  if (!order) back("/dispatcher/plan", "error", "Order was not found.");
  if (order.tripId) {
    const [trip] = await db.select().from(trips).where(eq(trips.id, order.tripId)).limit(1);
    if (trip?.status !== "DRAFT") back("/dispatcher/plan", "error", "Published manifests cannot be silently changed.");
  }
  await db.transaction(async (tx) => {
    await tx.update(orders).set({ status: "DEFERRED", tripId: null, stopSequence: null, plannedArrival: null, deferralReason: parsed.data.reason, nextRun: parsed.data.nextRun, priorDeferrals: sql`${orders.priorDeferrals} + 1`, revision: sql`${orders.revision} + 1`, updatedAt: new Date() }).where(eq(orders.id, parsed.data.orderId));
    await tx.insert(auditEvents).values({ orderId: parsed.data.orderId, actorRole: user.role, eventType: "ORDER_DEFERRED", summary: `Deferred: ${parsed.data.reason}` });
  });
  revalidatePath("/dispatcher");
  back("/dispatcher/plan", "notice", `${parsed.data.orderId} was deferred with a visible reason.`);
}

export async function publishTripAction(formData: FormData) {
  const user = await requireUser("dispatcher");
  const tripId = String(formData.get("tripId") ?? "");
  const db = getDb();
  const [trip] = await db.select().from(trips).where(eq(trips.id, tripId)).limit(1);
  if (!trip || trip.status !== "DRAFT") back("/dispatcher/plan", "error", "Only a draft trip can be published.");
  const [scopedVehicle] = await db.select().from(vehicles).where(eq(vehicles.id, trip.vehicleId)).limit(1);
  if (!scopedVehicle || scopedVehicle.depot !== user.scopeId) back("/dispatcher/plan", "error", "This trip is outside the dispatcher’s depot scope.");
  const tripOrders = await getTripOrders(trip.id);
  if (!tripOrders.length) back("/dispatcher/plan", "error", "Allocate at least one order before publishing.");
  for (const order of tripOrders) {
    const evaluated = await evaluateAssignment(order.id, trip.vehicleId, trip.tripNumber, order.plannedArrival?.slice(0, 5) ?? "", trip.distanceKm);
    if (!evaluated.result.valid) back("/dispatcher/plan", "error", `${order.id}: ${evaluated.result.checks.filter((check) => !check.passed && check.key !== "manifest").map((check) => check.label).join(", ")} must be resolved.`);
  }
  const vehicle = scopedVehicle;
  const fuel = trip.distanceKm / vehicle.kmPerLitre;
  await db.transaction(async (tx) => {
    await tx.update(trips).set({ status: "PUBLISHED", publishedAt: new Date(), fuelReserved: true, updatedAt: new Date() }).where(and(eq(trips.id, trip.id), eq(trips.status, "DRAFT")));
    await tx.update(vehicles).set({ fuelRemainingL: sql`${vehicles.fuelRemainingL} - ${fuel}` }).where(eq(vehicles.id, trip.vehicleId));
    await tx.update(orders).set({ status: "LOADING", loadedUnits: orders.handlingUnits, revision: sql`${orders.revision} + 1`, updatedAt: new Date() }).where(eq(orders.tripId, trip.id));
    await tx.insert(auditEvents).values({ tripId: trip.id, actorRole: user.role, eventType: "MANIFEST_PUBLISHED", summary: `Manifest version ${trip.manifestVersion} published for ${trip.vehicleId}.` });
  });
  revalidatePath("/");
  back("/dispatcher/plan", "notice", `Manifest version ${trip.manifestVersion} is ready for loading.`);
}

export async function resolveLoadingIssueAction(formData: FormData) {
  const user = await requireUser("dispatcher");
  const issueId = String(formData.get("issueId") ?? "");
  const db = getDb();
  const [issue] = await db.select().from(loadingIssues).where(eq(loadingIssues.id, issueId)).limit(1);
  if (!issue || issue.resolved) back("/dispatcher/progress", "error", "This issue is no longer awaiting review.");
  const [issueTrip] = await db.select({ depot: vehicles.depot }).from(trips).innerJoin(vehicles, eq(trips.vehicleId, vehicles.id)).where(eq(trips.id, issue.tripId)).limit(1);
  if (!issueTrip || issueTrip.depot !== user.scopeId) back("/dispatcher/progress", "error", "This issue is outside the dispatcher’s depot scope.");
  await db.transaction(async (tx) => {
    const [trip] = await tx.select().from(trips).where(eq(trips.id, issue.tripId)).limit(1);
    await tx.update(loadingIssues).set({ resolved: true, resolvedAt: new Date() }).where(eq(loadingIssues.id, issue.id));
    await tx.update(orders).set({ loadedUnits: issue.actualUnits, shortfallReason: issue.reason, revision: sql`${orders.revision} + 1`, updatedAt: new Date() }).where(eq(orders.id, issue.orderId));
    await tx.update(trips).set({ manifestVersion: sql`${trips.manifestVersion} + 1`, updatedAt: new Date() }).where(eq(trips.id, issue.tripId));
    await tx.delete(loadingChecks).where(and(eq(loadingChecks.tripId, issue.tripId), eq(loadingChecks.orderId, issue.orderId)));
    await tx.insert(auditEvents).values({ orderId: issue.orderId, tripId: issue.tripId, actorRole: user.role, eventType: "SHORTFALL_APPROVED", summary: `Approved ${issue.actualUnits} loaded units. Manifest revision ${trip.manifestVersion + 1} requires recheck.` });
  });
  revalidatePath("/");
  back("/dispatcher/progress", "notice", "The shortfall was approved and the affected load check was reset.");
}

export async function resolveSyncConflictAction(formData: FormData) {
  const user = await requireUser("dispatcher");
  const proofId = String(formData.get("proofId") ?? "");
  const db = getDb();
  const [proof] = await db.select().from(deliveryProofs).where(eq(deliveryProofs.id, proofId)).limit(1);
  if (!proof || proof.syncStatus !== "NEEDS_REVIEW") back("/dispatcher/progress", "error", "This proof no longer needs review.");
  const [order] = await db.select().from(orders).where(eq(orders.id, proof.orderId)).limit(1);
  if (!order?.tripId) back("/dispatcher/progress", "error", "The related trip was not found.");
  const [scope] = await db.select({ depot: vehicles.depot }).from(trips).innerJoin(vehicles, eq(trips.vehicleId, vehicles.id)).where(eq(trips.id, order.tripId)).limit(1);
  if (!scope || scope.depot !== user.scopeId) back("/dispatcher/progress", "error", "This proof is outside the dispatcher’s depot scope.");
  await db.transaction(async (tx) => {
    await tx.update(deliveryProofs).set({ syncStatus: "SYNCHRONIZED", conflictReason: "Dispatcher reviewed the revision conflict and retained the original delivery evidence." }).where(eq(deliveryProofs.id, proof.id));
    await tx.update(orders).set({ status: proof.outcome, deliveredUnits: proof.quantity, revision: sql`${orders.revision} + 1`, updatedAt: new Date() }).where(eq(orders.id, proof.orderId));
    await tx.update(syncOperations).set({ result: "applied", response: { result: "applied", proofId: proof.id, message: "Dispatcher reviewed the conflict and retained the delivery evidence." } }).where(eq(syncOperations.idempotencyKey, proof.idempotencyKey));
    await tx.insert(auditEvents).values({ orderId: proof.orderId, tripId: order.tripId, actorRole: user.role, eventType: "SYNC_CONFLICT_RESOLVED", summary: "Dispatcher reviewed the conflict and retained the original driver evidence." });
  });
  revalidatePath("/");
  back("/dispatcher/progress", "notice", "Conflict reviewed. The original driver evidence is now shared.");
}
