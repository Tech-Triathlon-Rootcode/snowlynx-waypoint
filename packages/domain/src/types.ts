export type Role = "dispatcher" | "loader" | "driver" | "manager";
export type Temperature = "ambient" | "chilled";
export type TripStatus = "DRAFT" | "PUBLISHED" | "READY" | "STARTED" | "COMPLETED";
export type OrderStatus =
  | "CONFIRMED"
  | "ALLOCATED"
  | "DEFERRED"
  | "LOADING"
  | "READY"
  | "OUT_FOR_DELIVERY"
  | "DELIVERED"
  | "PARTIAL"
  | "UNABLE"
  | "RECEIPT_CONFIRMED"
  | "RECEIPT_ISSUE"
  | "NEXT_RUN";

export interface OutletInput {
  id: string;
  brand: string;
  district: string;
  depot: string;
  dockType: string;
  parkingConstraint: string;
  windowOpen: string;
  windowClose: string;
}

export interface VehicleInput {
  id: string;
  type: string;
  temperature: string;
  weightCapacityKg: number;
  volumeCapacityM3: number;
  kmPerLitre: number;
  weeklyFuelQuotaL: number;
  fuelRemainingL: number;
  depot: string;
}

export interface OrderInput {
  id: string;
  temperature: Temperature;
  weightKg: number;
  volumeM3: number;
  handlingUnits: number;
  outlet: OutletInput;
}

export interface TripOrderInput {
  id: string;
  weightKg: number;
  volumeM3: number;
}

export interface AssignmentInput {
  order: OrderInput;
  vehicle: VehicleInput;
  existingOrders: TripOrderInput[];
  tripNumber: number;
  plannedArrival: string;
  distanceKm: number;
  isOperatingDay: boolean;
  manifestLocked?: boolean;
}

export interface ConstraintCheck {
  key: string;
  label: string;
  passed: boolean;
  detail: string;
}

export interface AssignmentResult {
  valid: boolean;
  checks: ConstraintCheck[];
  totals: {
    weightKg: number;
    volumeM3: number;
    fuelLitres: number;
  };
}

export type DeliveryOutcome = "DELIVERED" | "PARTIAL" | "UNABLE";

export interface DeliveryRecordInput {
  outcome: DeliveryOutcome;
  quantity: number;
  loadedQuantity: number;
  receiverOrReason: string;
  acknowledged: boolean;
}
