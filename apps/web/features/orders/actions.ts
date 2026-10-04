"use server";

import { desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auditEvents, getDb, orders, outlets, receipts } from "@snowlynx/db";
import { validateReceipt } from "@snowlynx/domain";
import { requireUser } from "@/lib/auth";
import { DEMO_DATE } from "@/lib/queries";

export async function createOrderAction(formData: FormData) {
  const user = await requireUser("manager");
  const outletId = String(formData.get("outletId") ?? "");
  const temperature = String(formData.get("temperature") ?? "");
  const weightKg = Number(formData.get("weightKg"));
  const volumeM3 = Number(formData.get("volumeM3"));
  const handlingUnits = Number(formData.get("handlingUnits"));
  const orderTime = String(formData.get("orderTime") ?? "");
  const db = getDb();
  if (outletId !== user.scopeId) redirect(`/store/new?error=${encodeURIComponent("This seeded store account can place orders only for its assigned outlet.")}`);
  const [outlet] = await db.select().from(outlets).where(eq(outlets.id, outletId)).limit(1);
  if (!outlet || !["ambient", "chilled"].includes(temperature) || weightKg <= 0 || volumeM3 <= 0 || !Number.isInteger(handlingUnits) || handlingUnits <= 0 || !/^\d{2}:\d{2}$/.test(orderTime)) {
    redirect(`/store/new?error=${encodeURIComponent("Complete every order field with a valid positive value.")}`);
  }
  if (temperature === "chilled" && outlet.brand !== "Fresh") redirect(`/store/new?error=${encodeURIComponent("Chilled ordering is available for Fresh outlets in this demonstration.")}`);
  const late = orderTime > "16:00";
  const [latest] = await db.select({ id: orders.id }).from(orders).orderBy(desc(orders.id)).limit(1);
  const latestNumber = Number(latest?.id.match(/\d+$/)?.[0] ?? 0);
  const id = `ORD-${String(latestNumber + 1).padStart(4, "0")}`;
  await db.transaction(async (tx) => {
    await tx.insert(orders).values({ id, outletId, requestedDate: DEMO_DATE, temperature, weightKg, volumeM3, handlingUnits, status: late ? "NEXT_RUN" : "CONFIRMED" });
    await tx.insert(auditEvents).values({ orderId: id, actorRole: user.role, eventType: late ? "ORDER_AFTER_CUTOFF" : "ORDER_CONFIRMED", summary: late ? "Received after the 16:00 cutoff; moved to the next run." : "Order confirmed before the 16:00 cutoff." });
  });
  revalidatePath("/");
  redirect(`/store/orders?notice=${encodeURIComponent(`${id} ${late ? "was received for the next run" : "was confirmed"}.`)}`);
}

export async function confirmReceiptAction(formData: FormData) {
  const user = await requireUser("manager");
  const orderId = String(formData.get("orderId") ?? "");
  const quantity = Number(formData.get("quantity"));
  const issue = String(formData.get("issue") ?? "").trim();
  const db = getDb();
  const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
  if (!order || !["DELIVERED", "PARTIAL"].includes(order.status) || order.deliveredUnits == null) redirect(`/store/receipt?error=${encodeURIComponent("Wait for a synchronized driver delivery record.")}`);
  if (order.outletId !== user.scopeId) redirect(`/store/receipt?error=${encodeURIComponent("This delivery belongs to another outlet.")}`);
  try { validateReceipt(order.deliveredUnits, quantity, issue); } catch (error) { redirect(`/store/receipt?error=${encodeURIComponent(error instanceof Error ? error.message : "Receipt is invalid.")}`); }
  await db.transaction(async (tx) => {
    await tx.insert(receipts).values({ orderId, quantity, issue: issue || null }).onConflictDoUpdate({ target: receipts.orderId, set: { quantity, issue: issue || null, confirmedAt: new Date() } });
    await tx.update(orders).set({ status: issue || quantity !== order.deliveredUnits ? "RECEIPT_ISSUE" : "RECEIPT_CONFIRMED", revision: order.revision + 1, updatedAt: new Date() }).where(eq(orders.id, orderId));
    await tx.insert(auditEvents).values({ orderId, actorRole: user.role, eventType: "RECEIPT_CONFIRMED", summary: issue ? `Receipt confirmed with issue: ${issue}` : `Receipt confirmed for ${quantity} units.` });
  });
  revalidatePath("/");
  redirect(`/store/orders?notice=${encodeURIComponent("Receipt confirmed. The driver record remains unchanged.")}`);
}
