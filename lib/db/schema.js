import {
  pgTable,
  uuid,
  text,
  integer,
  timestamp,
  date,
  index,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

// ── bookings ──
// Single source of truth for all guest appointments.
// Services and add-ons remain hardcoded in lib/demo-data.js for MVP simplicity;
// only the dynamic records (bookings) live in Postgres.
export const bookings = pgTable(
  'bookings',
  {
    id: uuid('id').defaultRandom().primaryKey(),

    // Human-facing reference code shown to the customer — used in portal lookups.
    code: text('code').notNull().unique(),

    // Selected services. serviceId/serviceName remain populated for legacy
    // queries — they hold the *primary* (first-clicked) service. serviceIds
    // is the full multi-select array; serviceName is the comma-joined display
    // string spanning every service in the booking.
    serviceId: text('service_id').notNull(),
    serviceName: text('service_name').notNull(),
    serviceIds: text('service_ids').array(),
    addOnNames: text('add_on_names').array().notNull().default(sql`ARRAY[]::text[]`),

    // Scheduling
    scheduledDate: date('scheduled_date').notNull(), // YYYY-MM-DD
    scheduledTimeId: text('scheduled_time_id').notNull(), // '0900', '1030', etc.
    scheduledTimeLabel: text('scheduled_time_label').notNull(), // '9:00 AM'

    // Customer (denormalized — no customers table yet)
    customerName: text('customer_name').notNull(),
    customerEmail: text('customer_email').notNull(),
    customerPhone: text('customer_phone'),
    customerNotes: text('customer_notes'),

    // Lifecycle
    status: text('status').notNull().default('confirmed'), // confirmed | pending | cancelled | rescheduled | completed
    paymentIntent: text('payment_intent').notNull(), // 'deposit' | 'full'

    // Money tracking (all in cents)
    totalCents: integer('total_cents').notNull(),
    depositCents: integer('deposit_cents').notNull(),
    remainingCents: integer('remaining_cents').notNull(),
    balanceStatus: text('balance_status').notNull().default('unpaid'), // paid | unpaid | link_sent

    // Deposit payment (charged at booking time via Web Payments SDK)
    depositSquarePaymentId: text('deposit_square_payment_id'),
    depositSquareStatus: text('deposit_square_status'),
    depositSquareReceiptUrl: text('deposit_square_receipt_url'),

    // Balance collection via Square Payment Link (admin-initiated)
    balanceLinkId: text('balance_link_id'),
    balanceLinkUrl: text('balance_link_url'),
    balanceOrderId: text('balance_order_id'),
    balanceSquarePaymentId: text('balance_square_payment_id'),

    // Refund tracking (admin cancel-with-refund flow)
    refundStatus: text('refund_status'), // null | 'pending' | 'completed' | 'failed'
    refundCents: integer('refund_cents'),
    refundedAt: timestamp('refunded_at', { withTimezone: true }),
    refundDepositSquareId: text('refund_deposit_square_id'),
    refundBalanceSquareId: text('refund_balance_square_id'),
    refundError: text('refund_error'),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    scheduledDateIdx: index('bookings_scheduled_date_idx').on(table.scheduledDate),
    customerEmailIdx: index('bookings_customer_email_idx').on(table.customerEmail),
    balanceOrderIdx: index('bookings_balance_order_id_idx').on(table.balanceOrderId),
  }),
);

// Auth.js tables (users / accounts / sessions / verificationTokens) live in
// ./auth-schema.js. Re-exported here so drizzle-kit picks them up from the
// single schema entry point configured in drizzle.config.js.
export * from './auth-schema';
