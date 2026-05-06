import { eq, desc } from 'drizzle-orm';
import { db } from './db';
import { bookingEvents } from './db/schema';

/**
 * Append-only audit log for bookings. Every material mutation route calls
 * recordBookingEvent so /admin can render a chronological change history.
 *
 * eventType is a free-form short token; see schema.js for the canonical list.
 * Caller is responsible for keeping `summary` short and human-readable —
 * that's what shows up in the admin change-log UI without expanding the row.
 */
export async function recordBookingEvent({
  bookingId,
  bookingCode,
  eventType,
  summary,
  payload = null,
  actor = null,
}) {
  if (!bookingId || !bookingCode || !eventType || !summary) {
    throw new Error('recordBookingEvent: bookingId, bookingCode, eventType, summary are required');
  }
  try {
    const rows = await db
      .insert(bookingEvents)
      .values({
        bookingId,
        bookingCode,
        eventType,
        summary,
        payload,
        actor: actor ?? 'system',
      })
      .returning();
    return rows[0] ?? null;
  } catch (err) {
    // Audit logging should never block the operation that triggered it. We
    // surface the failure in server logs but don't rethrow.
    console.error('[booking-events] insert failed', err);
    return null;
  }
}

/** Reverse-chronological event list for one booking. Admin only. */
export async function listBookingEvents(bookingCode) {
  const rows = await db
    .select()
    .from(bookingEvents)
    .where(eq(bookingEvents.bookingCode, bookingCode))
    .orderBy(desc(bookingEvents.createdAt));
  return rows;
}
