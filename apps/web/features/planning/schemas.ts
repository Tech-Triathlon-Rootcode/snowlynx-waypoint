import { z } from "zod";

export const assignmentSchema = z.object({
  orderId: z.string().regex(/^ORD-\d+$/),
  vehicleId: z.string().regex(/^VEH\d{3}$/),
  tripNumber: z.coerce.number().int().min(1).max(2),
  plannedArrival: z.string().regex(/^\d{2}:\d{2}$/),
  distanceKm: z.coerce.number().positive().max(1000),
});

export const deferralSchema = z.object({
  orderId: z.string().regex(/^ORD-\d+$/),
  reason: z.string().trim().min(8).max(500),
  nextRun: z.string().date(),
});
