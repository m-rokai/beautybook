CREATE TABLE "bookings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"service_id" text NOT NULL,
	"service_name" text NOT NULL,
	"add_on_names" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"scheduled_date" date NOT NULL,
	"scheduled_time_id" text NOT NULL,
	"scheduled_time_label" text NOT NULL,
	"customer_name" text NOT NULL,
	"customer_email" text NOT NULL,
	"customer_phone" text,
	"customer_notes" text,
	"status" text DEFAULT 'confirmed' NOT NULL,
	"payment_intent" text NOT NULL,
	"total_cents" integer NOT NULL,
	"deposit_cents" integer NOT NULL,
	"remaining_cents" integer NOT NULL,
	"balance_status" text DEFAULT 'unpaid' NOT NULL,
	"deposit_square_payment_id" text,
	"deposit_square_status" text,
	"deposit_square_receipt_url" text,
	"balance_link_id" text,
	"balance_link_url" text,
	"balance_order_id" text,
	"balance_square_payment_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bookings_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE INDEX "bookings_scheduled_date_idx" ON "bookings" USING btree ("scheduled_date");--> statement-breakpoint
CREATE INDEX "bookings_customer_email_idx" ON "bookings" USING btree ("customer_email");--> statement-breakpoint
CREATE INDEX "bookings_balance_order_id_idx" ON "bookings" USING btree ("balance_order_id");