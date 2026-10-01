import type { AssignmentInput, AssignmentResult, ConstraintCheck } from "./types";

export function minutes(time: string): number {
  if (!/^\d{2}:\d{2}$/.test(time)) throw new Error("Enter a valid time.");
  const [hours, mins] = time.split(":").map(Number);
  if (hours > 23 || mins > 59) throw new Error("Enter a valid time.");
  return hours * 60 + mins;
}

export function validateAssignment(input: AssignmentInput): AssignmentResult {
  const { order, vehicle } = input;
  const weightKg = input.existingOrders.reduce((sum, peer) => sum + peer.weightKg, 0) + order.weightKg;
  const volumeM3 = input.existingOrders.reduce((sum, peer) => sum + peer.volumeM3, 0) + order.volumeM3;
  const fuelLitres = input.distanceKm / vehicle.kmPerLitre;
  const arrival = minutes(input.plannedArrival);
  const windowOpen = minutes(order.outlet.windowOpen);
  const windowClose = minutes(order.outlet.windowClose);

  const checks: ConstraintCheck[] = [
    {
      key: "weight",
      label: "Weight capacity",
      passed: weightKg <= vehicle.weightCapacityKg,
      detail: `${weightKg.toLocaleString()} / ${vehicle.weightCapacityKg.toLocaleString()} kg`,
    },
    {
      key: "volume",
      label: "Volume capacity",
      passed: volumeM3 <= vehicle.volumeCapacityM3,
      detail: `${volumeM3.toFixed(1)} / ${vehicle.volumeCapacityM3.toFixed(1)} m³`,
    },
    {
      key: "temperature",
      label: "Temperature",
      passed: order.temperature !== "chilled" || vehicle.temperature === "reefer",
      detail: order.temperature === "chilled" ? "Refrigeration required" : "Ambient goods",
    },
    {
      key: "access",
      label: "Outlet access",
      passed: order.outlet.parkingConstraint !== "van_only" || vehicle.type === "van",
      detail: order.outlet.parkingConstraint === "van_only" ? "Van access only" : "Standard access",
    },
    {
      key: "depot",
      label: "Home depot",
      passed: order.outlet.depot === vehicle.depot,
      detail: `${order.outlet.depot} outlet · ${vehicle.depot} vehicle`,
    },
    {
      key: "window",
      label: "Delivery window",
      passed: arrival >= windowOpen && arrival <= windowClose,
      detail: `${input.plannedArrival} arrival · ${order.outlet.windowOpen}–${order.outlet.windowClose}`,
    },
    {
      key: "fuel",
      label: "Weekly fuel",
      passed: input.distanceKm > 0 && fuelLitres <= vehicle.fuelRemainingL,
      detail: `${fuelLitres.toFixed(1)} L needed · ${vehicle.fuelRemainingL.toFixed(1)} L remaining`,
    },
    {
      key: "trip",
      label: "Daily trip limit",
      passed: input.tripNumber === 1 || input.tripNumber === 2,
      detail: `Trip ${input.tripNumber} of 2`,
    },
    {
      key: "operating-day",
      label: "Operating day",
      passed: input.isOperatingDay,
      detail: input.isOperatingDay ? "Delivery operations are open" : "No deliveries operate on this date",
    },
    {
      key: "manifest",
      label: "Manifest unlocked",
      passed: !input.manifestLocked,
      detail: input.manifestLocked ? "Published trip requires a new revision" : "Trip can be edited",
    },
  ];

  return {
    valid: checks.every((check) => check.passed),
    checks,
    totals: { weightKg, volumeM3, fuelLitres },
  };
}

export interface DraftCandidate {
  order: OrderInputForDraft;
  vehicle: VehicleInputForDraft;
  score: number;
  result: AssignmentResult;
}

type OrderInputForDraft = AssignmentInput["order"] & { priorDeferrals: number };
type VehicleInputForDraft = AssignmentInput["vehicle"];

export function rankFeasibleVehicles(
  order: OrderInputForDraft,
  vehicles: VehicleInputForDraft[],
  base: Omit<AssignmentInput, "order" | "vehicle">,
): DraftCandidate[] {
  return vehicles
    .map((vehicle) => {
      const result = validateAssignment({ ...base, order, vehicle });
      const remainingVolume = vehicle.volumeCapacityM3 - result.totals.volumeM3;
      const scarcityPenalty = order.temperature === "ambient" && vehicle.temperature === "reefer" ? 15 : 0;
      const accessBonus = order.outlet.parkingConstraint === "van_only" && vehicle.type === "van" ? 10 : 0;
      const score = order.priorDeferrals * 30 + accessBonus - scarcityPenalty - Math.max(0, remainingVolume);
      return { order, vehicle, score, result };
    })
    .filter((candidate) => candidate.result.valid)
    .sort((a, b) => b.score - a.score || a.vehicle.id.localeCompare(b.vehicle.id));
}
