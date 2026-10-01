import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { auditEvents, deliveryProofs, getDb, orders, syncOperations, trips } from "@snowlynx/db";
import { validateDeliveryRecord } from "@snowlynx/domain";
import { getSession } from "@/lib/auth";

const payloadSchema = z.object({
  id: z.string().min(8).max(80),
  idempotencyKey: z.string().uuid(),
  orderId: z.string().regex(/^ORD-\d+$/),
  baseRevision: z.number().int().positive(),
  outcome: z.enum(["DELIVERED", "PARTIAL", "UNABLE"]),
  quantity: z.number().int().nonnegative(),
  loadedQuantity: z.number().int().nonnegative(),
  receiverOrReason: z.string().min(2).max(500),
  acknowledged: z.literal(true),
  recordedAt: z.string().datetime(),
  photoDataUrl: z.string().max(1_500_000).nullable().optional(),
});

export async function POST(request: Request) {
  const user = await getSession();
  if (!user || user.role !== "driver") return NextResponse.json({ error: "Driver authentication is required." }, { status: 401 });
  const parsed = payloadSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid delivery record." }, { status: 400 });
  try {
    validateDeliveryRecord(parsed.data);
    const db = getDb();
    const [prior] = await db.select().from(syncOperations).where(eq(syncOperations.idempotencyKey, parsed.data.idempotencyKey)).limit(1);
    if (prior) return NextResponse.json({ ...prior.response as object, result: "duplicate" });
    const [order] = await db.select().from(orders).where(eq(orders.id, parsed.data.orderId)).limit(1);
    if (!order) return NextResponse.json({ error: "Order was not found." }, { status: 404 });
    if (!order.tripId) return NextResponse.json({ error: "Order is not assigned to a route." }, { status: 403 });
    const [trip] = await db.select().from(trips).where(eq(trips.id, order.tripId)).limit(1);
    if (!trip || trip.vehicleId !== user.scopeId) return NextResponse.json({ error: "This stop is assigned to another driver account." }, { status: 403 });
    if (order.revision !== parsed.data.baseRevision || order.status !== "OUT_FOR_DELIVERY") {
      const response = { result: "conflict", proofId: parsed.data.id, message: "The shared order changed after this route was downloaded. Original evidence is preserved for dispatcher review." };
      await db.transaction(async (tx) => {
        await tx.insert(deliveryProofs).values({ id: parsed.data.id, orderId: order.id, idempotencyKey: parsed.data.idempotencyKey, baseRevision: parsed.data.baseRevision, outcome: parsed.data.outcome, quantity: parsed.data.quantity, receiverOrReason: parsed.data.receiverOrReason, recordedAt: new Date(parsed.data.recordedAt), syncStatus: "NEEDS_REVIEW", photoDataUrl: parsed.data.photoDataUrl ?? null, conflictReason: `Expected revision ${parsed.data.baseRevision}; shared revision is ${order.revision}.` }).onConflictDoNothing();
        await tx.insert(syncOperations).values({ idempotencyKey: parsed.data.idempotencyKey, result: "conflict", response });
        await tx.insert(auditEvents).values({ orderId: order.id, actorRole: user.role, eventType: "SYNC_CONFLICT", summary: "Offline delivery evidence requires dispatcher review." });
      });
      return NextResponse.json(response, { status: 409 });
    }
    const status = parsed.data.outcome;
    const response = { result: "applied", proofId: parsed.data.id, message: "Delivery evidence synchronized." };
    await db.transaction(async (tx) => {
      await tx.insert(deliveryProofs).values({ id: parsed.data.id, orderId: order.id, idempotencyKey: parsed.data.idempotencyKey, baseRevision: parsed.data.baseRevision, outcome: parsed.data.outcome, quantity: parsed.data.quantity, receiverOrReason: parsed.data.receiverOrReason, recordedAt: new Date(parsed.data.recordedAt), syncStatus: "SYNCHRONIZED", photoDataUrl: parsed.data.photoDataUrl ?? null });
      await tx.update(orders).set({ status, deliveredUnits: parsed.data.quantity, revision: order.revision + 1, updatedAt: new Date() }).where(eq(orders.id, order.id));
      await tx.insert(syncOperations).values({ idempotencyKey: parsed.data.idempotencyKey, result: "applied", response });
      await tx.insert(auditEvents).values({ orderId: order.id, actorRole: user.role, eventType: "DELIVERY_SYNCHRONIZED", summary: `${parsed.data.outcome.replaceAll("_", " ")}: ${parsed.data.quantity} units recorded by ${parsed.data.receiverOrReason}.` });
    });
    return NextResponse.json(response);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to synchronize the record." }, { status: 400 });
  }
}
