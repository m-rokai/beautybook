CREATE TABLE "booking_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_id" uuid NOT NULL,
	"booking_code" text NOT NULL,
	"event_type" text NOT NULL,
	"summary" text NOT NULL,
	"payload" jsonb,
	"actor" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "reminder_sent_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "booking_events_code_idx" ON "booking_events" USING btree ("booking_code");--> statement-breakpoint
CREATE INDEX "booking_events_created_at_idx" ON "booking_events" USING btree ("created_at");