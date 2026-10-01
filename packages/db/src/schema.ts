import {
  boolean,
  date,
  doublePrecision,
  integer,
  jsonb,
  pgTable,
  text,
  time,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: varchar("email", { length: 160 }).notNull().unique(),
  name: varchar("name", { length: 120 }).notNull(),
  role: varchar("role", { length: 24 }).notNull(),
  scopeId: varchar("scope_id", { length: 60 }),
  passwordHash: text("password_hash").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const outlets = pgTable("outlets", {
  id: varchar("id", { length: 16 }).primaryKey(),
  brand: varchar("brand", { length: 24 }).notNull(),
  district: varchar("district", { length: 60 }).notNull(),
  depot: varchar("depot", { length: 60 }).notNull(),
  dockType: varchar("dock_type", { length: 24 }).notNull(),
  parkingConstraint: varchar("parking_constraint", { length: 24 }).notNull(),
  mallWindow: varchar("mall_window", { length: 20 }),
  windowOpen: time("window_open").notNull(),
  windowClose: time("window_close").notNull(),
});

export const vehicles = pgTable("vehicles", {
  id: varchar("id", { length: 16 }).primaryKey(),
  type: varchar("type", { length: 16 }).notNull(),
  temperature: varchar("temperature", { length: 16 }).notNull(),
  weightCapacityKg: doublePrecision("weight_capacity_kg").notNull(),
  volumeCapacityM3: doublePrecision("volume_capacity_m3").notNull(),
  fuelType: varchar("fuel_type", { length: 24 }).notNull(),
  kmPerLitre: doublePrecision("km_per_litre").notNull(),
  weeklyFuelQuotaL: doublePrecision("weekly_fuel_quota_l").notNull(),
  fuelRemainingL: doublePrecision("fuel_remaining_l").notNull(),
  depot: varchar("depot", { length: 60 }).notNull(),
});

export const calendarDays = pgTable("calendar_days", {
  day: date("day").primaryKey(),
  dayOfWeek: integer("day_of_week").notNull(),
  dayName: varchar("day_name", { length: 12 }).notNull(),
  isoYear: integer("iso_year").notNull(),
  isoWeek: integer("iso_week").notNull(),
  isPayday: boolean("is_payday").notNull(),
  festival: varchar("festival", { length: 80 }),
  festivalRamp: doublePrecision("festival_ramp").notNull(),
  isHoliday: boolean("is_holiday").notNull(),
  monsoon: boolean("monsoon").notNull(),
  isOperating: boolean("is_operating").notNull(),
});

export const trips = pgTable(
  "trips",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    vehicleId: varchar("vehicle_id", { length: 16 }).notNull().references(() => vehicles.id),
    deliveryDate: date("delivery_date").notNull(),
    tripNumber: integer("trip_number").notNull(),
    status: varchar("status", { length: 24 }).notNull().default("DRAFT"),
    departureTime: time("departure_time").notNull().default("05:00"),
    distanceKm: doublePrecision("distance_km").notNull().default(0),
    manifestVersion: integer("manifest_version").notNull().default(1),
    fuelReserved: boolean("fuel_reserved").notNull().default(false),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    startedAt: timestamp("started_at", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("trip_vehicle_date_number").on(table.vehicleId, table.deliveryDate, table.tripNumber)],
);

export const orders = pgTable("orders", {
  id: varchar("id", { length: 24 }).primaryKey(),
  outletId: varchar("outlet_id", { length: 16 }).notNull().references(() => outlets.id),
  requestedDate: date("requested_date").notNull(),
  temperature: varchar("temperature", { length: 16 }).notNull(),
  weightKg: doublePrecision("weight_kg").notNull(),
  volumeM3: doublePrecision("volume_m3").notNull(),
  handlingUnits: integer("handling_units").notNull(),
  loadedUnits: integer("loaded_units"),
  deliveredUnits: integer("delivered_units"),
  status: varchar("status", { length: 32 }).notNull().default("CONFIRMED"),
  tripId: uuid("trip_id").references(() => trips.id),
  stopSequence: integer("stop_sequence"),
  plannedArrival: time("planned_arrival"),
  priorDeferrals: integer("prior_deferrals").notNull().default(0),
  deferralReason: text("deferral_reason"),
  nextRun: date("next_run"),
  shortfallReason: text("shortfall_reason"),
  revision: integer("revision").notNull().default(1),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const loadingChecks = pgTable(
  "loading_checks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tripId: uuid("trip_id").notNull().references(() => trips.id, { onDelete: "cascade" }),
    orderId: varchar("order_id", { length: 24 }).notNull().references(() => orders.id, { onDelete: "cascade" }),
    manifestVersion: integer("manifest_version").notNull(),
    checkedAt: timestamp("checked_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("loading_check_version").on(table.tripId, table.orderId, table.manifestVersion)],
);

export const loadingIssues = pgTable("loading_issues", {
  id: uuid("id").primaryKey().defaultRandom(),
  tripId: uuid("trip_id").notNull().references(() => trips.id, { onDelete: "cascade" }),
  orderId: varchar("order_id", { length: 24 }).notNull().references(() => orders.id, { onDelete: "cascade" }),
  actualUnits: integer("actual_units").notNull(),
  reason: text("reason").notNull(),
  resolved: boolean("resolved").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
});

export const deliveryProofs = pgTable("delivery_proofs", {
  id: varchar("id", { length: 80 }).primaryKey(),
  orderId: varchar("order_id", { length: 24 }).notNull().references(() => orders.id),
  idempotencyKey: varchar("idempotency_key", { length: 80 }).notNull().unique(),
  baseRevision: integer("base_revision").notNull(),
  outcome: varchar("outcome", { length: 24 }).notNull(),
  quantity: integer("quantity").notNull(),
  receiverOrReason: text("receiver_or_reason").notNull(),
  recordedAt: timestamp("recorded_at", { withTimezone: true }).notNull(),
  syncStatus: varchar("sync_status", { length: 24 }).notNull().default("APPLIED"),
  photoDataUrl: text("photo_data_url"),
  conflictReason: text("conflict_reason"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const receipts = pgTable(
  "receipts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: varchar("order_id", { length: 24 }).notNull().references(() => orders.id),
    quantity: integer("quantity").notNull(),
    issue: text("issue"),
    confirmedAt: timestamp("confirmed_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("one_receipt_per_order").on(table.orderId)],
);

export const syncOperations = pgTable("sync_operations", {
  idempotencyKey: varchar("idempotency_key", { length: 80 }).primaryKey(),
  result: varchar("result", { length: 24 }).notNull(),
  response: jsonb("response").notNull(),
  processedAt: timestamp("processed_at", { withTimezone: true }).notNull().defaultNow(),
});

export const auditEvents = pgTable("audit_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  orderId: varchar("order_id", { length: 24 }).references(() => orders.id),
  tripId: uuid("trip_id").references(() => trips.id),
  actorRole: varchar("actor_role", { length: 24 }).notNull(),
  eventType: varchar("event_type", { length: 60 }).notNull(),
  summary: text("summary").notNull(),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const districtTravel = pgTable("district_travel", {
  district: varchar("district", { length: 60 }).notNull(),
  depot: varchar("depot", { length: 60 }).notNull(),
  roadClass: varchar("road_class", { length: 24 }).notNull(),
  freeFlowKmh: doublePrecision("free_flow_kmh").notNull(),
  depotDistanceKm: doublePrecision("depot_distance_km").notNull(),
  depotMinutes: integer("depot_minutes").notNull(),
  interStopKm: doublePrecision("inter_stop_km").notNull(),
  interStopMinutes: integer("inter_stop_minutes").notNull(),
});

export const serviceAllowances = pgTable("service_allowances", {
  brand: varchar("brand", { length: 24 }).notNull(),
  dockType: varchar("dock_type", { length: 24 }).notNull(),
  serviceMinutes: integer("service_minutes").notNull(),
});
