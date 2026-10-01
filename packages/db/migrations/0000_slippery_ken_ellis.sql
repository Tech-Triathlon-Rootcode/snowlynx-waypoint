CREATE TABLE "audit_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" varchar(24),
	"trip_id" uuid,
	"actor_role" varchar(24) NOT NULL,
	"event_type" varchar(60) NOT NULL,
	"summary" text NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "calendar_days" (
	"day" date PRIMARY KEY NOT NULL,
	"day_of_week" integer NOT NULL,
	"day_name" varchar(12) NOT NULL,
	"iso_year" integer NOT NULL,
	"iso_week" integer NOT NULL,
	"is_payday" boolean NOT NULL,
	"festival" varchar(80),
	"festival_ramp" double precision NOT NULL,
	"is_holiday" boolean NOT NULL,
	"monsoon" boolean NOT NULL,
	"is_operating" boolean NOT NULL
);
--> statement-breakpoint
CREATE TABLE "delivery_proofs" (
	"id" varchar(80) PRIMARY KEY NOT NULL,
	"order_id" varchar(24) NOT NULL,
	"idempotency_key" varchar(80) NOT NULL,
	"base_revision" integer NOT NULL,
	"outcome" varchar(24) NOT NULL,
	"quantity" integer NOT NULL,
	"receiver_or_reason" text NOT NULL,
	"recorded_at" timestamp with time zone NOT NULL,
	"sync_status" varchar(24) DEFAULT 'APPLIED' NOT NULL,
	"photo_data_url" text,
	"conflict_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "delivery_proofs_idempotency_key_unique" UNIQUE("idempotency_key")
);
--> statement-breakpoint
CREATE TABLE "district_travel" (
	"district" varchar(60) NOT NULL,
	"depot" varchar(60) NOT NULL,
	"road_class" varchar(24) NOT NULL,
	"free_flow_kmh" double precision NOT NULL,
	"depot_distance_km" double precision NOT NULL,
	"depot_minutes" integer NOT NULL,
	"inter_stop_km" double precision NOT NULL,
	"inter_stop_minutes" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "loading_checks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"trip_id" uuid NOT NULL,
	"order_id" varchar(24) NOT NULL,
	"manifest_version" integer NOT NULL,
	"checked_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "loading_issues" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"trip_id" uuid NOT NULL,
	"order_id" varchar(24) NOT NULL,
	"actual_units" integer NOT NULL,
	"reason" text NOT NULL,
	"resolved" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" varchar(24) PRIMARY KEY NOT NULL,
	"outlet_id" varchar(16) NOT NULL,
	"requested_date" date NOT NULL,
	"temperature" varchar(16) NOT NULL,
	"weight_kg" double precision NOT NULL,
	"volume_m3" double precision NOT NULL,
	"handling_units" integer NOT NULL,
	"loaded_units" integer,
	"delivered_units" integer,
	"status" varchar(32) DEFAULT 'CONFIRMED' NOT NULL,
	"trip_id" uuid,
	"stop_sequence" integer,
	"planned_arrival" time,
	"prior_deferrals" integer DEFAULT 0 NOT NULL,
	"deferral_reason" text,
	"next_run" date,
	"shortfall_reason" text,
	"revision" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "outlets" (
	"id" varchar(16) PRIMARY KEY NOT NULL,
	"brand" varchar(24) NOT NULL,
	"district" varchar(60) NOT NULL,
	"depot" varchar(60) NOT NULL,
	"dock_type" varchar(24) NOT NULL,
	"parking_constraint" varchar(24) NOT NULL,
	"mall_window" varchar(20),
	"window_open" time NOT NULL,
	"window_close" time NOT NULL
);
--> statement-breakpoint
CREATE TABLE "receipts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" varchar(24) NOT NULL,
	"quantity" integer NOT NULL,
	"issue" text,
	"confirmed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "service_allowances" (
	"brand" varchar(24) NOT NULL,
	"dock_type" varchar(24) NOT NULL,
	"service_minutes" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sync_operations" (
	"idempotency_key" varchar(80) PRIMARY KEY NOT NULL,
	"result" varchar(24) NOT NULL,
	"response" jsonb NOT NULL,
	"processed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trips" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vehicle_id" varchar(16) NOT NULL,
	"delivery_date" date NOT NULL,
	"trip_number" integer NOT NULL,
	"status" varchar(24) DEFAULT 'DRAFT' NOT NULL,
	"departure_time" time DEFAULT '05:00' NOT NULL,
	"distance_km" double precision DEFAULT 0 NOT NULL,
	"manifest_version" integer DEFAULT 1 NOT NULL,
	"fuel_reserved" boolean DEFAULT false NOT NULL,
	"published_at" timestamp with time zone,
	"started_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(160) NOT NULL,
	"name" varchar(120) NOT NULL,
	"role" varchar(24) NOT NULL,
	"scope_id" varchar(60),
	"password_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "vehicles" (
	"id" varchar(16) PRIMARY KEY NOT NULL,
	"type" varchar(16) NOT NULL,
	"temperature" varchar(16) NOT NULL,
	"weight_capacity_kg" double precision NOT NULL,
	"volume_capacity_m3" double precision NOT NULL,
	"fuel_type" varchar(24) NOT NULL,
	"km_per_litre" double precision NOT NULL,
	"weekly_fuel_quota_l" double precision NOT NULL,
	"fuel_remaining_l" double precision NOT NULL,
	"depot" varchar(60) NOT NULL
);
--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery_proofs" ADD CONSTRAINT "delivery_proofs_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loading_checks" ADD CONSTRAINT "loading_checks_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loading_checks" ADD CONSTRAINT "loading_checks_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loading_issues" ADD CONSTRAINT "loading_issues_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loading_issues" ADD CONSTRAINT "loading_issues_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_outlet_id_outlets_id_fk" FOREIGN KEY ("outlet_id") REFERENCES "public"."outlets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trips" ADD CONSTRAINT "trips_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "loading_check_version" ON "loading_checks" USING btree ("trip_id","order_id","manifest_version");--> statement-breakpoint
CREATE UNIQUE INDEX "one_receipt_per_order" ON "receipts" USING btree ("order_id");--> statement-breakpoint
CREATE UNIQUE INDEX "trip_vehicle_date_number" ON "trips" USING btree ("vehicle_id","delivery_date","trip_number");