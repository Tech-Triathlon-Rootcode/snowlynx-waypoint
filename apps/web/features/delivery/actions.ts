"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auditEvents, getDb, orders, trips } from "@snowlynx/db";
import { requireUser } from "@/lib/auth";

export async function startTripAction(formData: FormData) {
  const user = await requireUser("driver");
  const tripId = String(formData.get("tripId") ?? "");
  const db = getDb();
  const [trip] = await db.select().from(trips).where(eq(trips.id, tripId)).limit(1);
  if (!trip || trip.status !== "READY") redirect(`/driver/route?error=${encodeURIComponent("Wait for the current manifest to be released by loading.")}`);
  if (trip.vehicleId !== user.scopeId) redirect(`/driver/route?error=${encodeURIComponent("This route is assigned to another driver account.")}`);
  await db.transaction(async (tx) => {
    await tx.update(trips).set({ status: "STARTED", startedAt: new Date(), updatedAt: new Date() }).where(eq(trips.id, tripId));
    await tx.update(orders).set({ status: "OUT_FOR_DELIVERY", updatedAt: new Date() }).where(eq(orders.tripId, tripId));
    await tx.insert(auditEvents).values({ tripId, actorRole: user.role, eventType: "ROUTE_STARTED", summary: `Route downloaded at manifest version ${trip.manifestVersion} and departed.` });
  });
  revalidatePath("/");
  redirect("/driver/route?notice=Route%20downloaded%20and%20started.");
}
