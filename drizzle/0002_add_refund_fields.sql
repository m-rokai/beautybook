ALTER TABLE "bookings" ADD COLUMN "refund_status" text;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "refund_cents" integer;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "refunded_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "refund_deposit_square_id" text;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "refund_balance_square_id" text;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "refund_error" text;