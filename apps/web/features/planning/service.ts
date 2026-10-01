import "server-only";
import { and, eq, ne } from "drizzle-orm";
import { calendarDays, getDb, orders, outlets, trips, vehicles } from "@snowlynx/db";
import { validateAssignment } from "@snowlynx/domain";
import { DEMO_DATE } from "@/lib/queries";

export async function evaluateAssignment(orderId: string, vehicleId: string, tripNumber: number, plannedArrival: string, distanceKm: number) {
  const db = getDb();
  const [[order], [vehicle], [day], [trip]] = await Promise.all([
    db.select({
      id: orders.id,
      temperature: orders.temperature,
      weightKg: orders.weightKg,
      volumeM3: orders.volumeM3,
      handlingUnits: orders.handlingUnits,
      currentTripId: orders.tripId,
      outlet: outlets,
    }).from(orders).innerJoin(outlets, eq(orders.outletId, outlets.id)).where(eq(orders.id, orderId)).limit(1),
    db.select().from(vehicles).where(eq(vehicles.id, vehicleId)).limit(1),
    db.select().from(calendarDays).where(eq(calendarDays.day, DEMO_DATE)).limit(1),
    db.select().from(trips).where(and(eq(trips.vehicleId, vehicleId), eq(trips.deliveryDate, DEMO_DATE), eq(trips.tripNumber, tripNumber))).limit(1),
  ]);
  if (!order || !vehicle || !day) throw new Error("Choose a valid order, vehicle, and operating day.");
  if (order.currentTripId) {
    const [currentTrip] = await db.select().from(trips).where(eq(trips.id, order.currentTripId)).limit(1);
    if (currentTrip?.status !== "DRAFT") throw new Error("A published manifest is locked. Resolve it through a new manifest revision.");
  }
  const peers = trip
    ? await db.select({ id: orders.id, weightKg: orders.weightKg, volumeM3: orders.volumeM3 }).from(orders).where(and(eq(orders.tripId, trip.id), ne(orders.id, orderId)))
    : [];
  const result = validateAssignment({
    order: {
      id: order.id,
      temperature: order.temperature as "ambient" | "chilled",
      weightKg: order.weightKg,
      volumeM3: order.volumeM3,
      handlingUnits: order.handlingUnits,
      outlet: {
        id: order.outlet.id,
        brand: order.outlet.brand,
        district: order.outlet.district,
        depot: order.outlet.depot,
        dockType: order.outlet.dockType,
        parkingConstraint: order.outlet.parkingConstraint,
        windowOpen: order.outlet.windowOpen.slice(0, 5),
        windowClose: order.outlet.windowClose.slice(0, 5),
      },
    },
    vehicle: {
      id: vehicle.id,
      type: vehicle.type,
      temperature: vehicle.temperature,
      weightCapacityKg: vehicle.weightCapacityKg,
      volumeCapacityM3: vehicle.volumeCapacityM3,
      kmPerLitre: vehicle.kmPerLitre,
      weeklyFuelQuotaL: vehicle.weeklyFuelQuotaL,
      fuelRemainingL: vehicle.fuelRemainingL,
      depot: vehicle.depot,
    },
    existingOrders: peers,
    tripNumber,
    plannedArrival,
    distanceKm,
    isOperatingDay: day.isOperating,
    manifestLocked: trip ? trip.status !== "DRAFT" : false,
  });
  return { order, vehicle, trip, result };
}
