import { and, eq, ne, sql } from 'drizzle-orm';
import { db } from './db';
import { bookings } from './db/schema';

/**
 * Server-only booking queries. Never import this from client components.
 */

// ── helpers ──

const BOOKING_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function generateBookingCode() {
  let code = 'AL-';
  for (let i = 0; i < 5; i++) {
    code += BOOKING_CODE_CHARS[Math.floor(Math.random() * BOOKING_CODE_CHARS.length)];
  }
  return code;
}

/** Generate a unique booking code, retrying on collisions. */
export async function generateUniqueBookingCode(maxAttempts = 5) {
  for (let i = 0; i < maxAttempts; i++) {
    const code = generateBookingCode();
    const existing = await db
      .select({ id: bookings.id })
      .from(bookings)
      .where(eq(bookings.code, code))
      .limit(1);
    if (existing.length === 0) return code;
  }
  throw new Error('Could not generate unique booking code');
}

// ── queries ──

export async function listBookings() {
  return db.select().from(bookings).orderBy(bookings.scheduledDate, bookings.scheduledTimeId);
}

export async function findBookingByCode(code) {
  const rows = await db
    .select()
    .from(bookings)
    .where(eq(bookings.code, code))
    .limit(1);
  return rows[0] ?? null;
}

export async function findBookingByBalanceOrderId(orderId) {
  const rows = await db
    .select()
    .from(bookings)
    .where(eq(bookings.balanceOrderId, orderId))
    .limit(1);
  return rows[0] ?? null;
}

/** Return the list of taken time slot ids for a given YYYY-MM-DD. */
export async function getTakenSlotsForDate(dateStr) {
  const rows = await db
    .select({ timeId: bookings.scheduledTimeId })
    .from(bookings)
    .where(
      and(
        eq(bookings.scheduledDate, dateStr),
        ne(bookings.status, 'cancelled'),
      ),
    );
  return rows.map((r) => r.timeId);
}

/** Like getTakenSlotsForDate but also returns serviceId(s) so callers can
 *  resolve duration across multi-service bookings and block every slot the
 *  booking actually occupies. */
export async function getBookedIntervalsForDate(dateStr) {
  const rows = await db
    .select({
      timeId: bookings.scheduledTimeId,
      serviceId: bookings.serviceId,
      serviceIds: bookings.serviceIds,
      serviceName: bookings.serviceName,
    })
    .from(bookings)
    .where(
      and(
        eq(bookings.scheduledDate, dateStr),
        ne(bookings.status, 'cancelled'),
      ),
    );
  return rows;
}

// ── mutations ──

export async function insertBooking(values) {
  const rows = await db.insert(bookings).values(values).returning();
  return rows[0];
}

export async function updateBookingByCode(code, patch) {
  const rows = await db
    .update(bookings)
    .set({ ...patch, updatedAt: sql`now()` })
    .where(eq(bookings.code, code))
    .returning();
  return rows[0] ?? null;
}
