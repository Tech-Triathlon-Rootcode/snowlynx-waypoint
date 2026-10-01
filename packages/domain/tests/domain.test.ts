import { describe, expect, it } from "vitest";
import { validateAssignment, validateDeliveryRecord, validateReceipt } from "../src";

const outlet = {
  id: "OUT001",
  brand: "Fresh",
  district: "Colombo",
  depot: "Peliyagoda",
  dockType: "street",
  parkingConstraint: "van_only",
  windowOpen: "05:00",
  windowClose: "07:30",
};

const order = { id: "ORD-2701", temperature: "chilled" as const, weightKg: 420, volumeM3: 2.8, handlingUnits: 20, outlet };
const reeferVan = {
  id: "VEH035",
  type: "van",
  temperature: "reefer",
  weightCapacityKg: 1040,
  volumeCapacityM3: 7,
  kmPerLitre: 10.2,
  weeklyFuelQuotaL: 220,
  fuelRemainingL: 32,
  depot: "Peliyagoda",
};

describe("allocation constraints", () => {
  it("accepts the submitted demonstration assignment", () => {
    const result = validateAssignment({
      order,
      vehicle: reeferVan,
      existingOrders: [
        { id: "ORD-2702", weightKg: 260, volumeM3: 1.6 },
        { id: "ORD-2703", weightKg: 180, volumeM3: 1.2 },
      ],
      tripNumber: 1,
      plannedArrival: "05:20",
      distanceKm: 42,
      isOperatingDay: true,
    });
    expect(result.valid).toBe(true);
    expect(result.totals.weightKg).toBe(860);
    expect(result.totals.volumeM3).toBeCloseTo(5.6);
  });

  it("rejects an ambient truck for chilled, van-only demand", () => {
    const result = validateAssignment({
      order,
      vehicle: { ...reeferVan, id: "VEH013", type: "truck", temperature: "ambient" },
      existingOrders: [],
      tripNumber: 1,
      plannedArrival: "05:20",
      distanceKm: 42,
      isOperatingDay: true,
    });
    expect(result.checks.filter((check) => !check.passed).map((check) => check.key)).toEqual(["temperature", "access"]);
  });

  it("evaluates weight and volume independently", () => {
    const result = validateAssignment({ order: { ...order, weightKg: 100, volumeM3: 8 }, vehicle: reeferVan, existingOrders: [], tripNumber: 1, plannedArrival: "05:20", distanceKm: 42, isOperatingDay: true });
    expect(result.checks.find((check) => check.key === "weight")?.passed).toBe(true);
    expect(result.checks.find((check) => check.key === "volume")?.passed).toBe(false);
  });

  it("rejects the wrong depot and a closed operating day", () => {
    const result = validateAssignment({ order, vehicle: { ...reeferVan, depot: "Kandy" }, existingOrders: [], tripNumber: 1, plannedArrival: "05:20", distanceKm: 42, isOperatingDay: false });
    expect(result.checks.filter((check) => !check.passed).map((check) => check.key)).toEqual(["depot", "operating-day"]);
  });

  it("rejects arrival outside the outlet window", () => {
    const result = validateAssignment({ order, vehicle: reeferVan, existingOrders: [], tripNumber: 1, plannedArrival: "08:30", distanceKm: 42, isOperatingDay: true });
    expect(result.checks.find((check) => check.key === "window")?.passed).toBe(false);
  });

  it("rejects fuel shortage, a third trip, and a locked manifest", () => {
    const result = validateAssignment({ order, vehicle: { ...reeferVan, fuelRemainingL: 1 }, existingOrders: [], tripNumber: 3, plannedArrival: "05:20", distanceKm: 42, isOperatingDay: true, manifestLocked: true });
    expect(result.checks.filter((check) => !check.passed).map((check) => check.key)).toEqual(["fuel", "trip", "manifest"]);
  });
});

describe("delivery evidence", () => {
  it("requires partial outcome for a short delivery", () => {
    expect(() => validateDeliveryRecord({ outcome: "DELIVERED", quantity: 18, loadedQuantity: 20, receiverOrReason: "Kavindi", acknowledged: true })).toThrow(/partial/i);
  });

  it("requires a receipt discrepancy explanation", () => {
    expect(() => validateReceipt(18, 17, "")).toThrow(/explain/i);
    expect(() => validateReceipt(18, 17, "One unit damaged")).not.toThrow();
  });

  it("requires zero units for an unsuccessful stop", () => {
    expect(() => validateDeliveryRecord({ outcome: "UNABLE", quantity: 1, loadedQuantity: 20, receiverOrReason: "Store closed", acknowledged: true })).toThrow(/zero/i);
  });

  it("accepts a valid partial delivery", () => {
    expect(() => validateDeliveryRecord({ outcome: "PARTIAL", quantity: 18, loadedQuantity: 20, receiverOrReason: "Kavindi", acknowledged: true })).not.toThrow();
  });
});
